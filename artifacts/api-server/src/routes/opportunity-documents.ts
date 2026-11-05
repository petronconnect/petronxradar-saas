import { Router, type Request, type Response, type IRouter } from "express";
import { db, sql } from "@workspace/db";
import {
  CreateOpportunityDocumentBody,
  ReviewOpportunityDocumentsBody,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../lib/auth";

type DocumentsDatabase = Pick<typeof db, "execute">;
type DbRow = Record<string, any>;

function toRows(result: any): DbRow[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

function asIso(value: unknown): string | null {
  if (value == null) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDocument(row: DbRow) {
  return {
    id: Number(row.id),
    opportunityId: Number(row.opportunityId ?? row.opportunity_id),
    kind: row.kind,
    label: row.label,
    url: row.url,
    linkTestedAt: asIso(row.linkTestedAt ?? row.link_tested_at),
    linkTestedByName: row.linkTestedByName ?? row.link_tested_by_name ?? null,
    createdAt: asIso(row.createdAt ?? row.created_at),
  };
}

function formatReview(row?: DbRow) {
  return {
    status: row?.status === "verified" ? "verified" : "pending",
    verifiedAt: asIso(row?.verifiedAt ?? row?.verified_at),
    verifiedByName: row?.verifiedByName ?? row?.verified_by_name ?? null,
    sourceDocumentId: row?.sourceDocumentId == null && row?.source_document_id == null
      ? null
      : Number(row.sourceDocumentId ?? row.source_document_id),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isPetronectUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "petronect.com.br" || hostname.endsWith(".petronect.com.br");
  } catch {
    return false;
  }
}

async function resetReview(database: DocumentsDatabase, opportunityId: number): Promise<void> {
  await database.execute(sql`
    INSERT INTO opportunity_document_reviews
      (opportunity_id, status, verified_at, verified_by, source_document_id, updated_at)
    VALUES (${opportunityId}, 'pending', NULL, NULL, NULL, NOW())
    ON CONFLICT (opportunity_id) DO UPDATE SET
      status = 'pending',
      verified_at = NULL,
      verified_by = NULL,
      source_document_id = NULL,
      updated_at = NOW()
  `);
}

export function createOpportunityDocumentsRouter(database: DocumentsDatabase = db): IRouter {
  const router: IRouter = Router();

  // Curated links and their latest official-document review are shared with authenticated clients.
  router.get("/opportunities/:id/documents", requireAuth, async (req: Request, res: Response): Promise<void> => {
    const opportunityId = Number(req.params.id);
    if (!Number.isSafeInteger(opportunityId) || opportunityId <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const opportunityRows = toRows(await database.execute(sql`
      SELECT id FROM opportunities WHERE id = ${opportunityId}
    `));
    if (!opportunityRows.length) {
      res.status(404).json({ error: "Oportunidade não encontrada" });
      return;
    }

    const documents = toRows(await database.execute(sql`
      SELECT d.id, d.opportunity_id AS "opportunityId", d.kind, d.label, d.url,
             d.created_at AS "createdAt", d.link_tested_at AS "linkTestedAt",
             tester.nome AS "linkTestedByName"
      FROM opportunity_documents d
      LEFT JOIN company_users tester ON tester.id = d.link_tested_by
      WHERE d.opportunity_id = ${opportunityId}
      ORDER BY d.created_at ASC, d.id ASC
    `));
    const reviewRows = toRows(await database.execute(sql`
      SELECT r.status, r.verified_at AS "verifiedAt",
             reviewer.nome AS "verifiedByName", r.source_document_id AS "sourceDocumentId"
      FROM opportunity_document_reviews r
      LEFT JOIN company_users reviewer ON reviewer.id = r.verified_by
      WHERE r.opportunity_id = ${opportunityId}
    `));

    res.set("Cache-Control", "no-store, private").json({
      documents: documents.map(formatDocument),
      review: formatReview(reviewRows[0]),
    });
  });

  // Only PETRON staff can add source links. Adding a link invalidates the prior review.
  router.post("/opportunities/:id/documents", requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const opportunityId = Number(req.params.id);
    if (!Number.isSafeInteger(opportunityId) || opportunityId <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const parsed = CreateOpportunityDocumentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { kind, label, url } = parsed.data;
    if (!isHttpUrl(url)) {
      res.status(400).json({ error: "URL inválida (use http:// ou https://)" });
      return;
    }
    if (kind === "fonte_oficial" && !isPetronectUrl(url)) {
      res.status(400).json({ error: "A fonte oficial deve usar um endereço do domínio Petronect." });
      return;
    }

    const opportunityRows = toRows(await database.execute(sql`
      SELECT id FROM opportunities WHERE id = ${opportunityId}
    `));
    if (!opportunityRows.length) {
      res.status(404).json({ error: "Oportunidade não encontrada" });
      return;
    }

    const rows = toRows(await database.execute(sql`
      INSERT INTO opportunity_documents
        (opportunity_id, kind, label, url, created_by)
      VALUES (${opportunityId}, ${kind}, ${label.trim()}, ${url.trim()}, ${req.session.user!.id})
      RETURNING id, opportunity_id AS "opportunityId", kind, label, url,
                created_at AS "createdAt", link_tested_at AS "linkTestedAt"
    `));
    await resetReview(database, opportunityId);
    res.set("Cache-Control", "no-store, private").status(201).json(formatDocument(rows[0]));
  });

  // PETRON staff open the destination and then explicitly record the manual test.
  router.post("/opportunities/documents/:docId/test", requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const docId = Number(req.params.docId);
    if (!Number.isSafeInteger(docId) || docId <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const rows = toRows(await database.execute(sql`
      UPDATE opportunity_documents
      SET link_tested_at = NOW(), link_tested_by = ${req.session.user!.id}
      WHERE id = ${docId}
      RETURNING id, opportunity_id AS "opportunityId", kind, label, url,
                created_at AS "createdAt", link_tested_at AS "linkTestedAt"
    `));
    if (!rows.length) {
      res.status(404).json({ error: "Documento não encontrado" });
      return;
    }

    const testerRows = toRows(await database.execute(sql`
      SELECT nome AS "linkTestedByName" FROM company_users WHERE id = ${req.session.user!.id}
    `));
    res.set("Cache-Control", "no-store, private").json(
      formatDocument({ ...rows[0], linkTestedByName: testerRows[0]?.linkTestedByName ?? null }),
    );
  });

  // Confirmation requires a tested Petronect source and every attached link tested.
  router.post("/opportunities/:id/documents/review", requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const opportunityId = Number(req.params.id);
    if (!Number.isSafeInteger(opportunityId) || opportunityId <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const parsed = ReviewOpportunityDocumentsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const opportunityRows = toRows(await database.execute(sql`
      SELECT id FROM opportunities WHERE id = ${opportunityId}
    `));
    if (!opportunityRows.length) {
      res.status(404).json({ error: "Oportunidade não encontrada" });
      return;
    }

    const sourceRows = toRows(await database.execute(sql`
      SELECT id FROM opportunity_documents
      WHERE id = ${parsed.data.sourceDocumentId}
        AND opportunity_id = ${opportunityId}
        AND kind = 'fonte_oficial'
        AND link_tested_at IS NOT NULL
    `));
    if (!sourceRows.length) {
      res.status(409).json({ error: "Teste e selecione um link da fonte oficial Petronect desta oportunidade." });
      return;
    }

    const untestedRows = toRows(await database.execute(sql`
      SELECT COUNT(*)::integer AS count
      FROM opportunity_documents
      WHERE opportunity_id = ${opportunityId} AND link_tested_at IS NULL
    `));
    if (Number(untestedRows[0]?.count ?? 0) > 0) {
      res.status(409).json({ error: "Teste todos os links desta oportunidade antes de confirmar a conferência." });
      return;
    }

    await database.execute(sql`
      INSERT INTO opportunity_document_reviews
        (opportunity_id, status, verified_at, verified_by, source_document_id, updated_at)
      VALUES (${opportunityId}, 'verified', NOW(), ${req.session.user!.id},
              ${parsed.data.sourceDocumentId}, NOW())
      ON CONFLICT (opportunity_id) DO UPDATE SET
        status = 'verified',
        verified_at = NOW(),
        verified_by = EXCLUDED.verified_by,
        source_document_id = EXCLUDED.source_document_id,
        updated_at = NOW()
    `);
    const reviewerRows = toRows(await database.execute(sql`
      SELECT nome AS "verifiedByName" FROM company_users WHERE id = ${req.session.user!.id}
    `));
    res.set("Cache-Control", "no-store, private").json({
      status: "verified",
      verifiedAt: new Date().toISOString(),
      verifiedByName: reviewerRows[0]?.verifiedByName ?? null,
      sourceDocumentId: parsed.data.sourceDocumentId,
    });
  });

  // Removing a link also invalidates the review; the remaining set must be checked again.
  router.delete("/opportunities/documents/:docId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
    const docId = Number(req.params.docId);
    if (!Number.isSafeInteger(docId) || docId <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const rows = toRows(await database.execute(sql`
      DELETE FROM opportunity_documents
      WHERE id = ${docId}
      RETURNING opportunity_id AS "opportunityId"
    `));
    if (!rows.length) {
      res.status(404).json({ error: "Documento não encontrado" });
      return;
    }
    await resetReview(database, Number(rows[0].opportunityId));
    res.set("Cache-Control", "no-store, private").json({ ok: true });
  });

  return router;
}

export default createOpportunityDocumentsRouter();
