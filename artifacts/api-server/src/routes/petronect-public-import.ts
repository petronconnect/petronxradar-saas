import { Router, type Request, type Response } from "express";
import express from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";
import { parsePetronectPublicCsv, type PetronectPublicRow } from "../lib/petronect-public-csv";

type Executor = { execute(query: unknown): Promise<unknown> };
type ImportDatabase = Executor & {
  transaction<T>(callback: (tx: Executor) => Promise<T>): Promise<T>;
};
const database = db as unknown as ImportDatabase;
const router = Router();
router.use(requireAuth, requireAdmin);

function rows(result: unknown): Record<string, any>[] {
  if (Array.isArray(result)) return result as Record<string, any>[];
  const r = result as { rows?: Record<string, any>[] };
  return Array.isArray(r?.rows) ? r.rows : [];
}
function publicRow(row: Record<string, any>) {
  return {
    petronectId: row.petronect_id,
    title: row.title,
    subStatus: row.sub_status ?? null,
    company: row.company ?? null,
    scope: row.scope ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    processType: row.process_type ?? null,
    deliveryLocation: row.delivery_location ?? null,
  };
}
function sameRecord(existing: Record<string, any>, incoming: PetronectPublicRow): boolean {
  const current = publicRow(existing);
  return current.petronectId === incoming.petronectId &&
    current.title === incoming.title &&
    current.subStatus === incoming.subStatus &&
    current.company === incoming.company &&
    current.scope === incoming.scope &&
    current.startDate === incoming.startDate &&
    current.endDate === incoming.endDate &&
    current.processType === incoming.processType &&
    current.deliveryLocation === incoming.deliveryLocation;
}
function safeFileName(value: string | undefined) {
  let decoded = value ?? "";
  try { decoded = decodeURIComponent(decoded); } catch { /* Keep the sanitized header text. */ }
  return decoded.replace(/[\u0000-\u001f/\\]/g, "").slice(0, 160) || "exportacao-petronect.csv";
}
function runDto(run: Record<string, any>) {
  return {
    id: run.id, fileName: run.file_name, status: run.status,
    totalRows: run.total_rows, newRows: run.new_rows, updatedRows: run.updated_rows,
    unchangedRows: run.unchanged_rows, duplicateRows: run.duplicate_rows,
    invalidRows: run.invalid_rows, errorMessage: run.error_message ?? null,
    createdAt: run.created_at, completedAt: run.completed_at ?? null,
  };
}

router.get("/petroconnect/public-import/status", async (_req, res): Promise<void> => {
  const [count, latest] = await Promise.all([
    database.execute(sql`SELECT COUNT(*)::int AS count FROM petronect_public_opportunities`),
    database.execute(sql`SELECT * FROM petronect_public_import_runs ORDER BY id DESC LIMIT 1`),
  ]);
  const lastRun = rows(latest)[0];
  res.set("Cache-Control", "no-store");
  res.json({
    status: !lastRun ? "not_configured" : lastRun.status === "pending" ? "pending"
      : lastRun.status === "success" ? "success" : "failure",
    importedCount: Number(rows(count)[0]?.count ?? 0),
    lastRun: lastRun ? runDto(lastRun) : null,
    source: "Exportação pública oficial enviada por administrador",
    limitations: { value: "not_provided", sector: "not_provided", documents: "not_in_public_export" },
  });
});

router.get("/petroconnect/public-import/runs", async (_req, res): Promise<void> => {
  const result = await database.execute(sql`
    SELECT * FROM petronect_public_import_runs ORDER BY id DESC LIMIT 50
  `);
  res.set("Cache-Control", "no-store");
  res.json(rows(result).map(runDto));
});

router.get("/petroconnect/public-import/runs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Execução inválida." }); return; }
  const result = await database.execute(sql`SELECT * FROM petronect_public_import_runs WHERE id = ${id}`);
  const run = rows(result)[0];
  if (!run) { res.status(404).json({ error: "Execução não encontrada." }); return; }
  res.set("Cache-Control", "no-store");
  res.json({ ...runDto(run), preview: run.preview_rows ?? [] });
});

router.get("/petroconnect/public-import/opportunities", async (req, res): Promise<void> => {
  const limitRaw = Number(req.query.limit ?? 100), offsetRaw = Number(req.query.offset ?? 0);
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;
  const offset = Number.isInteger(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  const result = await database.execute(sql`
    SELECT * FROM petronect_public_opportunities
    ORDER BY source_updated_at DESC, petronect_id
    LIMIT ${limit} OFFSET ${offset}
  `);
  res.set("Cache-Control", "no-store");
  res.json(rows(result).map(row => ({
    id: row.id, ...publicRow(row), lastImportRunId: row.last_import_run_id,
    sourceFirstSeenAt: row.source_first_seen_at, sourceUpdatedAt: row.source_updated_at,
    value: null, sector: null,
  })));
});

router.get("/petroconnect/public-import/changes", async (_req, res): Promise<void> => {
  const result = await database.execute(sql`
    SELECT c.id, c.change_type, c.before_data, c.after_data, c.changed_at,
      o.petronect_id, r.id AS import_run_id
    FROM petronect_public_changes c
    JOIN petronect_public_opportunities o ON o.id = c.public_opportunity_id
    JOIN petronect_public_import_runs r ON r.id = c.import_run_id
    ORDER BY c.id DESC LIMIT 100
  `);
  res.set("Cache-Control", "no-store");
  res.json(rows(result));
});

router.post("/petroconnect/public-import/preview",
  express.text({ type: ["text/csv", "text/plain"], limit: "5mb" }),
  async (req: Request, res: Response): Promise<void> => {
    const fileName = safeFileName(req.get("x-import-filename"));
    const csv = typeof req.body === "string" ? req.body : "";
    let parsed: PetronectPublicRow[];
    try {
      parsed = parsePetronectPublicCsv(csv);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível ler a exportação.";
      const run = rows(await database.execute(sql`
        INSERT INTO petronect_public_import_runs
          (file_name, status, error_message, created_by, completed_at)
        VALUES (${fileName}, 'failed', ${message}, ${req.session.user!.id}, NOW())
        RETURNING id
      `))[0]!;
      req.log.warn({ importRunId: run.id }, "Petronect public import preview rejected");
      res.status(400).json({ runId: run.id, error: message });
      return;
    }

    const ids = [...new Set(parsed.filter(row => !row.error).map(row => row.petronectId))];
    const existing = ids.length
      ? rows(await database.execute(sql`
          SELECT * FROM petronect_public_opportunities WHERE petronect_id = ANY(${ids})
        `))
      : [];
    const current = new Map(existing.map(row => [row.petronect_id, row]));
    const preview = parsed.map(row => {
      if (row.error) return { ...row, action: row.error.includes("repetido") ? "duplicate" : "invalid" };
      const found = current.get(row.petronectId);
      return { ...row, action: !found ? "new" : sameRecord(found, row) ? "unchanged" : "updated" };
    });
    const totals = {
      totalRows: preview.length,
      newRows: preview.filter(r => r.action === "new").length,
      updatedRows: preview.filter(r => r.action === "updated").length,
      unchangedRows: preview.filter(r => r.action === "unchanged").length,
      duplicateRows: preview.filter(r => r.action === "duplicate").length,
      invalidRows: preview.filter(r => r.action === "invalid").length,
    };
    const run = rows(await database.execute(sql`
      INSERT INTO petronect_public_import_runs
        (file_name, status, total_rows, new_rows, updated_rows, unchanged_rows,
         duplicate_rows, invalid_rows, preview_rows, created_by)
      VALUES (${fileName}, 'pending', ${totals.totalRows}, ${totals.newRows},
        ${totals.updatedRows}, ${totals.unchangedRows}, ${totals.duplicateRows},
        ${totals.invalidRows}, ${JSON.stringify(preview)}::jsonb, ${req.session.user!.id})
      RETURNING id
    `))[0]!;
    res.status(201).json({ runId: run.id, ...totals, preview });
  });

router.post("/petroconnect/public-import/runs/:id/apply", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Execução inválida." }); return; }
  try {
    const result = await database.transaction(async tx => {
      const run = rows(await tx.execute(sql`
        SELECT * FROM petronect_public_import_runs WHERE id = ${id} FOR UPDATE
      `))[0];
      if (!run) return { missing: true as const };
      if (run.status === "success") return { complete: true as const, run: runDto(run) };
      if (!Array.isArray(run.preview_rows)) return { failedPreview: true as const };
      let newRows = 0, updatedRows = 0, unchangedRows = 0;
      const duplicateRows = Number(run.duplicate_rows), invalidRows = Number(run.invalid_rows);
      for (const item of run.preview_rows as Array<PetronectPublicRow & { action: string }>) {
        if (item.error || item.action === "duplicate" || item.action === "invalid") continue;
        // Serialize updates to the same Petronect number across overlapping imports.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${item.petronectId}, 0))`);
        const old = rows(await tx.execute(sql`
          SELECT * FROM petronect_public_opportunities WHERE petronect_id = ${item.petronectId} FOR UPDATE
        `))[0];
        if (old && sameRecord(old, item)) { unchangedRows++; continue; }
        const saved = rows(await tx.execute(old ? sql`
          UPDATE petronect_public_opportunities SET
            title = ${item.title}, sub_status = ${item.subStatus}, company = ${item.company},
            scope = ${item.scope}, start_date = ${item.startDate}, end_date = ${item.endDate},
            process_type = ${item.processType}, delivery_location = ${item.deliveryLocation},
            last_import_run_id = ${id}, source_updated_at = NOW()
          WHERE id = ${old.id} RETURNING *
        ` : sql`
          INSERT INTO petronect_public_opportunities
            (petronect_id, title, sub_status, company, scope, start_date, end_date,
             process_type, delivery_location, last_import_run_id)
          VALUES (${item.petronectId}, ${item.title}, ${item.subStatus}, ${item.company},
            ${item.scope}, ${item.startDate}, ${item.endDate}, ${item.processType},
            ${item.deliveryLocation}, ${id})
          ON CONFLICT (petronect_id) DO UPDATE SET
            title = EXCLUDED.title, sub_status = EXCLUDED.sub_status, company = EXCLUDED.company,
            scope = EXCLUDED.scope, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
            process_type = EXCLUDED.process_type, delivery_location = EXCLUDED.delivery_location,
            last_import_run_id = EXCLUDED.last_import_run_id, source_updated_at = NOW()
          RETURNING *
        `))[0];
        if (!saved) throw new Error("Public opportunity upsert returned no row");
        const changeType = old ? "updated" : "new";
        await tx.execute(sql`
          INSERT INTO petronect_public_changes
            (import_run_id, public_opportunity_id, change_type, before_data, after_data)
          VALUES (${id}, ${saved.id}, ${changeType}, ${old ? JSON.stringify(publicRow(old)) : null}::jsonb,
            ${JSON.stringify(publicRow(saved))}::jsonb)
          ON CONFLICT (import_run_id, public_opportunity_id) DO NOTHING
        `);
        if (old) updatedRows++; else newRows++;
      }
      const totals = { newRows, updatedRows, unchangedRows, duplicateRows, invalidRows };
      const savedRun = rows(await tx.execute(sql`
        UPDATE petronect_public_import_runs SET status = 'success',
          new_rows = ${newRows}, updated_rows = ${updatedRows}, unchanged_rows = ${unchangedRows},
          duplicate_rows = ${duplicateRows}, invalid_rows = ${invalidRows},
          error_message = NULL, completed_at = NOW()
        WHERE id = ${id} RETURNING *
      `))[0]!;
      return { complete: false as const, run: runDto(savedRun), totals };
    });
    if ("missing" in result) { res.status(404).json({ error: "Execução não encontrada." }); return; }
    if ("failedPreview" in result) { res.status(409).json({ error: "A prévia desta execução não está disponível." }); return; }
    res.json(result);
  } catch {
    await database.execute(sql`
      UPDATE petronect_public_import_runs SET status = 'failed',
        error_message = 'Falha ao aplicar a prévia. Os registros não foram aplicados; tente novamente.',
        completed_at = NOW()
      WHERE id = ${id} AND status <> 'success'
    `);
    req.log.error({ importRunId: id }, "Petronect public import apply failed");
    res.status(500).json({ error: "Falha ao aplicar a prévia. Os registros não foram aplicados; tente novamente." });
  }
});

export default router;
