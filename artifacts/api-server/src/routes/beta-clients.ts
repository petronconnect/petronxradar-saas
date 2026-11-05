import { Router, type IRouter } from "express";
import { db, betaClientsTable, betaClientChecklistTable } from "@workspace/db";
import { eq, asc, desc } from "drizzle-orm";
import {
  ListBetaClientsResponse,
  GetBetaClientResponse,
  CreateBetaClientBody,
  GetBetaClientParams,
  UpdateBetaClientParams,
  UpdateBetaClientBody,
  UpdateBetaClientResponse,
  UpdateBetaClientChecklistItemParams,
  UpdateBetaClientChecklistItemBody,
  UpdateBetaClientChecklistItemResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getBetaClientWithChecklist(id: number) {
  const [client] = await db
    .select()
    .from(betaClientsTable)
    .where(eq(betaClientsTable.id, id));

  if (!client) return null;

  const checklist = await db
    .select()
    .from(betaClientChecklistTable)
    .where(eq(betaClientChecklistTable.betaClientId, id))
    .orderBy(asc(betaClientChecklistTable.displayOrder));

  return {
    ...client,
    createdAt: client.createdAt.toISOString(),
    stateRegistrations: client.stateRegistrations ?? [],
    contactName: client.contactName ?? null,
    email: client.email ?? null,
    whatsapp: client.whatsapp ?? null,
    city: client.city ?? null,
    state: client.state ?? null,
    desiredPlan: client.desiredPlan ?? null,
    notes: client.notes ?? null,
    checklist,
  };
}

router.get("/beta-clients", async (req, res): Promise<void> => {
  const clients = await db
    .select()
    .from(betaClientsTable)
    .orderBy(asc(betaClientsTable.code));

  const result = await Promise.all(
    clients.map(async (c) => {
      const checklist = await db
        .select()
        .from(betaClientChecklistTable)
        .where(eq(betaClientChecklistTable.betaClientId, c.id))
        .orderBy(asc(betaClientChecklistTable.displayOrder));

      return {
        ...c,
        createdAt: c.createdAt.toISOString(),
        stateRegistrations: c.stateRegistrations ?? [],
        contactName: c.contactName ?? null,
        email: c.email ?? null,
        whatsapp: c.whatsapp ?? null,
        city: c.city ?? null,
        state: c.state ?? null,
        desiredPlan: c.desiredPlan ?? null,
        notes: c.notes ?? null,
        checklist,
      };
    })
  );

  res.json(ListBetaClientsResponse.parse(result));
});

router.post("/beta-clients", async (req, res): Promise<void> => {
  const parsed = CreateBetaClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { stateRegistrations, ...rest } = parsed.data;

  const [client] = await db
    .insert(betaClientsTable)
    .values({ ...rest, stateRegistrations: stateRegistrations ?? [] })
    .returning();

  const full = await getBetaClientWithChecklist(client.id);
  res.status(201).json(GetBetaClientResponse.parse(full));
});

router.get("/beta-clients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetBetaClientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const full = await getBetaClientWithChecklist(params.data.id);
  if (!full) {
    res.status(404).json({ error: "Cliente beta não encontrado" });
    return;
  }

  res.json(GetBetaClientResponse.parse(full));
});

router.patch("/beta-clients/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateBetaClientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const body = UpdateBetaClientBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  await db
    .update(betaClientsTable)
    .set(body.data)
    .where(eq(betaClientsTable.id, params.data.id));

  const full = await getBetaClientWithChecklist(params.data.id);
  if (!full) {
    res.status(404).json({ error: "Cliente beta não encontrado" });
    return;
  }

  res.json(UpdateBetaClientResponse.parse(full));
});

router.patch(
  "/beta-clients/:id/checklist/:itemId",
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const rawItem = Array.isArray(req.params.itemId)
      ? req.params.itemId[0]
      : req.params.itemId;

    const params = UpdateBetaClientChecklistItemParams.safeParse({
      id: parseInt(rawId, 10),
      itemId: parseInt(rawItem, 10),
    });
    if (!params.success) {
      res.status(400).json({ error: "Parâmetros inválidos" });
      return;
    }

    const body = UpdateBetaClientChecklistItemBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [updated] = await db
      .update(betaClientChecklistTable)
      .set({ completed: body.data.completed })
      .where(eq(betaClientChecklistTable.id, params.data.itemId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Item de checklist não encontrado" });
      return;
    }

    res.json(UpdateBetaClientChecklistItemResponse.parse(updated));
  }
);

export default router;
