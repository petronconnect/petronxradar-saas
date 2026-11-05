import { Router, type Request, type Response, type IRouter } from "express";
import { db, sql } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";

const router: IRouter = Router();

function toRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

router.get("/subscriptions", requireAuth, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const rows = toRows(await db.execute(sql`
    SELECT s.*, ca.razao_social, ca.nome_fantasia, ca.cnpj, ca.email, ca.status as company_status
    FROM subscriptions s
    JOIN company_accounts ca ON ca.id = s.company_id
    ORDER BY s.renewal_date ASC
  `));
  res.json(rows);
});

router.get("/subscriptions/my", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const companyId = req.session.user!.companyId;

  const rows = toRows(await db.execute(sql`
    SELECT s.*, ca.razao_social, ca.nome_fantasia, ca.cnpj
    FROM subscriptions s
    JOIN company_accounts ca ON ca.id = s.company_id
    WHERE s.company_id = ${companyId}
    LIMIT 1
  `));

  if (!rows[0]) { res.status(404).json({ error: "Assinatura não encontrada" }); return; }
  res.json(rows[0]);
});

router.patch("/subscriptions/:id", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const { planSlug, status, renewalDate, notes } = req.body;

  await db.execute(sql`
    UPDATE subscriptions SET
      plan_slug = COALESCE(${planSlug ?? null}, plan_slug),
      status = COALESCE(${status ?? null}, status),
      renewal_date = COALESCE(${renewalDate ?? null}::date, renewal_date),
      notes = COALESCE(${notes ?? null}, notes),
      updated_at = NOW()
    WHERE id = ${id}
  `);
  res.json({ ok: true });
});

router.post("/subscriptions/:id/payment", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const { amount, renewalDate } = req.body as { amount: number; renewalDate?: string };

  if (!amount) { res.status(400).json({ error: "Valor do pagamento é obrigatório" }); return; }

  await db.execute(sql`
    UPDATE subscriptions SET
      last_payment_at = NOW(),
      last_payment_amount = ${amount},
      status = 'ativo',
      renewal_date = COALESCE(${renewalDate ?? null}::date, renewal_date),
      updated_at = NOW()
    WHERE id = ${id}
  `);
  res.json({ ok: true });
});

router.post("/subscriptions/upsert", requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { companyId, planSlug, startDate, renewalDate, nextBillingAmount, status } = req.body;
  if (!companyId || !planSlug || !startDate || !renewalDate) {
    res.status(400).json({ error: "companyId, planSlug, startDate, renewalDate são obrigatórios" });
    return;
  }

  await db.execute(sql`
    INSERT INTO subscriptions (company_id, plan_slug, start_date, renewal_date, next_billing_amount, status)
    VALUES (${companyId}, ${planSlug}, ${startDate}::date, ${renewalDate}::date, ${nextBillingAmount ?? null}, ${status || "ativo"})
    ON CONFLICT (company_id) DO UPDATE SET
      plan_slug = EXCLUDED.plan_slug,
      renewal_date = EXCLUDED.renewal_date,
      next_billing_amount = EXCLUDED.next_billing_amount,
      status = EXCLUDED.status,
      updated_at = NOW()
  `);
  res.json({ ok: true });
});

export default router;
