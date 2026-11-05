import { Router, type IRouter } from "express";
import { db, bulletinsTable } from "@workspace/db";
import { eq, desc, or, isNull } from "drizzle-orm";
import {
  ListBulletinsResponse,
  GetBulletinResponse,
  CreateBulletinBody,
  GetBulletinParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

function format(b: typeof bulletinsTable.$inferSelect) {
  return {
    ...b,
    publishedAt: b.publishedAt.toISOString(),
    content: b.content ?? null,
    companyId: b.companyId ?? null,
    tags: b.tags ?? [],
  };
}

// Personalised bulletins (company_id set) must only reach their own company.
// Admins see everything; clients see global (company_id null) + their own.
router.get("/bulletins", requireAuth, async (req, res): Promise<void> => {
  const user = req.session.user!;
  const isAdmin = user.role === "ADMIN_PETRON";

  const rows = isAdmin
    ? await db.select().from(bulletinsTable).orderBy(desc(bulletinsTable.publishedAt))
    : await db
        .select()
        .from(bulletinsTable)
        .where(
          or(isNull(bulletinsTable.companyId), eq(bulletinsTable.companyId, user.companyId)),
        )
        .orderBy(desc(bulletinsTable.publishedAt));

  res.json(ListBulletinsResponse.parse(rows.map(format)));
});

router.post("/bulletins", async (req, res): Promise<void> => {
  const parsed = CreateBulletinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.insert(bulletinsTable).values(parsed.data).returning();

  res.status(201).json(GetBulletinResponse.parse(format(row)));
});

router.get("/bulletins/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetBulletinParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [row] = await db
    .select()
    .from(bulletinsTable)
    .where(eq(bulletinsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Boletim não encontrado" });
    return;
  }

  // Do not leak another company's personalised bulletin.
  const user = req.session.user!;
  if (row.companyId != null && user.role !== "ADMIN_PETRON" && row.companyId !== user.companyId) {
    res.status(404).json({ error: "Boletim não encontrado" });
    return;
  }

  res.json(GetBulletinResponse.parse(format(row)));
});

export default router;
