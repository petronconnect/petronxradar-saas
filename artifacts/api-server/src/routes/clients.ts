import { Router, type IRouter } from "express";
import { db, clientsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import {
  ListClientsResponse,
  CreateClientBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/clients", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(clientsTable)
    .orderBy(desc(clientsTable.createdAt));

  const formatted = rows.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    email: c.email ?? null,
    phone: c.phone ?? null,
  }));

  res.json(ListClientsResponse.parse(formatted));
});

router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.insert(clientsTable).values(parsed.data).returning();

  res.status(201).json({
    ...row,
    createdAt: row.createdAt.toISOString(),
    email: row.email ?? null,
    phone: row.phone ?? null,
  });
});

export default router;
