import { Router, type IRouter } from "express";
import { db, opportunitiesTable, bulletinsTable, clientsTable } from "@workspace/db";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import {
  GetDashboardSummaryResponse,
  GetDashboardRecentActivityResponse,
  SearchDashboardQueryParams,
  SearchDashboardResponse,
  GetDashboardSectorBreakdownResponse,
} from "@workspace/api-zod";
import { calculateRadarScore } from "../lib/radar-score";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const classifiedSectorPredicate = sql`
  lower(trim(coalesce(${opportunitiesTable.sector}, ''))) not in (
    '', 'não informado', 'nao informado', 'não informado(a)', 'nao informado(a)',
    'sem setor', 'sem classificação', 'sem classificacao', 'não classificado', 'nao classificado'
  )
`;

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const user = req.session.user!;
  const [oppCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(opportunitiesTable);
  const [bulCount] = user.role === "ADMIN_PETRON"
    ? await db.select({ count: sql<number>`count(*)::int` }).from(bulletinsTable)
    : await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bulletinsTable)
        .where(or(isNull(bulletinsTable.companyId), eq(bulletinsTable.companyId, user.companyId)));
  const [clientCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clientsTable);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [oppMonth] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(opportunitiesTable)
    .where(sql`${opportunitiesTable.createdAt} >= ${startOfMonth}`);
  const [bulMonth] = user.role === "ADMIN_PETRON"
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bulletinsTable)
        .where(sql`${bulletinsTable.publishedAt} >= ${startOfMonth}`)
    : await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bulletinsTable)
        .where(
          and(
            sql`${bulletinsTable.publishedAt} >= ${startOfMonth}`,
            or(isNull(bulletinsTable.companyId), eq(bulletinsTable.companyId, user.companyId)),
          ),
        );

  const [sectorCoverage] = await db
    .select({
      classifiedOpportunities: sql<number>`count(*) filter (where ${classifiedSectorPredicate})::int`,
      classifiedSectors: sql<number>`count(distinct ${opportunitiesTable.sector}) filter (where ${classifiedSectorPredicate})::int`,
    })
    .from(opportunitiesTable);

  const totalOpp = oppCount?.count ?? 0;
  const oppThisMonth = oppMonth?.count ?? 0;

  // Volume (40) + atividade mensal (30) + diversidade (30),
  // ponderando a parcela de oportunidades com setor realmente informado.
  const radarScore = calculateRadarScore({
    totalOpportunities: totalOpp,
    opportunitiesThisMonth: oppThisMonth,
    classifiedOpportunities: sectorCoverage?.classifiedOpportunities ?? 0,
    classifiedSectors: sectorCoverage?.classifiedSectors ?? 0,
  });

  const summary = {
    totalOpportunities: totalOpp,
    totalBulletins: bulCount?.count ?? 0,
    totalClients: user.role === "ADMIN_PETRON" ? clientCount?.count ?? 0 : 0,
    opportunitiesThisMonth: oppThisMonth,
    bulletinsThisMonth: bulMonth?.count ?? 0,
    radarScore,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/dashboard/recent-activity", requireAuth, async (req, res): Promise<void> => {
  const user = req.session.user!;
  const recentOpp = await db
    .select()
    .from(opportunitiesTable)
    .orderBy(desc(opportunitiesTable.createdAt))
    .limit(50);
  const recentBul = user.role === "ADMIN_PETRON"
    ? await db
        .select()
        .from(bulletinsTable)
        .orderBy(desc(bulletinsTable.publishedAt))
        .limit(50)
    : await db
        .select()
        .from(bulletinsTable)
        .where(or(isNull(bulletinsTable.companyId), eq(bulletinsTable.companyId, user.companyId)))
        .orderBy(desc(bulletinsTable.publishedAt))
        .limit(50);

  const items = [
    ...recentOpp.map((o) => ({
      id: o.id,
      type: "opportunity",
      title: o.title,
      description: `Nova oportunidade em ${o.sector} — ${o.company}`,
      createdAt: o.createdAt.toISOString(),
      reference: o.petronectId ?? null,
    })),
    ...recentBul.map((b) => ({
      id: b.id + 10000,
      type: "bulletin",
      title: b.title,
      description: `Boletim publicado por ${b.author} em ${b.category}`,
      createdAt: b.publishedAt.toISOString(),
      reference: null,
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.json(GetDashboardRecentActivityResponse.parse(items.slice(0, 50)));
});

router.get("/dashboard/search", requireAuth, async (req, res): Promise<void> => {
  const params = SearchDashboardQueryParams.safeParse(req.query);
  if (!params.success || params.data.q.trim().length < 2) {
    res.status(400).json({ error: "Informe ao menos 2 caracteres para buscar." });
    return;
  }

  const user = req.session.user!;
  const escapedTerm = params.data.q.trim().replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escapedTerm}%`;
  const bulletinTextMatch = or(
    ilike(bulletinsTable.title, pattern),
    ilike(bulletinsTable.category, pattern),
    ilike(bulletinsTable.summary, pattern),
  );

  const [opportunities, bulletins, clients] = await Promise.all([
    db
      .select({
        id: opportunitiesTable.id,
        title: opportunitiesTable.title,
        sector: opportunitiesTable.sector,
        company: opportunitiesTable.company,
        reference: opportunitiesTable.petronectId,
        createdAt: opportunitiesTable.createdAt,
      })
      .from(opportunitiesTable)
      .where(
        or(
          ilike(opportunitiesTable.title, pattern),
          ilike(opportunitiesTable.company, pattern),
          ilike(opportunitiesTable.sector, pattern),
          ilike(opportunitiesTable.petronectId, pattern),
        ),
      )
      .orderBy(desc(opportunitiesTable.createdAt))
      .limit(6),
    user.role === "ADMIN_PETRON"
      ? db
          .select({
            id: bulletinsTable.id,
            title: bulletinsTable.title,
            category: bulletinsTable.category,
            createdAt: bulletinsTable.publishedAt,
          })
          .from(bulletinsTable)
          .where(bulletinTextMatch)
          .orderBy(desc(bulletinsTable.publishedAt))
          .limit(6)
      : db
          .select({
            id: bulletinsTable.id,
            title: bulletinsTable.title,
            category: bulletinsTable.category,
            createdAt: bulletinsTable.publishedAt,
          })
          .from(bulletinsTable)
          .where(
            and(
              or(isNull(bulletinsTable.companyId), eq(bulletinsTable.companyId, user.companyId)),
              bulletinTextMatch,
            ),
          )
          .orderBy(desc(bulletinsTable.publishedAt))
          .limit(6),
    user.role === "ADMIN_PETRON"
      ? db
          .select({
            id: clientsTable.id,
            title: clientsTable.company,
            segment: clientsTable.segment,
            createdAt: clientsTable.createdAt,
          })
          .from(clientsTable)
          .where(
            or(
              ilike(clientsTable.company, pattern),
              ilike(clientsTable.segment, pattern),
            ),
          )
          .orderBy(desc(clientsTable.createdAt))
          .limit(6)
      : Promise.resolve([]),
  ]);

  const results = [
    ...opportunities.map((item) => ({
      id: item.id,
      type: "opportunity" as const,
      title: item.title,
      subtitle: `${item.sector} · ${item.company}`,
      reference: item.reference,
      createdAt: item.createdAt.toISOString(),
    })),
    ...bulletins.map((item) => ({
      id: item.id,
      type: "bulletin" as const,
      title: item.title,
      subtitle: item.category,
      reference: null,
      createdAt: item.createdAt.toISOString(),
    })),
    ...clients.map((item) => ({
      id: item.id,
      type: "client" as const,
      title: item.title,
      subtitle: item.segment,
      reference: null,
      createdAt: item.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  res.json(SearchDashboardResponse.parse(results));
});

router.get("/dashboard/sector-breakdown", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      sector: opportunitiesTable.sector,
      count: sql<number>`count(*)::int`,
    })
    .from(opportunitiesTable)
    .groupBy(opportunitiesTable.sector)
    .orderBy(sql`count(*) desc`);

  const total = rows.reduce((sum, r) => sum + r.count, 0) || 1;

  const breakdown = rows.map((r) => ({
    sector: r.sector,
    count: r.count,
    percentage: Math.round((r.count / total) * 100),
  }));

  res.json(GetDashboardSectorBreakdownResponse.parse(breakdown));
});

export default router;
