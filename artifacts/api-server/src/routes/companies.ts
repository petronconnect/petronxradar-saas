import { Router, type Request, type Response, type IRouter } from "express";
import { db, sql } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";
import {
  provisionPaidCompany,
  ProvisioningError,
  reissueCompanyAdminTemporaryPassword,
  TemporaryPasswordReissueInProgressError,
} from "../lib/provisioning";
import { PLAN_PRICE_BY_SLUG } from "./plans";

type CompaniesDatabase = Pick<typeof db, "execute" | "transaction">;

export function createCompaniesRouter(
  dependencies: {
    database?: CompaniesDatabase;
    provisionPaidCompany?: typeof provisionPaidCompany;
    reissueCompanyAdminTemporaryPassword?: typeof reissueCompanyAdminTemporaryPassword;
  } = {},
): IRouter {
const database = dependencies.database ?? db;
const provisionPaidCompanyFn = dependencies.provisionPaidCompany ?? provisionPaidCompany;
const reissueCompanyAdminTemporaryPasswordFn =
  dependencies.reissueCompanyAdminTemporaryPassword ?? reissueCompanyAdminTemporaryPassword;
const router: IRouter = Router();

function toRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

router.get("/companies", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const rows = toRows(await database.execute(sql`
    SELECT ca.*,
           s.plan_slug, s.status as subscription_status, s.renewal_date, s.last_payment_at,
           s.last_payment_amount, s.next_billing_amount,
           COALESCE((
             SELECT json_agg(json_build_object('id', cu.id, 'nome', cu.nome, 'email', cu.email) ORDER BY cu.id)
             FROM company_users cu
             WHERE cu.company_id = ca.id AND cu.role = 'CLIENTE_ADMIN'
           ), '[]'::json) as admins,
           (SELECT cu.email FROM company_users cu
            WHERE cu.company_id = ca.id AND cu.role = 'CLIENTE_ADMIN'
            ORDER BY cu.id LIMIT 1) as admin_email,
           (SELECT count(*) FROM company_users cu WHERE cu.company_id = ca.id) as user_count
    FROM company_accounts ca
    LEFT JOIN subscriptions s ON s.company_id = ca.id
    ORDER BY ca.created_at DESC
  `));
  res.json(rows);
});

router.get("/companies/inquiries", requireAuth, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const rows = toRows(await database.execute(sql`
    SELECT id, company_name AS "companyName", cnpj, contact_name AS "contactName",
           contact_role AS "contactRole", email, whatsapp, segment, status,
           desired_plan AS "desiredPlan", recommended_plan AS "recommendedPlan",
           lead_score AS "leadScore", created_at AS "createdAt"
    FROM inquiries
    WHERE lower(status) NOT IN ('ativo', 'convertido', 'descartado')
    ORDER BY created_at DESC
    LIMIT 100
  `));
  res.json(rows);
});

router.get("/companies/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const user = req.session.user!;
  if (user.role !== "ADMIN_PETRON" && user.companyId !== id) {
    res.status(403).json({ error: "Acesso não autorizado" });
    return;
  }

  const rows = toRows(await database.execute(sql`
    SELECT ca.*,
           s.plan_slug, s.status as subscription_status, s.renewal_date,
           s.last_payment_at, s.last_payment_amount, s.next_billing_amount
    FROM company_accounts ca
    LEFT JOIN subscriptions s ON s.company_id = ca.id
    WHERE ca.id = ${id}
    LIMIT 1
  `));

  if (!rows[0]) { res.status(404).json({ error: "Empresa não encontrada" }); return; }
  res.json(rows[0]);
});

router.post("/companies", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const {
    inquiryId, razaoSocial, nomeFantasia, cnpj, cidade, estado, email,
    adminEmail, adminName, telefone, segmento, planSlug, paymentAmount,
    nextBillingAmount: requestedNextBillingAmount, renewalDate,
  } = req.body as Record<string, unknown>;

  const cnpjDigits = typeof cnpj === "string" ? cnpj.replace(/\D/g, "") : "";
  const normalizedEmail = typeof email === "string" ? email.trim() : "";
  const normalizedAdminEmail = typeof adminEmail === "string" && adminEmail.trim()
    ? adminEmail.trim()
    : normalizedEmail;
  const amount = Number(paymentAmount);
  const planKey = typeof planSlug === "string" ? planSlug : "";
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const allowedPlan = typeof planSlug === "string" &&
    Object.prototype.hasOwnProperty.call(PLAN_PRICE_BY_SLUG, planSlug);
  const defaultNextBillingAmount = planKey === "radar-lancamento"
    ? 890
    : PLAN_PRICE_BY_SLUG[planKey];
  const renewalAmount = requestedNextBillingAmount === undefined
    ? defaultNextBillingAmount
    : Number(requestedNextBillingAmount);
  const validInquiryId = inquiryId === undefined || inquiryId === null ||
    (Number.isInteger(Number(inquiryId)) && Number(inquiryId) > 0);

  if (
    typeof razaoSocial !== "string" || razaoSocial.trim().length < 2 ||
    typeof nomeFantasia !== "string" || nomeFantasia.trim().length < 2 ||
    cnpjDigits.length !== 14 ||
    typeof cidade !== "string" || cidade.trim().length < 2 ||
    typeof estado !== "string" || !/^[a-z]{2}$/i.test(estado.trim()) ||
    !validEmail.test(normalizedEmail) || !validEmail.test(normalizedAdminEmail) ||
    typeof adminName !== "string" || adminName.trim().length < 2 ||
    typeof segmento !== "string" || segmento.trim().length < 2 ||
    !allowedPlan || !Number.isFinite(amount) || amount <= 0 ||
    !Number.isFinite(renewalAmount) || renewalAmount <= 0 ||
    !validInquiryId
  ) {
    res.status(400).json({ error: "Revise os dados da empresa, do administrador, do plano e do pagamento" });
    return;
  }

  let validRenewalDate: string;
  if (typeof renewalDate === "string" && renewalDate) {
    const parsedDate = new Date(`${renewalDate}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(renewalDate) ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== renewalDate
    ) {
      res.status(400).json({ error: "Data de renovação inválida" });
      return;
    }
    validRenewalDate = renewalDate;
  } else {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 30);
    validRenewalDate = date.toISOString().slice(0, 10);
  }

  try {
    const result = await provisionPaidCompanyFn({
      inquiryId: inquiryId == null ? undefined : Number(inquiryId),
      razaoSocial: razaoSocial.trim(),
      nomeFantasia: nomeFantasia.trim(),
      cnpj: cnpjDigits,
      cidade: cidade.trim(),
      estado: estado.trim().toUpperCase(),
      email: normalizedEmail,
      adminEmail: normalizedAdminEmail,
      adminName: adminName.trim(),
      socioAdministrador: adminName.trim(),
      telefone: typeof telefone === "string" ? telefone : null,
      segmento: segmento.trim(),
      planSlug: planSlug as string,
      paymentAmount: amount,
      nextBillingAmount: renewalAmount,
      renewalDate: validRenewalDate,
    });
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof ProvisioningError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (
      error && typeof error === "object" &&
      "code" in error && error.code === "23505"
    ) {
      res.status(409).json({ error: "CNPJ ou e-mail já cadastrado" });
      return;
    }
    throw error;
  }
});

router.post("/companies/:id/temporary-password", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const companyId = Number(rawId);
  const rawAdminUserId = (req.body as Record<string, unknown> | null)?.adminUserId;
  const adminUserId = typeof rawAdminUserId === "number" ? rawAdminUserId : Number.NaN;
  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    res.status(400).json({ error: "Empresa inválida" });
    return;
  }
  if (!Number.isSafeInteger(adminUserId) || adminUserId <= 0) {
    res.status(400).json({ error: "Selecione um administrador válido" });
    return;
  }

  let result;
  try {
    result = await reissueCompanyAdminTemporaryPasswordFn(companyId, adminUserId, database);
  } catch (error) {
    if (error instanceof TemporaryPasswordReissueInProgressError) {
      res.status(409).json({ error: "Já existe uma reemissão em andamento. Tente novamente." });
      return;
    }
    throw error;
  }
  if (!result) {
    res.status(404).json({ error: "Administrador da empresa não encontrado" });
    return;
  }

  req.log?.info({ companyId, userId: result.userId }, "Company admin temporary password reissued");
  res.set("Cache-Control", "no-store, private").json({ ...result, companyId });
});

router.patch("/companies/:id", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const { razaoSocial, nomeFantasia, cidade, estado, email, telefone, whatsapp,
          segmento, socioAdministrador, capitalSocial, status, notes } = req.body;

  await database.execute(sql`
    UPDATE company_accounts SET
      razao_social = COALESCE(${razaoSocial ?? null}, razao_social),
      nome_fantasia = COALESCE(${nomeFantasia ?? null}, nome_fantasia),
      cidade = COALESCE(${cidade ?? null}, cidade),
      estado = COALESCE(${estado ?? null}, estado),
      email = COALESCE(${email ?? null}, email),
      telefone = COALESCE(${telefone ?? null}, telefone),
      whatsapp = COALESCE(${whatsapp ?? null}, whatsapp),
      segmento = COALESCE(${segmento ?? null}, segmento),
      socio_administrador = COALESCE(${socioAdministrador ?? null}, socio_administrador),
      capital_social = COALESCE(${capitalSocial ?? null}, capital_social),
      status = COALESCE(${status ?? null}, status),
      notes = COALESCE(${notes ?? null}, notes),
      updated_at = NOW()
    WHERE id = ${id}
  `);
  res.json({ ok: true });
});

router.post("/companies/:id/access", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const { action } = req.body as { action: "liberar" | "suspender" };

  if (!["liberar", "suspender"].includes(action)) {
    res.status(400).json({ error: "Ação deve ser 'liberar' ou 'suspender'" });
    return;
  }

  const newStatus = action === "liberar" ? "ativa" : "suspensa";
  const subStatus = action === "liberar" ? "ativo" : "suspenso";

  await database.execute(sql`UPDATE company_accounts SET status = ${newStatus}, updated_at = NOW() WHERE id = ${id}`);
  await database.execute(sql`UPDATE subscriptions SET status = ${subStatus}, updated_at = NOW() WHERE company_id = ${id}`);
  await database.execute(sql`UPDATE company_users SET ativo = ${action === "liberar"} WHERE company_id = ${id}`);

  res.json({ ok: true, status: newStatus });
});

return router;
}

export default createCompaniesRouter();
