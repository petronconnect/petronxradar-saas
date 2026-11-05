import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import express, { Router, type Request, type Response } from "express";
import {
  ApplyRadar360ImportParams,
  CompleteRadar360FileUploadParams,
  CreateRadar360ProfileBody,
  CreateRadar360RunBody,
  DownloadRadar360FileParams,
  GetRadar360RunParams,
  LinkRadar360ProfileBody,
  LinkRadar360ProfileParams,
  ListRadar360FilesQueryParams,
  ListRadar360EventsQueryParams,
  ListRadar360ImportsQueryParams,
  ListRadar360RunsQueryParams,
  PreviewRadar360ImportQueryParams,
  PublishRadar360RunParams,
  RequestRadar360FileUploadBody,
  ResumeRadar360RunParams,
  UpdateRadar360ProfileBody,
  UpdateRadar360ProfileParams,
  VerifyRadar360CapabilityFileBody,
  VerifyRadar360CapabilityFileParams,
} from "@workspace/api-zod";
import { db, sql } from "@workspace/db";
import type { Radar360Profile } from "@workspace/db";
import { requireAdmin, requireAuth } from "../lib/auth";
import { canAccessRadar360Company, canManageRadar360Profile } from "../lib/radar360-access";
import {
  evaluateAndLimitCandidates,
  escapeXml,
  getHistoricalRadar360Profiles,
  normalizeText,
  parseRadar360Csv,
  profileMissingFields,
  RADAR360_SCORE_VERSION,
  RADAR360_SCORE_WEIGHTS,
  renderRadar360Svg,
  renderRadar360Text,
  type EvaluatedRadar360Item,
  type Radar360Candidate,
} from "../lib/radar360-engine";
import { objectStorageService } from "../lib/objectStorage";

const router = Router();
const IMAGE_LIMIT_BYTES = 4 * 1024 * 1024;
const DOCUMENT_LIMIT_BYTES = 20 * 1024 * 1024;
const MAX_SOURCE_ROWS = 5000;
const CLIENT_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type Row = Record<string, unknown>;
type SessionActor = NonNullable<Request["session"]["user"]>;
type CompanyOption = {
  id: number;
  name: string;
  legalName: string;
  segment: string;
  accountStatus: string;
  subscriptionStatus: string;
  hasActiveClientUser: boolean;
};

function rows<T extends Row = Row>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asNullableNumber(value: unknown): number | null {
  return value == null ? null : asNumber(value);
}

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asNullableString(value: unknown): string | null {
  return value == null || value === "" ? null : String(value);
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function jsonValue(value: unknown): string {
  return JSON.stringify(value ?? []);
}

function normalizeList(value: string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))].slice(0, 100);
}

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ error });
}

function safeFailureMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  const code = message.match(/\b(?:HTTP|status)\s*[:=]?\s*(\d{3})\b/i)?.[1];
  return code ? `${fallback} Código HTTP ${code}.` : fallback;
}

async function recordEvent(input: {
  profileId: number;
  actorId: number;
  eventType: string;
  status: "pending" | "success" | "failure";
  message: string;
  runId?: number | null;
  importId?: number | null;
}) {
  try {
    await db.execute(sql`
      INSERT INTO radar360_events (profile_id, run_id, import_id, event_type, status, message, actor_id)
      VALUES (
        ${input.profileId}, ${input.runId ?? null}, ${input.importId ?? null},
        ${input.eventType}, ${input.status}, ${input.message.slice(0, 400)}, ${input.actorId}
      )
    `);
  } catch {
    console.error("Radar360 event history could not be persisted.", { eventType: input.eventType, profileId: input.profileId });
  }
}

function getActor(req: Request): SessionActor {
  return req.session.user!;
}

function parseIdParams<T extends { id: number }>(
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  rawId: string,
): T | null {
  const parsed = schema.safeParse({ id: Number(rawId) });
  return parsed.success ? parsed.data ?? null : null;
}

async function getCompanyOptions(): Promise<CompanyOption[]> {
  const result = await db.execute(sql`
    SELECT
      ca.id,
      ca.nome_fantasia AS name,
      ca.razao_social AS "legalName",
      ca.segmento AS segment,
      ca.status AS "accountStatus",
      COALESCE(s.status, 'não cadastrada') AS "subscriptionStatus",
      EXISTS (
        SELECT 1 FROM company_users cu
        WHERE cu.company_id = ca.id
          AND cu.ativo = true
          AND cu.role IN ('CLIENTE_ADMIN', 'USUARIO_CLIENTE')
      ) AS "hasActiveClientUser"
    FROM company_accounts ca
    LEFT JOIN subscriptions s ON s.company_id = ca.id
    WHERE COALESCE(ca.segmento, '') NOT ILIKE '%operadora%'
    ORDER BY ca.nome_fantasia
  `);
  return rows(result).map((row) => ({
    id: asNumber(row.id),
    name: asString(row.name),
    legalName: asString(row.legalName),
    segment: asString(row.segment),
    accountStatus: asString(row.accountStatus),
    subscriptionStatus: asString(row.subscriptionStatus),
    hasActiveClientUser: row.hasActiveClientUser === true,
  }));
}

async function getProfileRow(id: number): Promise<Row | null> {
  const result = await db.execute(sql`
    SELECT
      p.*,
      ca.nome_fantasia AS company_name,
      (
        SELECT f.id FROM radar360_files f
        WHERE f.profile_id = p.id AND f.kind = 'logo' AND f.status IN ('ready', 'verified')
        ORDER BY f.created_at DESC LIMIT 1
      ) AS logo_file_id
    FROM radar360_profiles p
    LEFT JOIN company_accounts ca ON ca.id = p.company_id
    WHERE p.id = ${id}
    LIMIT 1
  `);
  return rows(result)[0] ?? null;
}

function profileFromRow(row: Row): Radar360Profile {
  return {
    id: asNumber(row.id),
    referenceKey: asString(row.reference_key),
    companyId: asNullableNumber(row.company_id),
    candidateCompanyId: asNullableNumber(row.candidate_company_id),
    displayName: asString(row.display_name),
    aliases: asArray(row.aliases),
    focusAreas: asArray(row.focus_areas),
    declaredCapabilities: asArray(row.declared_capabilities),
    verifiedCapabilities: asArray(row.verified_capabilities),
    regions: asArray(row.regions),
    keywords: asArray(row.keywords),
    exclusions: asArray(row.exclusions),
    exclusionsReviewed: row.exclusions_reviewed === true,
    profileStatus: asString(row.profile_status) === "ready" ? "ready" : "incomplete",
    reconciliationStatus: asString(row.reconciliation_status) as Radar360Profile["reconciliationStatus"],
    cadence: asString(row.cadence) as Radar360Profile["cadence"],
    scheduleEnabled: false,
    createdBy: asNullableNumber(row.created_by),
    updatedBy: asNullableNumber(row.updated_by),
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  } as Radar360Profile;
}

function profileDto(row: Row, accountOptions: CompanyOption[] = []) {
  const profile = profileFromRow(row);
  const linked = profile.companyId != null;
  const aliases = [profile.displayName, ...profile.aliases].map(normalizeText).filter(Boolean);
  const candidate = linked ? null : accountOptions.find((account) =>
    aliases.includes(normalizeText(account.name)) || aliases.includes(normalizeText(account.legalName)),
  );
  const missingFields = profileMissingFields(profile, linked);
  return {
    id: profile.id,
    referenceKey: profile.referenceKey,
    companyId: profile.companyId,
    candidateCompanyId: candidate?.id ?? null,
    companyName: asNullableString(row.company_name),
    displayName: profile.displayName,
    aliases: profile.aliases,
    focusAreas: profile.focusAreas,
    declaredCapabilities: profile.declaredCapabilities,
    verifiedCapabilities: profile.verifiedCapabilities,
    regions: profile.regions,
    keywords: profile.keywords,
    exclusions: profile.exclusions,
    exclusionsReviewed: profile.exclusionsReviewed,
    profileStatus: missingFields.length === 0 ? "ready" : "incomplete",
    reconciliationStatus: linked ? "linked" : candidate ? "suggested" : "pending",
    cadence: profile.cadence,
    scheduleEnabled: false,
    missingFields,
    logoFileId: asNullableNumber(row.logo_file_id),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

async function getProfilesForActor(actor: SessionActor): Promise<Row[]> {
  const result = actor.role === "ADMIN_PETRON"
    ? await db.execute(sql`
        SELECT p.*, ca.nome_fantasia AS company_name,
          (SELECT f.id FROM radar360_files f WHERE f.profile_id = p.id AND f.kind='logo'
            AND f.status IN ('ready','verified') ORDER BY f.created_at DESC LIMIT 1) AS logo_file_id
        FROM radar360_profiles p LEFT JOIN company_accounts ca ON ca.id=p.company_id
        ORDER BY p.created_at DESC, p.id DESC
      `)
    : await db.execute(sql`
        SELECT p.*, ca.nome_fantasia AS company_name,
          (SELECT f.id FROM radar360_files f WHERE f.profile_id = p.id AND f.kind='logo'
            AND f.status IN ('ready','verified') ORDER BY f.created_at DESC LIMIT 1) AS logo_file_id
        FROM radar360_profiles p LEFT JOIN company_accounts ca ON ca.id=p.company_id
        WHERE p.company_id = ${actor.companyId}
        ORDER BY p.created_at DESC, p.id DESC
      `);
  return rows(result);
}

async function requireProfileAccess(
  profileId: number,
  actor: SessionActor,
  res: Response,
  manage = false,
): Promise<Row | null> {
  const profile = await getProfileRow(profileId);
  if (!profile) {
    fail(res, 404, "Perfil não encontrado.");
    return null;
  }
  const ownerCompanyId = asNullableNumber(profile.company_id);
  const allowed = manage
    ? canManageRadar360Profile(ownerCompanyId, actor)
    : canAccessRadar360Company(ownerCompanyId, actor);
  if (!allowed) {
    fail(res, 404, "Perfil não encontrado.");
    return null;
  }
  return profile;
}

async function requireRunAccess(runId: number, actor: SessionActor, res: Response): Promise<Row | null> {
  const result = await db.execute(sql`SELECT * FROM radar360_runs WHERE id=${runId} LIMIT 1`);
  const run = rows(result)[0];
  if (!run) {
    fail(res, 404, "Edição não encontrada.");
    return null;
  }
  const profile = await getProfileRow(asNumber(run.profile_id));
  if (!profile || !canAccessRadar360Company(asNullableNumber(profile.company_id), actor)) {
    fail(res, 404, "Edição não encontrada.");
    return null;
  }
  return run;
}

function companyMatchForProfile(profile: Row, accounts: CompanyOption[]) {
  const aliases = [asString(profile.display_name), ...asArray(profile.aliases)].map(normalizeText).filter(Boolean);
  return accounts.filter((account) =>
    aliases.includes(normalizeText(account.name)) || aliases.includes(normalizeText(account.legalName)),
  );
}

router.use("/radar360", requireAuth);

router.get("/radar360/profiles", async (req, res) => {
  const actor = getActor(req);
  const [profiles, accounts] = await Promise.all([getProfilesForActor(actor), getCompanyOptions()]);
  const linkedCompanyIds = new Set(profiles.map((profile) => asNullableNumber(profile.company_id)).filter((id): id is number => id != null));
  const availableAccounts = accounts.filter((account) => !linkedCompanyIds.has(account.id));
  res.json(profiles.map((profile) => profileDto(profile, availableAccounts)));
});

router.post("/radar360/profiles/bootstrap", requireAdmin, async (_req, res) => {
  let insertedCount = 0;
  for (const reference of getHistoricalRadar360Profiles()) {
    const result = await db.execute(sql`
      INSERT INTO radar360_profiles (
        reference_key, display_name, aliases, focus_areas, declared_capabilities, keywords, exclusions,
        profile_status, reconciliation_status, cadence, schedule_enabled
      ) VALUES (
        ${reference.referenceKey}, ${reference.displayName}, ${jsonValue(reference.aliases)}::jsonb,
        ${jsonValue(reference.focusAreas)}::jsonb, ${jsonValue(reference.declaredCapabilities)}::jsonb,
        ${jsonValue(reference.keywords)}::jsonb, ${jsonValue(reference.exclusions)}::jsonb,
        'incomplete', 'pending', 'manual', false
      )
      ON CONFLICT (reference_key) DO NOTHING
      RETURNING id
    `);
    if (rows(result).length) insertedCount += 1;
  }
  const [profiles, accounts] = await Promise.all([getProfilesForActor(getActor(_req)), getCompanyOptions()]);
  return res.json({ insertedCount, profiles: profiles.map((profile) => profileDto(profile, accounts)) });
});

router.get("/radar360/reconciliation", requireAdmin, async (_req, res) => {
  const [accounts, profileResult, legacyResult] = await Promise.all([
    getCompanyOptions(),
    db.execute(sql`SELECT * FROM radar360_profiles ORDER BY display_name`),
    db.execute(sql`SELECT company, segment, status FROM clients ORDER BY company`),
  ]);
  const profiles = rows(profileResult);
  const legacyRecords = rows(legacyResult);
  const linkedCompanyIds = new Set(profiles.map((profile) => asNullableNumber(profile.company_id)).filter((id): id is number => id != null));
  const unlinkedAccounts = accounts.filter((account) => !linkedCompanyIds.has(account.id));
  return res.json({
    accounts,
    references: profiles.map((profile) => ({
      profileId: asNumber(profile.id),
      displayName: asString(profile.display_name),
      reconciliationStatus: asNullableNumber(profile.company_id) ? "linked" : companyMatchForProfile(profile, unlinkedAccounts).length ? "suggested" : "pending",
      candidateAccounts: asNullableNumber(profile.company_id) ? [] : companyMatchForProfile(profile, unlinkedAccounts),
      legacyRecords: legacyRecords.filter((legacy) => {
        const aliases = [asString(profile.display_name), ...asArray(profile.aliases)].map(normalizeText);
        return aliases.includes(normalizeText(asString(legacy.company)));
      }).map((legacy) => ({
        company: asString(legacy.company),
        segment: asString(legacy.segment),
        status: asString(legacy.status),
      })),
    })),
  });
});

router.post("/radar360/profiles", requireAdmin, async (req, res) => {
  const parsed = CreateRadar360ProfileBody.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Empresa inválida.");
  const companyResult = await db.execute(sql`
    SELECT id, nome_fantasia FROM company_accounts
    WHERE id=${parsed.data.companyId} AND COALESCE(segmento,'') NOT ILIKE '%operadora%' LIMIT 1
  `);
  const company = rows(companyResult)[0];
  if (!company) return fail(res, 404, "Empresa cliente não encontrada.");
  const selectedAccount = (await getCompanyOptions()).find((account) => account.id === parsed.data.companyId);
  if (!selectedAccount) return fail(res, 404, "Empresa cliente não encontrada.");
  const unlinkedProfiles = rows(await db.execute(sql`SELECT display_name, aliases FROM radar360_profiles WHERE company_id IS NULL`));
  const hasHistoricalMatch = unlinkedProfiles.some((reference) =>
    companyMatchForProfile(reference, [selectedAccount]).length > 0,
  );
  if (hasHistoricalMatch) {
    return fail(res, 409, "Esta conta corresponde a uma referência histórica. Revise e vincule o perfil existente em vez de criar outro.");
  }
  const result = await db.execute(sql`
    INSERT INTO radar360_profiles (reference_key, company_id, display_name, aliases, created_by, updated_by)
    VALUES (
      ${`company-${parsed.data.companyId}`}, ${parsed.data.companyId}, ${asString(company.nome_fantasia)},
      ${jsonValue([asString(company.nome_fantasia)])}::jsonb, ${getActor(req).id}, ${getActor(req).id}
    )
    ON CONFLICT (company_id) DO NOTHING
    RETURNING id
  `);
  let id = asNumber(rows(result)[0]?.id);
  if (!id) {
    const existing = rows(await db.execute(sql`SELECT id FROM radar360_profiles WHERE company_id=${parsed.data.companyId} LIMIT 1`))[0];
    id = asNumber(existing?.id);
  }
  const profile = await getProfileRow(id);
  if (!profile) return fail(res, 500, "Não foi possível criar o perfil.");
  return res.status(rows(result).length ? 201 : 200).json(profileDto(profile, await getCompanyOptions()));
});

router.patch("/radar360/profiles/:id", async (req, res) => {
  const params = UpdateRadar360ProfileParams.safeParse({ id: Number(req.params.id) });
  const parsed = UpdateRadar360ProfileBody.safeParse(req.body);
  if (!params.success || !parsed.success) return fail(res, 400, "Dados do perfil inválidos.");
  const actor = getActor(req);
  const profile = await requireProfileAccess(params.data.id, actor, res, true);
  if (!profile) return;
  const body = parsed.data;
  const displayName = actor.role === "ADMIN_PETRON" ? body.displayName ?? null : null;
  const updated = await db.execute(sql`
    UPDATE radar360_profiles SET
      display_name = COALESCE(${displayName}, display_name),
      aliases = COALESCE(${body.aliases === undefined ? null : jsonValue(normalizeList(body.aliases))}::jsonb, aliases),
      focus_areas = COALESCE(${body.focusAreas === undefined ? null : jsonValue(normalizeList(body.focusAreas))}::jsonb, focus_areas),
      declared_capabilities = COALESCE(${body.declaredCapabilities === undefined ? null : jsonValue(normalizeList(body.declaredCapabilities))}::jsonb, declared_capabilities),
      regions = COALESCE(${body.regions === undefined ? null : jsonValue(normalizeList(body.regions))}::jsonb, regions),
      keywords = COALESCE(${body.keywords === undefined ? null : jsonValue(normalizeList(body.keywords))}::jsonb, keywords),
      exclusions = COALESCE(${body.exclusions === undefined ? null : jsonValue(normalizeList(body.exclusions))}::jsonb, exclusions),
      exclusions_reviewed = COALESCE(${body.exclusionsReviewed ?? null}, exclusions_reviewed),
      cadence = COALESCE(${body.cadence ?? null}, cadence),
      schedule_enabled = false,
      updated_by = ${actor.id},
      updated_at = NOW()
    WHERE id = ${params.data.id}
    RETURNING id
  `);
  if (!rows(updated).length) return fail(res, 404, "Perfil não encontrado.");
  const latest = await getProfileRow(params.data.id);
  return res.json(profileDto(latest!, await getCompanyOptions()));
});

router.post("/radar360/profiles/:id/link", requireAdmin, async (req, res) => {
  const params = LinkRadar360ProfileParams.safeParse({ id: Number(req.params.id) });
  const body = LinkRadar360ProfileBody.safeParse(req.body);
  if (!params.success || !body.success) return fail(res, 400, "Vínculo inválido.");
  const profile = await getProfileRow(params.data.id);
  if (!profile) return fail(res, 404, "Perfil não encontrado.");
  const companyResult = await db.execute(sql`
    SELECT id, nome_fantasia FROM company_accounts
    WHERE id=${body.data.companyId} AND COALESCE(segmento,'') NOT ILIKE '%operadora%' LIMIT 1
  `);
  const company = rows(companyResult)[0];
  if (!company) return fail(res, 404, "Empresa cliente não encontrada.");
  const existing = rows(await db.execute(sql`
    SELECT id FROM radar360_profiles WHERE company_id=${body.data.companyId} AND id<>${params.data.id} LIMIT 1
  `))[0];
  if (existing) return fail(res, 409, "Esta empresa já possui um perfil Radar 360. Nenhum dado foi fundido.");
  try {
    await db.execute(sql`
      UPDATE radar360_profiles SET
        company_id=${body.data.companyId},
        candidate_company_id=NULL,
        display_name=${asString(company.nome_fantasia)},
        reconciliation_status='linked',
        updated_by=${getActor(req).id},
        updated_at=NOW()
      WHERE id=${params.data.id}
    `);
  } catch {
    return fail(res, 409, "O vínculo não foi concluído; verifique se a empresa já tem outro perfil.");
  }
  const latest = await getProfileRow(params.data.id);
  return res.json(profileDto(latest!, await getCompanyOptions()));
});

router.get("/radar360/source-status", async (req, res) => {
  const actor = getActor(req);
  const profiles = await getProfilesForActor(actor);
  const profileIds = profiles.map((profile) => asNumber(profile.id));
  const catalogCount = asNumber(rows(await db.execute(sql`SELECT COUNT(*)::int AS count FROM opportunities`))[0]?.count);
  const publicCount = asNumber(rows(await db.execute(sql`SELECT COUNT(*)::int AS count FROM petronect_public_opportunities`))[0]?.count);
  const publicLastRun = rows(await db.execute(sql`
    SELECT status, created_at FROM petronect_public_import_runs ORDER BY created_at DESC LIMIT 1
  `))[0];
  const importCounts = profileIds.length
    ? rows(await db.execute(sql`
        SELECT COUNT(*)::int AS count, MAX(created_at) AS latest
        FROM radar360_imports
        WHERE profile_id = ANY(${profileIds}::int[])
      `))[0]
    : { count: 0, latest: null };
  const importCount = asNumber(importCounts?.count);
  const latestImport = importCounts?.latest ?? null;
  const publicStatus = asString(publicLastRun?.status);
  return res.json([
    {
      kind: "catalog",
      label: "Catálogo interno do Petron Radar",
      status: catalogCount > 0 ? "success" : "not_configured",
      recordCount: catalogCount,
      lastCheckedAt: new Date().toISOString(),
      limitations: ["A consulta interna funciona, mas a origem original e o instante de consulta não estão registrados nos itens atuais."],
    },
    {
      kind: "petronect_public_csv",
      label: "Exportação pública Petronect por CSV manual",
      status: publicStatus === "failed" ? "failure" : publicCount > 0 ? "success" : "not_configured",
      recordCount: publicCount,
      lastCheckedAt: publicLastRun?.created_at ?? null,
      limitations: ["Não há conexão ao vivo configurada.", "Exportação pública não inclui valores, setores ou documentos completos; ausência do registro não comprova cancelamento."],
    },
    {
      kind: "client_import",
      label: "Listas e editais importados para perfis visíveis",
      status: importCount > 0 ? "success" : "not_configured",
      recordCount: importCount,
      lastCheckedAt: latestImport,
      limitations: ["O horário registrado é o upload no app quando o arquivo não informa a consulta na fonte.", "A cobertura vale somente para os arquivos importados por perfil."],
    },
    {
      kind: "petronect_live",
      label: "Integração direta Petronect",
      status: "not_configured",
      recordCount: 0,
      lastCheckedAt: null,
      limitations: ["Nenhuma API ou integração autorizada ao vivo configurada; não há coleta automática."],
    },
  ]);
});

router.get("/radar360/events", async (req, res) => {
  const actor = getActor(req);
  const parsed = ListRadar360EventsQueryParams.safeParse({
    profileId: req.query.profileId == null ? undefined : Number(req.query.profileId),
  });
  if (!parsed.success) return fail(res, 400, "Filtro de eventos inválido.");
  let result;
  if (parsed.data.profileId != null) {
    const profile = await requireProfileAccess(parsed.data.profileId, actor, res);
    if (!profile) return;
    result = await db.execute(sql`
      SELECT * FROM radar360_events WHERE profile_id=${parsed.data.profileId}
      ORDER BY created_at DESC, id DESC LIMIT 100
    `);
  } else if (actor.role === "ADMIN_PETRON") {
    result = await db.execute(sql`SELECT * FROM radar360_events ORDER BY created_at DESC, id DESC LIMIT 100`);
  } else {
    result = await db.execute(sql`
      SELECT e.* FROM radar360_events e
      JOIN radar360_profiles p ON p.id=e.profile_id
      WHERE p.company_id=${actor.companyId}
      ORDER BY e.created_at DESC, e.id DESC LIMIT 100
    `);
  }
  return res.json(rows(result).map((row) => ({
    id: asNumber(row.id),
    profileId: asNumber(row.profile_id),
    runId: asNullableNumber(row.run_id),
    importId: asNullableNumber(row.import_id),
    eventType: asString(row.event_type),
    status: asString(row.status),
    message: asString(row.message),
    createdAt: row.created_at,
  })));
});

router.get("/radar360/imports", async (req, res) => {
  const actor = getActor(req);
  const parsed = ListRadar360ImportsQueryParams.safeParse({
    profileId: req.query.profileId == null ? undefined : Number(req.query.profileId),
  });
  if (!parsed.success) return fail(res, 400, "Filtro inválido.");
  let result;
  if (parsed.data.profileId != null) {
    const profile = await requireProfileAccess(parsed.data.profileId, actor, res);
    if (!profile) return;
    result = await db.execute(sql`SELECT * FROM radar360_imports WHERE profile_id=${parsed.data.profileId} ORDER BY created_at DESC LIMIT 200`);
  } else if (actor.role === "ADMIN_PETRON") {
    result = await db.execute(sql`SELECT * FROM radar360_imports ORDER BY created_at DESC LIMIT 200`);
  } else {
    result = await db.execute(sql`
      SELECT i.* FROM radar360_imports i
      JOIN radar360_profiles p ON p.id=i.profile_id
      WHERE p.company_id=${actor.companyId}
      ORDER BY i.created_at DESC LIMIT 200
    `);
  }
  return res.json(rows(result).map((row) => ({
    id: asNumber(row.id),
    profileId: asNumber(row.profile_id),
    sourceName: asString(row.source_name),
    fileName: asString(row.file_name),
    status: asString(row.status),
    totalRows: asNumber(row.total_rows),
    newRows: asNumber(row.new_rows),
    duplicateRows: asNumber(row.duplicate_rows),
    invalidRows: asNumber(row.invalid_rows),
    errorMessage: asNullableString(row.error_message),
    createdAt: row.created_at,
    completedAt: row.completed_at,
  })));
});

router.post(
  "/radar360/imports/preview",
  express.text({ type: ["text/csv", "text/plain"], limit: "5mb" }),
  async (req, res) => {
    const actor = getActor(req);
    const parsed = PreviewRadar360ImportQueryParams.safeParse({
      profileId: Number(req.query.profileId),
      sourceName: req.query.sourceName,
      fileName: req.query.fileName,
    });
    if (!parsed.success || typeof req.body !== "string" || !req.body.trim()) {
      return fail(res, 400, "Envie um CSV e identifique a fonte e o arquivo.");
    }
    const profile = await requireProfileAccess(parsed.data.profileId, actor, res, true);
    if (!profile) return;
    const safeFileName = parsed.data.fileName.split(/[\\/]/).pop()?.slice(0, 180) || "import.csv";
    const sourceName = parsed.data.sourceName.trim().slice(0, 180);
    if (!sourceName) return fail(res, 400, "Informe a fonte consultada.");
    const existingResult = await db.execute(sql`SELECT source_key FROM radar360_import_items WHERE profile_id=${parsed.data.profileId}`);
    const existingKeys = new Set(rows(existingResult).map((row) => asString(row.source_key)));
    const previewRows = parseRadar360Csv({
      csvText: req.body,
      sourceName,
      now: new Date(),
      existingKeys,
    });
    if (!previewRows.length) return fail(res, 400, "O CSV não contém linhas de dados legíveis.");
    const fingerprint = createHash("sha256")
      .update(`${parsed.data.profileId}|${normalizeText(sourceName)}|${req.body}`)
      .digest("hex");
    const found = rows(await db.execute(sql`
      SELECT * FROM radar360_imports
      WHERE profile_id=${parsed.data.profileId} AND fingerprint=${fingerprint} LIMIT 1
    `))[0];
    if (found) return res.status(200).json(importDto(found, asArray(found.preview_rows) as never));
    const counts = {
      total: previewRows.length,
      newRows: previewRows.filter((row) => row.action === "new").length,
      duplicates: previewRows.filter((row) => row.action === "duplicate").length,
      invalid: previewRows.filter((row) => row.action === "invalid").length,
    };
    const result = await db.execute(sql`
      INSERT INTO radar360_imports (
        profile_id, source_name, file_name, fingerprint, status, total_rows, new_rows, duplicate_rows, invalid_rows,
        preview_rows, created_by
      ) VALUES (
        ${parsed.data.profileId}, ${sourceName}, ${safeFileName}, ${fingerprint}, 'pending',
        ${counts.total}, ${counts.newRows}, ${counts.duplicates}, ${counts.invalid},
        ${JSON.stringify(previewRows)}::jsonb, ${actor.id}
      )
      ON CONFLICT (profile_id, fingerprint) DO NOTHING
      RETURNING *
    `);
    const inserted = rows(result)[0] ?? rows(await db.execute(sql`
      SELECT * FROM radar360_imports WHERE profile_id=${parsed.data.profileId} AND fingerprint=${fingerprint} LIMIT 1
    `))[0];
    if (!inserted) return fail(res, 500, "Não foi possível registrar a prévia.");
    if (rows(result).length) {
      await recordEvent({
        profileId: parsed.data.profileId,
        importId: asNumber(inserted.id),
        actorId: actor.id,
        eventType: "import_preview",
        status: "pending",
        message: `Prévia registrada: ${counts.newRows} novas, ${counts.duplicates} duplicadas e ${counts.invalid} inválidas.`,
      });
    }
    return res.status(rows(result).length ? 201 : 200).json(importDto(inserted, previewRows));
  },
);

function importDto(row: Row, previewRows: unknown[] = []) {
  return {
    id: asNumber(row.id),
    profileId: asNumber(row.profile_id),
    sourceName: asString(row.source_name),
    fileName: asString(row.file_name),
    status: asString(row.status),
    totalRows: asNumber(row.total_rows),
    newRows: asNumber(row.new_rows),
    duplicateRows: asNumber(row.duplicate_rows),
    invalidRows: asNumber(row.invalid_rows),
    errorMessage: asNullableString(row.error_message),
    createdAt: row.created_at,
    completedAt: row.completed_at,
    previewRows,
  };
}

router.post("/radar360/imports/:id/apply", async (req, res) => {
  const params = ApplyRadar360ImportParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) return fail(res, 400, "Importação inválida.");
  const actor = getActor(req);
  const result = rows(await db.execute(sql`SELECT * FROM radar360_imports WHERE id=${params.data.id} LIMIT 1`))[0];
  if (!result) return fail(res, 404, "Importação não encontrada.");
  const profile = await requireProfileAccess(asNumber(result.profile_id), actor, res, true);
  if (!profile) return;
  if (asString(result.status) === "success") return res.json(importDto(result, asArray(result.preview_rows)));
  const previewRows = Array.isArray(result.preview_rows) ? result.preview_rows as Row[] : [];
  await recordEvent({
    profileId: asNumber(result.profile_id),
    importId: params.data.id,
    actorId: actor.id,
    eventType: "import_apply_started",
    status: "pending",
    message: "Aplicação da prévia iniciada; as linhas válidas usam chave idempotente.",
  });
  try {
    for (const item of previewRows) {
      if (item.action !== "new" || !item.object) continue;
      await db.execute(sql`
        INSERT INTO radar360_import_items (
          import_id, profile_id, source_key, process_number, object, contractor, deadline_text, time_zone, source_url,
          source_name, checked_at, checked_at_known, sector, region, value, status
        ) VALUES (
          ${params.data.id}, ${asNumber(result.profile_id)}, ${asString(item.sourceKey)}, ${item.processNumber ?? null},
          ${asString(item.object)}, ${item.contractor ?? null}, ${item.deadlineText ?? null}, ${item.timeZone ?? null},
          ${item.sourceUrl ?? null}, ${asString(item.sourceName)}, ${item.checkedAt}, ${item.checkedAtKnown === true},
          ${item.sector ?? null}, ${item.region ?? null}, ${item.value ?? null}, ${item.status ?? null}
        )
        ON CONFLICT (profile_id, source_key) DO NOTHING
        RETURNING id
      `);
    }
    const persistedCount = asNumber(rows(await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM radar360_import_items WHERE import_id=${params.data.id}
    `))[0]?.count);
    const duplicateCount = asNumber(result.duplicate_rows) + Math.max(0, asNumber(result.new_rows) - persistedCount);
    const updated = rows(await db.execute(sql`
      UPDATE radar360_imports SET status='success', new_rows=${persistedCount}, duplicate_rows=${duplicateCount},
        completed_at=NOW(), error_message=NULL
      WHERE id=${params.data.id} RETURNING *
    `))[0];
    await recordEvent({
      profileId: asNumber(result.profile_id),
      importId: params.data.id,
      actorId: actor.id,
      eventType: "import_applied",
      status: "success",
      message: `Aplicação concluída: ${asNumber(updated?.new_rows)} linhas novas e ${asNumber(updated?.duplicate_rows)} duplicadas; execução sem registros repetidos.`,
    });
    return res.json(importDto(updated, previewRows));
  } catch (error) {
    const message = safeFailureMessage(error, "Falha durante a aplicação da importação; a execução pode ser retomada.");
    await db.execute(sql`UPDATE radar360_imports SET status='failed', error_message=${message} WHERE id=${params.data.id}`);
    await recordEvent({
      profileId: asNumber(result.profile_id),
      importId: params.data.id,
      actorId: actor.id,
      eventType: "import_failed",
      status: "failure",
      message,
    });
    return fail(res, 500, "Falha ao aplicar a importação. A execução foi registrada e pode ser retomada.");
  }
});

function currentBaseDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

async function fetchRunCandidates(profileId: number, sourceKinds: string[]) {
  const candidates: Radar360Candidate[] = [];
  const coverage: Array<Record<string, unknown>> = [];
  const warnings: string[] = ["Cobertura parcial: esta edição considera somente as fontes selecionadas."];
  if (sourceKinds.includes("catalog")) {
    const result = await db.execute(sql`
      SELECT id, title, sector, company, value, status, region, description, deadline, petronect_id
      FROM opportunities ORDER BY id DESC LIMIT ${MAX_SOURCE_ROWS}
    `);
    const found = rows(result);
    candidates.push(...found.filter((row) => asString(row.title)).map((row) => ({
      sourceKey: `catalog:${asString(row.petronect_id) || asString(row.id)}`,
      sourceName: "Catálogo interno Petron Radar — origem original não registrada",
      processNumber: asNullableString(row.petronect_id),
      object: [asString(row.title), asString(row.description)].filter(Boolean).join(" — "),
      contractor: asNullableString(row.company),
      deadlineText: asNullableString(row.deadline),
      timeZone: null,
      sourceUrl: null,
      sourceCheckedAt: null,
      sourceTimeKnown: false,
      sector: asNullableString(row.sector),
      region: asNullableString(row.region),
      value: row.value == null ? null : Number(row.value),
      status: asNullableString(row.status),
    })));
    coverage.push({
      kind: "catalog",
      label: "Catálogo interno do Petron Radar",
      status: found.length ? "success" : "not_configured",
      checkedAt: new Date().toISOString(),
      sourceTimeKnown: false,
      recordCount: found.length,
      limitations: ["Origem original, consulta Petronect, fuso e link do edital não estão registrados nos itens atuais."],
    });
    if (found.length >= MAX_SOURCE_ROWS) warnings.push(`O catálogo atingiu o limite de leitura de ${MAX_SOURCE_ROWS} registros.`);
  }
  if (sourceKinds.includes("petronect_public_csv")) {
    const result = await db.execute(sql`
      SELECT p.petronect_id, p.title, p.sub_status, p.company, p.scope, p.end_date, p.delivery_location, p.source_updated_at
      FROM petronect_public_opportunities p
      ORDER BY p.source_updated_at DESC LIMIT ${MAX_SOURCE_ROWS}
    `);
    const found = rows(result);
    candidates.push(...found.filter((row) => asString(row.title)).map((row) => ({
      sourceKey: `petronect-public:${asString(row.petronect_id)}`,
      sourceName: "Exportação pública Petronect importada manualmente",
      processNumber: asNullableString(row.petronect_id),
      object: [asString(row.title), asString(row.scope)].filter(Boolean).join(" — "),
      contractor: asNullableString(row.company),
      deadlineText: asNullableString(row.end_date),
      timeZone: null,
      sourceUrl: null,
      sourceCheckedAt: null,
      sourceTimeKnown: false,
      sector: null,
      region: asNullableString(row.delivery_location),
      value: null,
      status: asNullableString(row.sub_status),
    })));
    coverage.push({
      kind: "petronect_public_csv",
      label: "Exportação pública Petronect por CSV manual",
      status: found.length ? "success" : "not_configured",
      checkedAt: found[0]?.source_updated_at ?? null,
      sourceTimeKnown: false,
      recordCount: found.length,
      limitations: ["A data registrada é da importação no app, não comprova consulta na fonte.", "O arquivo público não fornece valor, setor nem documentos completos."],
    });
    if (!found.length) warnings.push("A fonte pública Petronect por CSV não tem registros importados nesta base.");
  }
  if (sourceKinds.includes("client_import")) {
    const result = await db.execute(sql`
      SELECT i.source_key, i.process_number, i.object, i.contractor, i.deadline_text, i.time_zone, i.source_url,
        i.source_name, i.checked_at, i.checked_at_known, i.sector, i.region, i.value, i.status,
        r.created_at AS upload_at
      FROM radar360_import_items i
      JOIN radar360_imports r ON r.id=i.import_id
      WHERE i.profile_id=${profileId} AND r.status='success'
      ORDER BY i.checked_at DESC, i.id DESC LIMIT ${MAX_SOURCE_ROWS}
    `);
    const found = rows(result);
    candidates.push(...found.map((row) => ({
      sourceKey: `client-import:${asString(row.source_key)}`,
      sourceName: asString(row.source_name),
      processNumber: asNullableString(row.process_number),
      object: asString(row.object),
      contractor: asNullableString(row.contractor),
      deadlineText: asNullableString(row.deadline_text),
      timeZone: asNullableString(row.time_zone),
      sourceUrl: asNullableString(row.source_url),
      sourceCheckedAt: row.checked_at_known === true ? asString(row.checked_at) : null,
      sourceTimeKnown: row.checked_at_known === true,
      sector: asNullableString(row.sector),
      region: asNullableString(row.region),
      value: row.value == null ? null : Number(row.value),
      status: asNullableString(row.status),
    })));
    coverage.push({
      kind: "client_import",
      label: "Listas/editais importados para este perfil",
      status: found.length ? "success" : "not_configured",
      checkedAt: found[0]?.upload_at ?? null,
      sourceTimeKnown: found.some((row) => row.checked_at_known === true),
      recordCount: found.length,
      limitations: ["Cobertura limitada aos arquivos importados para este perfil; horário de upload não substitui hora de consulta na fonte."],
    });
    if (!found.length) warnings.push("Nenhuma lista ou edital foi aplicado para este perfil.");
  }
  warnings.push("Integração direta Petronect não configurada; nenhuma coleta automática foi executada.");
  return { candidates: dedupeCandidates(candidates), coverage, warnings };
}

function dedupeCandidates(candidates: Radar360Candidate[]): Radar360Candidate[] {
  const groups = new Map<string, Radar360Candidate>();
  for (const candidate of candidates) {
    const key = candidate.processNumber
      ? `process:${normalizeText(candidate.processNumber)}`
      : candidate.sourceKey;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...candidate, sourceKey: key });
      continue;
    }
    const sources = new Set([...existing.sourceName.split(" | "), candidate.sourceName]);
    const conflicts = new Set(existing.conflicts ?? []);
    const compare = (field: "object" | "contractor" | "deadlineText" | "value" | "sector" | "region") => {
      const first = existing[field];
      const next = candidate[field];
      if (first != null && next != null && normalizeText(String(first)) !== normalizeText(String(next))) {
        conflicts.add(field === "deadlineText" ? "divergência de prazo" : field === "value" ? "divergência de valor" : `divergência de ${field}`);
        if (field !== "object") (existing as unknown as Record<string, unknown>)[field] = null;
      } else if (first == null && next != null) {
        (existing as unknown as Record<string, unknown>)[field] = next;
      }
    };
    compare("object");
    compare("contractor");
    compare("deadlineText");
    compare("value");
    compare("sector");
    compare("region");
    existing.sourceName = [...sources].join(" | ");
    existing.sourceTimeKnown ||= candidate.sourceTimeKnown;
    existing.sourceCheckedAt ??= candidate.sourceCheckedAt;
    existing.conflicts = [...conflicts];
    if (!existing.processNumber) existing.processNumber = candidate.processNumber;
    if (!existing.timeZone) existing.timeZone = candidate.timeZone;
    if (!existing.sourceUrl) existing.sourceUrl = candidate.sourceUrl;
  }
  return [...groups.values()];
}

async function persistRunItems(runId: number, items: EvaluatedRadar360Item[]) {
  await db.execute(sql`DELETE FROM radar360_run_items WHERE run_id=${runId}`);
  for (const item of items) {
    await db.execute(sql`
      INSERT INTO radar360_run_items (
        run_id, source_key, source_name, process_number, object, contractor, deadline_text, time_zone, source_url,
        source_checked_at, source_time_known, sector, region, value, status, justification, pending_fields, action,
        urgency, fit_score, score_breakdown, category, expired, sort_order
      ) VALUES (
        ${runId}, ${item.sourceKey}, ${item.sourceName}, ${item.processNumber}, ${item.object}, ${item.contractor},
        ${item.deadlineText}, ${item.timeZone}, ${item.sourceUrl}, ${item.sourceCheckedAt},
        ${item.sourceTimeKnown}, ${item.sector}, ${item.region}, ${item.value}, ${item.status}, ${item.justification},
        ${jsonValue(item.pendingFields)}::jsonb, ${item.action}, ${item.urgency}, ${item.fitScore},
        ${jsonValue(item.scoreBreakdown)}::jsonb, ${item.category}, ${item.expired}, ${item.sortOrder}
      )
      ON CONFLICT (run_id, source_key) DO UPDATE SET
        source_name=EXCLUDED.source_name, process_number=EXCLUDED.process_number, object=EXCLUDED.object,
        contractor=EXCLUDED.contractor, deadline_text=EXCLUDED.deadline_text, time_zone=EXCLUDED.time_zone,
        source_url=EXCLUDED.source_url, source_checked_at=EXCLUDED.source_checked_at,
        source_time_known=EXCLUDED.source_time_known, sector=EXCLUDED.sector, region=EXCLUDED.region,
        value=EXCLUDED.value, status=EXCLUDED.status, justification=EXCLUDED.justification,
        pending_fields=EXCLUDED.pending_fields, action=EXCLUDED.action, urgency=EXCLUDED.urgency,
        fit_score=EXCLUDED.fit_score, score_breakdown=EXCLUDED.score_breakdown, category=EXCLUDED.category,
        expired=EXCLUDED.expired, sort_order=EXCLUDED.sort_order
    `);
  }
}

async function uploadSvgForRun(runId: number, profileId: number, userId: number, svg: string) {
  const objectPath = `/objects/radar360/run-${runId}.svg`;
  const uploadUrl = await objectStorageService.getObjectEntityUploadURLForPath(objectPath);
  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/svg+xml" },
    body: svg,
    signal: AbortSignal.timeout(30_000),
  });
  if (!upload.ok) throw new Error(`Armazenamento da imagem falhou (${upload.status}).`);
  const checksum = createHash("sha256").update(svg).digest("hex");
  const fileResult = await db.execute(sql`
    INSERT INTO radar360_files (
      profile_id, kind, original_name, content_type, file_size, object_path, status, created_by
    ) VALUES (
      ${profileId}, 'edition_image', ${`radar360-${runId}.svg`}, 'image/svg+xml',
      ${Buffer.byteLength(svg, "utf8")}, ${objectPath}, 'ready', ${userId}
    )
    ON CONFLICT (object_path) DO UPDATE SET
      file_size=EXCLUDED.file_size, status='ready', created_by=EXCLUDED.created_by
    RETURNING id
  `);
  return { fileId: asNumber(rows(fileResult)[0]?.id), checksum, objectPath };
}

async function processRun(runId: number, actor: SessionActor, eventType: "run_started" | "run_resumed"): Promise<Row | null> {
  const run = rows(await db.execute(sql`SELECT * FROM radar360_runs WHERE id=${runId} LIMIT 1`))[0];
  if (!run || asString(run.status) === "published") return run ?? null;
  const profileRow = await getProfileRow(asNumber(run.profile_id));
  if (!profileRow) throw new Error("Perfil do boletim não encontrado.");
  if (!canAccessRadar360Company(asNullableNumber(profileRow.company_id), actor)) {
    throw new Error("Acesso ao perfil negado.");
  }
  const profile = profileFromRow(profileRow);
  const baseDate = asString(run.base_date) || currentBaseDate();
  const claimed = rows(await db.execute(sql`
    UPDATE radar360_runs SET status='validation', last_error=NULL, updated_at=NOW()
    WHERE id=${runId} AND status <> 'published'
      AND (status <> 'validation' OR updated_at < NOW() - INTERVAL '5 minutes')
    RETURNING id
  `))[0];
  if (!claimed) return rows(await db.execute(sql`SELECT * FROM radar360_runs WHERE id=${runId} LIMIT 1`))[0] ?? run;
  await recordEvent({
    profileId: profile.id,
    runId,
    actorId: actor.id,
    eventType,
    status: "pending",
    message: eventType === "run_started" ? "Varredura iniciada." : "Retomada registrada para a mesma edição.",
  });
  try {
    const sourceKinds = asArray(run.source_kinds);
    const sourceResult = await fetchRunCandidates(profile.id, sourceKinds);
    const evaluated = evaluateAndLimitCandidates(profile, sourceResult.candidates, baseDate);
    await persistRunItems(runId, evaluated);
    const warnings = [...sourceResult.warnings];
    let logoDataUri: string | undefined;
    const logoRow = rows(await db.execute(sql`
      SELECT object_path, content_type FROM radar360_files
      WHERE profile_id=${profile.id} AND kind='logo' AND status IN ('ready','verified')
      ORDER BY created_at DESC LIMIT 1
    `))[0];
    if (logoRow) {
      try {
        const contentType = asString(logoRow.content_type);
        if (["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
          const objectFile = await objectStorageService.getObjectEntityFile(asString(logoRow.object_path));
          const [logoBytes] = await objectFile.download();
          if (logoBytes.byteLength <= IMAGE_LIMIT_BYTES) {
            logoDataUri = `data:${contentType};base64,${logoBytes.toString("base64")}`;
          }
        }
      } catch {
        warnings.push("O logo cadastrado não foi carregado; a imagem usa o nome da empresa e o padrão visual premium.");
      }
    }
    const missing = profileMissingFields(profile, profile.companyId != null);
    const text = renderRadar360Text({
      profile,
      baseDate,
      sourceCoverage: sourceResult.coverage,
      items: evaluated,
      warnings,
    });
    const svg = renderRadar360Svg({
      profile,
      baseDate,
      items: evaluated,
      sourceCoverage: sourceResult.coverage,
      logoDataUri,
    });
    if (!svg.includes(escapeXml(profile.displayName)) || !svg.startsWith("<svg")) {
      throw new Error("A validação da imagem da edição falhou.");
    }
    const image = await uploadSvgForRun(runId, profile.id, actor.id, svg);
    const usableSource = sourceResult.coverage.some((source) =>
      source.status === "success" && asNumber(source.recordCount) > 0,
    );
    const finalStatus = missing.length === 0 && usableSource ? "ready" : "draft";
    const saved = await db.execute(sql`
      UPDATE radar360_runs SET
        status=${finalStatus},
        source_coverage=${JSON.stringify(sourceResult.coverage)}::jsonb,
        score_version=${RADAR360_SCORE_VERSION},
        score_weights=${JSON.stringify(RADAR360_SCORE_WEIGHTS)}::jsonb,
        edition_text=${text},
        image_file_id=${image.fileId},
        image_checksum=${image.checksum},
        pending_fields=${jsonValue(missing)}::jsonb,
        warnings=${jsonValue(warnings)}::jsonb,
        last_error=NULL,
        completed_at=NOW(),
        updated_at=NOW()
      WHERE id=${runId} RETURNING *
    `);
    await recordEvent({
      profileId: profile.id,
      runId,
      actorId: actor.id,
      eventType: finalStatus === "ready" ? "run_ready" : "run_draft",
      status: finalStatus === "ready" ? "success" : "pending",
      message: finalStatus === "ready"
        ? "Validação concluída; texto e imagem foram salvos."
        : `Rascunho salvo; pendências: ${missing.join(", ") || "fonte utilizável ou cobertura"}.`,
    });
    return rows(saved)[0] ?? null;
  } catch (error) {
    const message = safeFailureMessage(error, "Falha durante a varredura, geração da imagem ou validação; a execução pode ser retomada.");
    await db.execute(sql`
      UPDATE radar360_runs SET status='failed', last_error=${message}, completed_at=NOW(), updated_at=NOW()
      WHERE id=${runId}
    `);
    await recordEvent({
      profileId: profile.id,
      runId,
      actorId: actor.id,
      eventType: "run_failed",
      status: "failure",
      message,
    });
    throw error;
  }
}

function runSummary(row: Row, profileName: string, itemCount: number, imageReady: boolean) {
  return {
    id: asNumber(row.id),
    profileId: asNumber(row.profile_id),
    companyId: asNullableNumber(row.company_id),
    companyName: asNullableString(row.company_name),
    profileName,
    status: asString(row.status),
    baseDate: asString(row.base_date).slice(0, 10),
    scoreVersion: asString(row.score_version),
    pendingFields: asArray(row.pending_fields),
    warnings: asArray(row.warnings),
    itemCount,
    imageReady,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    publishedAt: row.published_at,
  };
}

async function getRunDto(runId: number) {
  const run = rows(await db.execute(sql`
    SELECT r.*, p.display_name AS profile_name, ca.nome_fantasia AS company_name, f.status AS image_status
    FROM radar360_runs r
    JOIN radar360_profiles p ON p.id=r.profile_id
    LEFT JOIN company_accounts ca ON ca.id=r.company_id
    LEFT JOIN radar360_files f ON f.id=r.image_file_id
    WHERE r.id=${runId} LIMIT 1
  `))[0];
  if (!run) return null;
  const items = rows(await db.execute(sql`
    SELECT * FROM radar360_run_items WHERE run_id=${runId} ORDER BY sort_order, id
  `));
  const summary = runSummary(run, asString(run.profile_name), items.length, asString(run.image_status) === "ready");
  return {
    ...summary,
    editionText: asNullableString(run.edition_text),
    sourceKinds: asArray(run.source_kinds),
    sourceCoverage: Array.isArray(run.source_coverage) ? run.source_coverage : [],
    scoreWeights: run.score_weights && typeof run.score_weights === "object" ? run.score_weights : {},
    imageUrl: asString(run.image_status) === "ready" ? `/api/radar360/runs/${runId}/image` : null,
    lastError: asNullableString(run.last_error),
    items: items.map((item) => ({
      id: asNumber(item.id),
      sourceKey: asString(item.source_key),
      sourceName: asString(item.source_name),
      processNumber: asNullableString(item.process_number),
      object: asString(item.object),
      contractor: asNullableString(item.contractor),
      deadlineText: asNullableString(item.deadline_text),
      timeZone: asNullableString(item.time_zone),
      sourceUrl: asNullableString(item.source_url),
      sourceCheckedAt: item.source_checked_at ?? null,
      sourceTimeKnown: item.source_time_known === true,
      sector: asNullableString(item.sector),
      region: asNullableString(item.region),
      value: item.value == null ? null : Number(item.value),
      status: asNullableString(item.status),
      justification: asString(item.justification),
      pendingFields: asArray(item.pending_fields),
      action: asString(item.action),
      urgency: asString(item.urgency),
      fitScore: asNullableNumber(item.fit_score),
      scoreBreakdown: Array.isArray(item.score_breakdown) ? item.score_breakdown : [],
      category: asString(item.category),
      expired: item.expired === true,
      sortOrder: asNumber(item.sort_order),
    })),
  };
}

router.get("/radar360/runs", async (req, res) => {
  const actor = getActor(req);
  const parsed = ListRadar360RunsQueryParams.safeParse({
    profileId: req.query.profileId == null ? undefined : Number(req.query.profileId),
  });
  if (!parsed.success) return fail(res, 400, "Filtro inválido.");
  if (parsed.data.profileId != null) {
    const profile = await requireProfileAccess(parsed.data.profileId, actor, res);
    if (!profile) return;
  }
  let result;
  if (actor.role === "ADMIN_PETRON") {
    result = parsed.data.profileId == null
      ? await db.execute(sql`
          SELECT r.*, p.display_name AS profile_name, ca.nome_fantasia AS company_name, f.status AS image_status
          FROM radar360_runs r JOIN radar360_profiles p ON p.id=r.profile_id
          LEFT JOIN company_accounts ca ON ca.id=r.company_id LEFT JOIN radar360_files f ON f.id=r.image_file_id
          ORDER BY r.created_at DESC LIMIT 200
        `)
      : await db.execute(sql`
          SELECT r.*, p.display_name AS profile_name, ca.nome_fantasia AS company_name, f.status AS image_status
          FROM radar360_runs r JOIN radar360_profiles p ON p.id=r.profile_id
          LEFT JOIN company_accounts ca ON ca.id=r.company_id LEFT JOIN radar360_files f ON f.id=r.image_file_id
          WHERE r.profile_id=${parsed.data.profileId} ORDER BY r.created_at DESC LIMIT 200
        `);
  } else {
    result = await db.execute(sql`
      SELECT r.*, p.display_name AS profile_name, ca.nome_fantasia AS company_name, f.status AS image_status
      FROM radar360_runs r JOIN radar360_profiles p ON p.id=r.profile_id
      LEFT JOIN company_accounts ca ON ca.id=r.company_id LEFT JOIN radar360_files f ON f.id=r.image_file_id
      WHERE p.company_id=${actor.companyId}
      ${parsed.data.profileId == null ? sql`` : sql`AND r.profile_id=${parsed.data.profileId}`}
      ORDER BY r.created_at DESC LIMIT 200
    `);
  }
  const results = rows(result);
  const output = await Promise.all(results.map(async (run) => {
    const count = asNumber(rows(await db.execute(sql`SELECT COUNT(*)::int AS count FROM radar360_run_items WHERE run_id=${asNumber(run.id)}`))[0]?.count);
    return runSummary(run, asString(run.profile_name), count, asString(run.image_status) === "ready");
  }));
  return res.json(output);
});

router.post("/radar360/runs", async (req, res) => {
  const parsed = CreateRadar360RunBody.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Dados da varredura inválidos.");
  const actor = getActor(req);
  const profileRow = await requireProfileAccess(parsed.data.profileId, actor, res);
  if (!profileRow) return;
  const sourceKinds = [...new Set(parsed.data.sourceKinds)];
  const existing = rows(await db.execute(sql`
    SELECT id FROM radar360_runs WHERE profile_id=${parsed.data.profileId} AND idempotency_key=${parsed.data.idempotencyKey} LIMIT 1
  `))[0];
  let runId = asNumber(existing?.id);
  let wasCreated = false;
  if (!runId) {
    const created = await db.execute(sql`
      INSERT INTO radar360_runs (
        profile_id, company_id, idempotency_key, status, source_kinds, base_date,
        score_version, score_weights, created_by
      ) VALUES (
        ${parsed.data.profileId}, ${profileRow.company_id}, ${parsed.data.idempotencyKey}, 'draft',
        ${jsonValue(sourceKinds)}::jsonb, ${currentBaseDate()}, ${RADAR360_SCORE_VERSION},
        ${JSON.stringify(RADAR360_SCORE_WEIGHTS)}::jsonb, ${actor.id}
      )
      ON CONFLICT (profile_id, idempotency_key) DO NOTHING RETURNING id
    `);
    runId = asNumber(rows(created)[0]?.id);
    wasCreated = runId > 0;
    if (!runId) {
      const retry = rows(await db.execute(sql`
        SELECT id FROM radar360_runs WHERE profile_id=${parsed.data.profileId} AND idempotency_key=${parsed.data.idempotencyKey} LIMIT 1
      `))[0];
      runId = asNumber(retry?.id);
    }
  }
  if (!runId) return fail(res, 500, "Não foi possível registrar a execução.");
  const current = rows(await db.execute(sql`SELECT status FROM radar360_runs WHERE id=${runId}`))[0];
  if (asString(current?.status) !== "published") {
    try {
      await processRun(runId, actor, wasCreated ? "run_started" : "run_resumed");
    } catch {
      // The failed run and error detail are persisted for a later retry.
    }
  }
  const result = await getRunDto(runId);
  return res.status(wasCreated ? 201 : 200).json(result);
});

router.get("/radar360/runs/:id", async (req, res) => {
  const params = parseIdParams(GetRadar360RunParams, req.params.id);
  if (!params) return fail(res, 400, "Edição inválida.");
  const run = await requireRunAccess(params.id, getActor(req), res);
  if (!run) return;
  const result = await getRunDto(params.id);
  return res.json(result);
});

router.post("/radar360/runs/:id/resume", async (req, res) => {
  const params = parseIdParams(ResumeRadar360RunParams, req.params.id);
  if (!params) return fail(res, 400, "Edição inválida.");
  const actor = getActor(req);
  const run = await requireRunAccess(params.id, actor, res);
  if (!run) return;
  if (asString(run.status) === "published") return fail(res, 409, "Edições publicadas não podem ser alteradas.");
  try {
    await processRun(params.id, actor, "run_resumed");
  } catch {
    // The failed state and error are kept so the user can retry.
  }
  return res.json(await getRunDto(params.id));
});

router.post("/radar360/runs/:id/publish", async (req, res) => {
  const params = parseIdParams(PublishRadar360RunParams, req.params.id);
  if (!params) return fail(res, 400, "Edição inválida.");
  const actor = getActor(req);
  const run = await requireRunAccess(params.id, actor, res);
  if (!run) return;
  const profile = await getProfileRow(asNumber(run.profile_id));
  if (!profile) return fail(res, 404, "Perfil não encontrado.");
  const profileModel = profileFromRow(profile);
  const missing = profileMissingFields(profileModel, profileModel.companyId != null);
  if (asString(run.status) !== "ready" || asNullableNumber(run.image_file_id) == null) {
    return fail(res, 409, "A edição precisa estar pronta e ter imagem validada antes da publicação.");
  }
  if (missing.length) return fail(res, 409, `Perfil incompleto: ${missing.join(", ")}.`);
  if (!profileModel.companyId) return fail(res, 409, "Concilie o perfil com uma empresa antes de publicar.");
  const published = await db.execute(sql`
    UPDATE radar360_runs SET status='published', published_at=NOW(), updated_at=NOW()
    WHERE id=${params.id} AND status='ready' RETURNING id
  `);
  if (!rows(published).length && asString(run.status) !== "published") {
    return fail(res, 409, "A edição mudou de estado; atualize a lista e revise novamente.");
  }
  if (rows(published).length) {
    await recordEvent({
      profileId: asNumber(run.profile_id),
      runId: params.id,
      actorId: actor.id,
      eventType: "run_published",
      status: "success",
      message: "Boletim publicado na área privada da empresa vinculada.",
    });
  }
  return res.json(await getRunDto(params.id));
});

router.get("/radar360/runs/:id/image", async (req, res) => {
  const params = parseIdParams(GetRadar360RunParams, req.params.id);
  if (!params) return fail(res, 400, "Imagem inválida.");
  const run = await requireRunAccess(params.id, getActor(req), res);
  if (!run) return;
  const fileId = asNullableNumber(run.image_file_id);
  if (!fileId) return fail(res, 404, "Imagem ainda não disponível.");
  const fileRow = rows(await db.execute(sql`
    SELECT * FROM radar360_files WHERE id=${fileId} AND profile_id=${asNumber(run.profile_id)}
      AND kind='edition_image' AND status='ready' LIMIT 1
  `))[0];
  if (!fileRow) return fail(res, 404, "Imagem ainda não disponível.");
  return streamPrivateFile(fileRow, res, true);
});

router.get("/radar360/files", async (req, res) => {
  const actor = getActor(req);
  const parsed = ListRadar360FilesQueryParams.safeParse({ profileId: Number(req.query.profileId) });
  if (!parsed.success) return fail(res, 400, "Perfil inválido.");
  const profile = await requireProfileAccess(parsed.data.profileId, actor, res);
  if (!profile) return;
  const result = await db.execute(sql`
    SELECT id, profile_id, kind, original_name, content_type, file_size, capability_label, status, created_at, verified_at
    FROM radar360_files WHERE profile_id=${parsed.data.profileId} AND status<>'failed'
    ORDER BY created_at DESC LIMIT 200
  `);
  return res.json(rows(result).map(fileDto));
});

router.post("/radar360/files/upload-url", async (req, res) => {
  const parsed = RequestRadar360FileUploadBody.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "Metadados do arquivo inválidos.");
  const actor = getActor(req);
  const profile = await requireProfileAccess(parsed.data.profileId, actor, res, true);
  if (!profile) return;
  const isLogo = parsed.data.kind === "logo";
  const allowedType = isLogo
    ? ["image/jpeg", "image/png", "image/webp"].includes(parsed.data.contentType)
    : CLIENT_FILE_TYPES.has(parsed.data.contentType);
  const sizeLimit = isLogo ? IMAGE_LIMIT_BYTES : DOCUMENT_LIMIT_BYTES;
  if (!allowedType || parsed.data.fileSize > sizeLimit) {
    return fail(res, 400, isLogo
      ? "Logo deve ser PNG, JPEG ou WebP de até 4 MB."
      : "Documento deve ter tipo permitido e até 20 MB.");
  }
  if (parsed.data.kind === "capability_document" && !parsed.data.capabilityLabel?.trim()) {
    return fail(res, 400, "Identifique a capacidade que o documento comprova.");
  }
  const safeName = parsed.data.fileName.split(/[\\/]/).pop()?.replace(/\0/g, "").slice(0, 180) || "arquivo";
  const label = parsed.data.capabilityLabel?.trim().slice(0, 160) ?? null;
  const pending = rows(await db.execute(sql`
    SELECT id, object_path FROM radar360_files
    WHERE profile_id=${parsed.data.profileId} AND kind=${parsed.data.kind}
      AND original_name=${safeName} AND file_size=${parsed.data.fileSize}
      AND content_type=${parsed.data.contentType} AND capability_label IS NOT DISTINCT FROM ${label}
      AND created_by=${actor.id} AND status='pending' AND created_at > NOW() - INTERVAL '10 minutes'
    ORDER BY created_at DESC LIMIT 1
  `))[0];
  if (pending) {
    const uploadUrl = await objectStorageService.getObjectEntityUploadURLForPath(asString(pending.object_path));
    return res.json({ fileId: asNumber(pending.id), uploadUrl });
  }
  const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
  const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
  const inserted = await db.execute(sql`
    INSERT INTO radar360_files (
      profile_id, kind, original_name, content_type, file_size, capability_label, object_path, status, created_by
    ) VALUES (
      ${parsed.data.profileId}, ${parsed.data.kind}, ${safeName}, ${parsed.data.contentType}, ${parsed.data.fileSize},
      ${label}, ${objectPath}, 'pending', ${actor.id}
    ) RETURNING id
  `);
  return res.json({ fileId: asNumber(rows(inserted)[0]?.id), uploadUrl });
});

router.post("/radar360/files/:id/complete", async (req, res) => {
  const params = parseIdParams(CompleteRadar360FileUploadParams, req.params.id);
  if (!params) return fail(res, 400, "Arquivo inválido.");
  const actor = getActor(req);
  const file = rows(await db.execute(sql`SELECT * FROM radar360_files WHERE id=${params.id} LIMIT 1`))[0];
  if (!file) return fail(res, 404, "Arquivo não encontrado.");
  const profile = await requireProfileAccess(asNumber(file.profile_id), actor, res, true);
  if (!profile) return;
  if (asString(file.status) !== "pending") return res.json(fileDto(file));
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(asString(file.object_path));
    const [metadata] = await objectFile.getMetadata();
    const actualSize = asNumber(metadata.size);
    const actualType = asString(metadata.contentType);
    if (actualSize !== asNumber(file.file_size) || actualSize <= 0 || actualType !== asString(file.content_type)) {
      await db.execute(sql`UPDATE radar360_files SET status='failed' WHERE id=${params.id}`);
      return fail(res, 400, "O arquivo enviado não corresponde ao tipo ou tamanho informado.");
    }
    const updated = rows(await db.execute(sql`
      UPDATE radar360_files SET status='ready' WHERE id=${params.id} RETURNING *
    `))[0];
    return res.json(fileDto(updated));
  } catch {
    return fail(res, 409, "Upload ainda não foi localizado no armazenamento. O mesmo arquivo pode ser reenviado.");
  }
});

router.patch("/radar360/files/:id/verify", requireAdmin, async (req, res) => {
  const params = VerifyRadar360CapabilityFileParams.safeParse({ id: Number(req.params.id) });
  const body = VerifyRadar360CapabilityFileBody.safeParse(req.body);
  if (!params.success || !body.success) return fail(res, 400, "Revisão inválida.");
  const file = rows(await db.execute(sql`SELECT * FROM radar360_files WHERE id=${params.data.id} LIMIT 1`))[0];
  if (!file || asString(file.kind) !== "capability_document") return fail(res, 404, "Documento de capacidade não encontrado.");
  if (!["ready", "verified", "rejected"].includes(asString(file.status))) return fail(res, 409, "O documento ainda não está disponível para revisão.");
  const profileId = asNumber(file.profile_id);
  const label = asNullableString(file.capability_label);
  const actor = getActor(req);
  const nextStatus = body.data.verified ? "verified" : "rejected";
  const updated = rows(await db.execute(sql`
    UPDATE radar360_files SET
      status=${nextStatus}, verified_by=${actor.id}, verified_at=NOW()
    WHERE id=${params.data.id} RETURNING *
  `))[0];
  if (label && body.data.verified) {
    await db.execute(sql`
      UPDATE radar360_profiles SET
        verified_capabilities = CASE
          WHEN verified_capabilities ? ${label} THEN verified_capabilities
          ELSE verified_capabilities || jsonb_build_array(${label})
        END,
        updated_at=NOW()
      WHERE id=${profileId}
    `);
  } else if (label) {
    const otherProof = rows(await db.execute(sql`
      SELECT id FROM radar360_files
      WHERE profile_id=${profileId} AND kind='capability_document' AND capability_label=${label}
        AND status='verified' AND id<>${params.data.id} LIMIT 1
    `))[0];
    if (!otherProof) {
      await db.execute(sql`
        UPDATE radar360_profiles SET
          verified_capabilities = COALESCE((
            SELECT jsonb_agg(item) FROM jsonb_array_elements_text(verified_capabilities) AS t(item)
            WHERE item <> ${label}
          ), '[]'::jsonb),
          updated_at=NOW()
        WHERE id=${profileId}
      `);
    }
  }
  return res.json(fileDto(updated));
});

function fileDto(row: Row) {
  return {
    id: asNumber(row.id),
    profileId: asNumber(row.profile_id),
    kind: asString(row.kind),
    originalName: asString(row.original_name),
    contentType: asString(row.content_type),
    fileSize: asNumber(row.file_size),
    capabilityLabel: asNullableString(row.capability_label),
    status: asString(row.status),
    createdAt: row.created_at,
    verifiedAt: row.verified_at ?? null,
  };
}

async function streamPrivateFile(row: Row, res: Response, inline = false) {
  const file = await objectStorageService.getObjectEntityFile(asString(row.object_path));
  const result = await objectStorageService.downloadObject(file, 0);
  res.status(200);
  res.setHeader("Content-Type", asString(row.content_type) || "application/octet-stream");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (asNumber(row.file_size)) res.setHeader("Content-Length", String(asNumber(row.file_size)));
  if (inline) {
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'");
  } else {
    const fileName = encodeURIComponent(asString(row.original_name) || "arquivo");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${fileName}`);
  }
  if (result.body) {
    Readable.fromWeb(result.body as import("node:stream/web").ReadableStream).pipe(res);
  } else {
    res.end();
  }
}

router.get("/radar360/files/:id/download", async (req, res) => {
  const params = parseIdParams(DownloadRadar360FileParams, req.params.id);
  if (!params) return fail(res, 400, "Arquivo inválido.");
  const actor = getActor(req);
  const file = rows(await db.execute(sql`SELECT * FROM radar360_files WHERE id=${params.id} AND status IN ('ready','verified') LIMIT 1`))[0];
  if (!file) return fail(res, 404, "Arquivo não encontrado.");
  const profile = await requireProfileAccess(asNumber(file.profile_id), actor, res);
  if (!profile) return;
  return streamPrivateFile(file, res);
});

export default router;
