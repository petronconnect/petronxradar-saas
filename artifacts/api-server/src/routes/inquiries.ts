import { Router, type IRouter } from "express";
import { db, inquiriesTable, clientsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import {
  ListInquiriesResponse,
  GetInquiryResponse,
  CreateInquiryBody,
  GetInquiryParams,
  ConvertInquiryToClientParams,
  ConvertInquiryToClientResponse,
  UpdateInquiryStatusParams,
  UpdateInquiryStatusBody,
  UpdateInquiryStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function computeLeadScore(data: {
  hasPetrobrasRegistration: boolean;
  interestedInBidding: boolean;
  operationalVolume: string;
  desiredPlan: string;
  allowContact: boolean;
}): number {
  let score = 40;
  if (data.hasPetrobrasRegistration) score += 20;
  if (data.interestedInBidding) score += 10;
  if (data.allowContact) score += 10;
  if (data.desiredPlan === "radar-enterprise" || data.desiredPlan === "radar-ia-managed") score += 15;
  else if (data.desiredPlan === "radar-pro") score += 8;
  if (data.operationalVolume === "grande") score += 10;
  else if (data.operationalVolume === "medio") score += 5;
  return Math.min(100, score);
}

function recommendPlan(data: {
  desiredPlan: string;
  hasPetrobrasRegistration: boolean;
  operationalVolume: string;
}): string {
  if (data.desiredPlan && data.desiredPlan !== "nao-sei") return data.desiredPlan;
  if (data.operationalVolume === "grande" || data.hasPetrobrasRegistration) return "radar-enterprise";
  if (data.operationalVolume === "medio") return "radar-pro";
  return "radar-starter";
}

function formatInquiry(i: typeof inquiriesTable.$inferSelect) {
  return {
    ...i,
    createdAt: i.createdAt.toISOString(),
    availableDocuments: i.availableDocuments ?? null,
    notes: i.notes ?? null,
    convertedClientId: i.convertedClientId ?? null,
  };
}

router.get("/inquiries", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(inquiriesTable)
    .orderBy(desc(inquiriesTable.createdAt));

  res.json(ListInquiriesResponse.parse(rows.map(formatInquiry)));
});

router.post("/inquiries", async (req, res): Promise<void> => {
  const parsed = CreateInquiryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;
  const leadScore = computeLeadScore(d);
  const recommendedPlan = recommendPlan(d);

  const [row] = await db
    .insert(inquiriesTable)
    .values({
      ...d,
      leadScore,
      recommendedPlan,
      status: "novo",
      source: "formulario-web",
    })
    .returning();

  res.status(201).json(GetInquiryResponse.parse(formatInquiry(row)));
});

router.get("/inquiries/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetInquiryParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [row] = await db
    .select()
    .from(inquiriesTable)
    .where(eq(inquiriesTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Inquiry não encontrado" });
    return;
  }

  res.json(GetInquiryResponse.parse(formatInquiry(row)));
});

router.post("/inquiries/:id/convert", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ConvertInquiryToClientParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [inquiry] = await db
    .select()
    .from(inquiriesTable)
    .where(eq(inquiriesTable.id, params.data.id));

  if (!inquiry) {
    res.status(404).json({ error: "Inquiry não encontrado" });
    return;
  }

  if (inquiry.convertedClientId) {
    res.status(400).json({ error: "Lead já convertido em cliente" });
    return;
  }

  const planMap: Record<string, string> = {
    "radar-starter": "Radar Starter",
    "radar-pro": "Radar Pro",
    "radar-enterprise": "Radar Enterprise",
    "radar-ia-managed": "Radar IA Managed",
  };

  const planName = planMap[inquiry.recommendedPlan] ?? "Radar Pro";

  const [client] = await db
    .insert(clientsTable)
    .values({
      name: inquiry.contactName,
      company: inquiry.companyName,
      segment: inquiry.segment,
      plan: planName,
      status: "ativo",
      email: inquiry.email,
      phone: inquiry.whatsapp,
    })
    .returning();

  await db
    .update(inquiriesTable)
    .set({ status: "convertido", convertedClientId: client.id })
    .where(eq(inquiriesTable.id, params.data.id));

  res.json(
    ConvertInquiryToClientResponse.parse({
      ...client,
      createdAt: client.createdAt.toISOString(),
      email: client.email ?? null,
      phone: client.phone ?? null,
    })
  );
});

router.patch("/inquiries/:id/status", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateInquiryStatusParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const body = UpdateInquiryStatusBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Partial<typeof inquiriesTable.$inferInsert> = {
    status: body.data.status,
  };
  if (body.data.recommendedPlan) {
    updateData.recommendedPlan = body.data.recommendedPlan;
  }

  const [updated] = await db
    .update(inquiriesTable)
    .set(updateData)
    .where(eq(inquiriesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Inquiry não encontrado" });
    return;
  }

  res.json(UpdateInquiryStatusResponse.parse(formatInquiry(updated)));
});

export default router;
