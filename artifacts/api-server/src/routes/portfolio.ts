import { Router, type Request, type Response, type IRouter } from "express";
import { db, sql } from "@workspace/db";
import { requireAuth } from "../lib/auth";

type PortfolioDatabase = Pick<typeof db, "execute">;

function toRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

const VALID_STAGES = ["avaliando", "vou_licitar", "orcando", "enviada", "descartada"];

export function createPortfolioRouter(database: PortfolioDatabase = db): IRouter {
  const router: IRouter = Router();

  router.get("/portfolio", requireAuth, async (req: Request, res: Response): Promise<void> => {
    const companyId = req.session.user!.companyId;
    const rows = toRows(await database.execute(sql`
      SELECT p.id, p.stage, p.notes, p.created_at, p.updated_at,
             o.id as opportunity_id, o.title, o.sector, o.company, o.value,
             o.status, o.region, o.deadline, o.petronect_id, o.description,
             EXISTS (
               SELECT 1 FROM opportunity_document_reviews review
               WHERE review.opportunity_id = o.id AND review.status = 'verified'
             ) AS documents_checked
      FROM opportunity_portfolio p
      JOIN opportunities o ON o.id = p.opportunity_id
      WHERE p.company_id = ${companyId}
      ORDER BY p.updated_at DESC
    `));
    res.json(rows);
  });

  router.post("/portfolio", requireAuth, async (req: Request, res: Response): Promise<void> => {
    const companyId = req.session.user!.companyId;
    const { opportunityId } = req.body as { opportunityId?: number };
    if (!opportunityId) {
      res.status(400).json({ error: "opportunityId é obrigatório" });
      return;
    }

    const exists = toRows(await database.execute(sql`SELECT id FROM opportunities WHERE id = ${opportunityId}`));
    if (exists.length === 0) {
      res.status(404).json({ error: "Oportunidade não encontrada" });
      return;
    }

    const rows = toRows(await database.execute(sql`
      INSERT INTO opportunity_portfolio (company_id, opportunity_id, stage)
      VALUES (${companyId}, ${opportunityId}, 'avaliando')
      ON CONFLICT (company_id, opportunity_id) DO UPDATE SET updated_at = NOW()
      RETURNING id, stage
    `));
    res.status(201).json({ ok: true, ...rows[0] });
  });

  router.patch("/portfolio/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
    const companyId = req.session.user!.companyId;
    const id = Number(req.params.id);
    const { stage, notes } = req.body as { stage?: string; notes?: string };

    if (stage && !VALID_STAGES.includes(stage)) {
      res.status(400).json({ error: "Estágio inválido" });
      return;
    }

    await database.execute(sql`
      UPDATE opportunity_portfolio SET
        stage = COALESCE(${stage ?? null}, stage),
        notes = COALESCE(${notes ?? null}, notes),
        updated_at = NOW()
      WHERE id = ${id} AND company_id = ${companyId}
    `);
    res.json({ ok: true });
  });

  router.delete("/portfolio/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
    const companyId = req.session.user!.companyId;
    const id = Number(req.params.id);
    await database.execute(sql`
      DELETE FROM opportunity_portfolio WHERE id = ${id} AND company_id = ${companyId}
    `);
    res.json({ ok: true });
  });

  return router;
}

export default createPortfolioRouter();
