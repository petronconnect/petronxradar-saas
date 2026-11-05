import { Router, type IRouter } from "express";
import { db, sql } from "@workspace/db";
import {
  ListOpportunitiesResponse,
  GetOpportunityResponse,
  CreateOpportunityBody,
  GetOpportunityParams,
} from "@workspace/api-zod";
import { requireAdmin, requireAuth } from "../lib/auth";

type OpportunityDatabase = Pick<typeof db, "execute">;

function toRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

function formatCatalogOpportunity(row: any) {
  // The shared catalog intentionally exposes only public opportunity fields.
  // Company portfolios, analyses, and curated documents are separate resources.
  return {
    id: row.id,
    title: row.title,
    sector: row.sector,
    company: row.company,
    value: row.value,
    status: row.status,
    region: row.region,
    description: row.description ?? null,
    deadline: row.deadline ?? null,
    petronectId: row.petronectId ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    documentsChecked: Boolean(row.documentsChecked),
  };
}

const CATALOG_COLUMNS = sql.raw(`
  id, title, sector, company, value, status, region, description, deadline,
  petronect_id AS "petronectId", created_at AS "createdAt",
  EXISTS (
    SELECT 1 FROM opportunity_document_reviews review
    WHERE review.opportunity_id = opportunities.id AND review.status = 'verified'
  ) AS "documentsChecked"
`);

export function createOpportunitiesRouter(database: OpportunityDatabase = db): IRouter {
  const router: IRouter = Router();

  // The opportunity catalog is shared, but it is available only to signed-in
  // customers and staff. Tenant-specific portfolio data is never joined here.
  router.get("/opportunities", requireAuth, async (_req, res): Promise<void> => {
    const rows = toRows(await database.execute(sql`
      SELECT ${CATALOG_COLUMNS}
      FROM opportunities
      ORDER BY created_at DESC
    `));

    res.json(ListOpportunitiesResponse.parse(rows.map(formatCatalogOpportunity)));
  });

  // Only the platform operator can add entries to the shared catalog.
  router.post("/opportunities", requireAuth, requireAdmin, async (req, res): Promise<void> => {
    const parsed = CreateOpportunityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const opportunity = parsed.data;
    const rows = toRows(await database.execute(sql`
      INSERT INTO opportunities
        (title, sector, company, value, status, region, description, deadline, petronect_id)
      VALUES
        (${opportunity.title}, ${opportunity.sector}, ${opportunity.company},
         ${opportunity.value}, ${opportunity.status}, ${opportunity.region},
         ${opportunity.description ?? null}, ${opportunity.deadline ?? null},
         ${opportunity.petronectId ?? null})
      RETURNING ${CATALOG_COLUMNS}
    `));

    res.status(201).json(GetOpportunityResponse.parse(formatCatalogOpportunity(rows[0])));
  });

  router.get("/opportunities/:id", requireAuth, async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const params = GetOpportunityParams.safeParse({ id: parseInt(raw, 10) });
    if (!params.success) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const rows = toRows(await database.execute(sql`
      SELECT ${CATALOG_COLUMNS}
      FROM opportunities
      WHERE id = ${params.data.id}
    `));
    const [row] = rows;

    if (!row) {
      res.status(404).json({ error: "Oportunidade não encontrada" });
      return;
    }

    res.json(GetOpportunityResponse.parse(formatCatalogOpportunity(row)));
  });

  return router;
}

export default createOpportunitiesRouter();
