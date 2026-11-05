import { Router, type IRouter } from "express";
import { db, petroconnectConfigTable, petroconnectSyncLogTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  GetPetroconnectStatusResponse,
  ConnectPetroconnectBody,
  ConnectPetroconnectResponse,
  TriggerPetroconnectSyncBody,
  TriggerPetroconnectSyncResponse,
  GetPetroconnectSyncLogResponse,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../lib/auth";

const router: IRouter = Router();
router.use(requireAuth, requireAdmin);

async function getOrCreateConfig() {
  const rows = await db.select().from(petroconnectConfigTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [row] = await db.insert(petroconnectConfigTable).values({}).returning();
  return row;
}

function formatStatus(cfg: typeof petroconnectConfigTable.$inferSelect) {
  return {
    connected: cfg.connected,
    status: cfg.connected ? "conectado" : "desconectado",
    lastSyncAt: cfg.lastSyncAt ? cfg.lastSyncAt.toISOString() : null,
    syncedClients: cfg.syncedClients,
    syncedOpportunities: cfg.syncedOpportunities,
    syncedDocuments: cfg.syncedDocuments,
    syncedBulletins: cfg.syncedBulletins,
    accountId: cfg.accountId ?? null,
    accountName: cfg.accountName ?? null,
  };
}

router.get("/petroconnect/status", async (req, res): Promise<void> => {
  res.json(GetPetroconnectStatusResponse.parse({
    connected: false, status: "não configurado", lastSyncAt: null,
    syncedClients: 0, syncedOpportunities: 0, syncedDocuments: 0, syncedBulletins: 0,
    accountId: null, accountName: null,
  }));
});

router.post("/petroconnect/connect", async (_req, res): Promise<void> => {
  res.status(409).json({ error: "Conexão direta não está disponível. Use a importação assistida de dados públicos." });
});

router.post("/petroconnect/sync", async (_req, res): Promise<void> => {
  res.status(409).json({ error: "A sincronização automática não está configurada. Importe uma exportação pública aprovada." });
});

router.get("/petroconnect/sync-log", async (req, res): Promise<void> => {
  res.json(GetPetroconnectSyncLogResponse.parse([]));
});

export default router;
