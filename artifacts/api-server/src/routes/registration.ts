import { Router, type IRouter } from "express";
import { db, sql } from "@workspace/db";
import { CreateInquiryBody, RegisterCompanyBody } from "@workspace/api-zod";
import { PLAN_PRICE_BY_SLUG } from "./plans";
import { persistSession } from "../lib/auth-session";

const rows = (r: any): any[] => Array.isArray(r) ? r : r.rows ?? [];
export function createRegistrationRouter(database: Pick<typeof db, "execute"> = db): IRouter {
  const router = Router();
  const attempts = new Map<string, { count: number; until: number }>();
  router.get("/auth/registration", (req, res) => {
    const registration = req.session.registration;
    const google = req.session.googleRegistration;
    res.set("Cache-Control", "no-store, private").json({
      registration: registration && registration.expiresAt > Date.now() ? registration : null,
      googleEmail: google && google.expiresAt > Date.now() ? google.email : null,
    });
  });
  router.post("/auth/register", async (req, res): Promise<void> => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
    const key = req.ip ?? "unknown";
    if (attempts.size >= 10000 || (attempts.get(key)?.count ?? 0) >= 10) {
      res.set("Retry-After", "3600").status(429).json({ error: "Muitas tentativas de cadastro. Tente mais tarde." }); return;
    }
    const bucket = attempts.get(key) ?? { count: 0, until: now + 3600_000 };
    bucket.count++; attempts.set(key, bucket);
    const body = req.body ?? {};
    if (!RegisterCompanyBody.safeParse(body).success) {
      res.status(400).json({ error: "Confira os campos obrigatórios do cadastro." }); return;
    }
    const text = (name: string) => typeof body[name] === "string" ? body[name].trim() : "";
    const email = text("email").toLowerCase();
    const cnpj = text("cnpj").replace(/\D/g, "");
    const planSlug = text("planSlug");
    const cidade = text("cidade"), estado = text("estado").toUpperCase();
    const required = ["companyName", "contactName", "contactRole", "whatsapp", "segment", "servicesOffered"];
    if (required.some(name => !text(name) || text(name).length > 500) ||
        !/^\d{14}$/.test(cnpj) || !cidade || cidade.length > 100 ||
        !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(estado) ||
        !Object.hasOwn(PLAN_PRICE_BY_SLUG, planSlug) || body.allowContact !== true ||
        email.length > 254) {
      res.status(400).json({ error: "Confira os dados da empresa, o plano e o consentimento." }); return;
    }
    const parsed = CreateInquiryBody.safeParse({
      companyName: text("companyName"), cnpj, contactName: text("contactName"),
      contactRole: text("contactRole"), email, whatsapp: text("whatsapp"),
      segment: text("segment"), servicesOffered: text("servicesOffered"),
      hasPetrobrasRegistration: false, interestedInBidding: true,
      operationalVolume: "A confirmar", regions: `${cidade}/${estado}`,
      desiredPlan: planSlug, allowContact: true,
    });
    if (!parsed.success) {
      res.status(400).json({ error: "Confira o e-mail e os dados informados." }); return;
    }
    const google = req.session.googleRegistration;
    if (google && (google.expiresAt <= now || google.email !== email)) {
      res.status(409).json({ error: "Use o e-mail Google verificado ou autentique novamente." }); return;
    }
    const existing = rows(await database.execute(sql`
      SELECT id FROM company_users WHERE lower(email) = ${email}
      UNION ALL SELECT id FROM company_accounts
      WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = ${cnpj} LIMIT 1
    `));
    if (existing.length) {
      res.status(409).json({ error: "Cadastro não disponível para estes dados. Entre na conta existente ou contate o suporte." }); return;
    }
    const old = req.session.registration;
    // Repeated submits in the same browser reuse the same unactivated inquiry.
    if (old && old.expiresAt > now && old.email === email && old.cnpj === cnpj && old.planSlug === planSlug &&
        old.companyName === text("companyName") && old.contactName === text("contactName") &&
        old.contactRole === text("contactRole") && old.whatsapp === text("whatsapp") &&
        old.cidade === cidade && old.estado === estado) {
      res.json({ inquiryId: old.inquiryId, checkoutPath: `/checkout/${planSlug}` }); return;
    }
    const d = parsed.data;
    const inquiry = rows(await database.execute(sql`
      INSERT INTO inquiries (company_name, cnpj, contact_name, contact_role, email, whatsapp,
        segment, services_offered, has_petrobras_registration, interested_in_bidding,
        operational_volume, regions, desired_plan, allow_contact, source, status, cidade, estado)
      VALUES (${d.companyName}, ${cnpj}, ${d.contactName}, ${d.contactRole}, ${email}, ${d.whatsapp},
        ${d.segment}, ${d.servicesOffered}, false, true, 'A confirmar', ${d.regions},
        ${planSlug}, true, 'cadastro-publico', 'novo', ${cidade}, ${estado}) RETURNING id
    `))[0];
    if (!inquiry) throw new Error("Falha ao registrar solicitação");
    req.session.registration = {
      inquiryId: inquiry.id, planSlug, companyName: d.companyName, cnpj,
      contactName: d.contactName, contactRole: d.contactRole, email, whatsapp: d.whatsapp,
      cidade, estado, segment: d.segment, expiresAt: now + 30 * 60_000,
    };
    await persistSession(req);
    res.status(201).json({ inquiryId: inquiry.id, checkoutPath: `/checkout/${planSlug}` });
  });
  return router;
}
export default createRegistrationRouter();
