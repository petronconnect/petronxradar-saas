import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type Radar360ScoreLine = {
  criterion: string;
  weight: number;
  points: number;
  evidence: string;
  state: "matched" | "not_matched" | "pending";
};

export type Radar360ImportRow = {
  processNumber: string | null;
  object: string;
  contractor: string | null;
  deadlineText: string | null;
  timeZone: string | null;
  sourceUrl: string | null;
  sourceName: string;
  checkedAt: string;
  checkedAtKnown: boolean;
  sector: string | null;
  region: string | null;
  value: number | null;
  status: string | null;
  missingFields: string[];
  action: "new" | "duplicate" | "invalid";
  sourceKey: string;
};

export const radar360ProfilesTable = pgTable("radar360_profiles", {
  id: serial("id").primaryKey(),
  referenceKey: text("reference_key").notNull().unique(),
  companyId: integer("company_id"),
  candidateCompanyId: integer("candidate_company_id"),
  displayName: text("display_name").notNull(),
  aliases: jsonb("aliases").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  focusAreas: jsonb("focus_areas").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  declaredCapabilities: jsonb("declared_capabilities").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  verifiedCapabilities: jsonb("verified_capabilities").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  regions: jsonb("regions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  keywords: jsonb("keywords").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  exclusions: jsonb("exclusions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  exclusionsReviewed: boolean("exclusions_reviewed").notNull().default(false),
  profileStatus: text("profile_status").notNull().default("incomplete"),
  reconciliationStatus: text("reconciliation_status").notNull().default("pending"),
  cadence: text("cadence").notNull().default("manual"),
  scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  companyUnique: uniqueIndex("radar360_profiles_company_uidx").on(t.companyId).where(sql`${t.companyId} IS NOT NULL`),
  profileStatusCheck: check("radar360_profiles_status_check", sql`${t.profileStatus} IN ('incomplete', 'ready')`),
  reconciliationStatusCheck: check("radar360_profiles_reconciliation_check", sql`${t.reconciliationStatus} IN ('pending', 'suggested', 'linked')`),
  cadenceCheck: check("radar360_profiles_cadence_check", sql`${t.cadence} IN ('manual', 'daily', 'weekly')`),
}));

export const radar360FilesTable = pgTable("radar360_files", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => radar360ProfilesTable.id),
  kind: text("kind").notNull(),
  originalName: text("original_name").notNull(),
  contentType: text("content_type").notNull(),
  fileSize: integer("file_size").notNull(),
  capabilityLabel: text("capability_label"),
  objectPath: text("object_path").notNull().unique(),
  status: text("status").notNull().default("pending"),
  createdBy: integer("created_by").notNull(),
  verifiedBy: integer("verified_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
}, (t) => ({
  profileIdx: index("radar360_files_profile_idx").on(t.profileId, t.createdAt.desc()),
  kindCheck: check("radar360_files_kind_check", sql`${t.kind} IN ('logo', 'capability_document', 'source_document', 'edition_image')`),
  statusCheck: check("radar360_files_status_check", sql`${t.status} IN ('pending', 'ready', 'verified', 'rejected', 'failed')`),
}));

export const radar360ImportsTable = pgTable("radar360_imports", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => radar360ProfilesTable.id),
  sourceName: text("source_name").notNull(),
  fileName: text("file_name").notNull(),
  fingerprint: text("fingerprint").notNull(),
  status: text("status").notNull().default("pending"),
  totalRows: integer("total_rows").notNull().default(0),
  newRows: integer("new_rows").notNull().default(0),
  duplicateRows: integer("duplicate_rows").notNull().default(0),
  invalidRows: integer("invalid_rows").notNull().default(0),
  previewRows: jsonb("preview_rows").$type<Radar360ImportRow[]>().notNull().default(sql`'[]'::jsonb`),
  errorMessage: text("error_message"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  profileFingerprintUnique: uniqueIndex("radar360_imports_profile_fingerprint_uidx").on(t.profileId, t.fingerprint),
  profileIdx: index("radar360_imports_profile_idx").on(t.profileId, t.createdAt.desc()),
  statusCheck: check("radar360_imports_status_check", sql`${t.status} IN ('pending', 'success', 'failed')`),
}));

export const radar360ImportItemsTable = pgTable("radar360_import_items", {
  id: serial("id").primaryKey(),
  importId: integer("import_id").notNull().references(() => radar360ImportsTable.id),
  profileId: integer("profile_id").notNull().references(() => radar360ProfilesTable.id),
  sourceKey: text("source_key").notNull(),
  processNumber: text("process_number"),
  object: text("object").notNull(),
  contractor: text("contractor"),
  deadlineText: text("deadline_text"),
  timeZone: text("time_zone"),
  sourceUrl: text("source_url"),
  sourceName: text("source_name").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  checkedAtKnown: boolean("checked_at_known").notNull().default(false),
  sector: text("sector"),
  region: text("region"),
  value: real("value"),
  status: text("status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  profileSourceUnique: uniqueIndex("radar360_import_items_profile_source_uidx").on(t.profileId, t.sourceKey),
  profileSourceIdx: index("radar360_import_items_profile_source_idx").on(t.profileId, t.sourceKey, t.createdAt.desc()),
}));

export const radar360RunsTable = pgTable("radar360_runs", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => radar360ProfilesTable.id),
  companyId: integer("company_id"),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").notNull().default("draft"),
  sourceKinds: jsonb("source_kinds").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  sourceCoverage: jsonb("source_coverage").$type<Array<Record<string, unknown>>>().notNull().default(sql`'[]'::jsonb`),
  baseDate: text("base_date").notNull(),
  scoreVersion: text("score_version").notNull().default("radar360-fit-v1"),
  scoreWeights: jsonb("score_weights").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
  editionText: text("edition_text"),
  imageFileId: integer("image_file_id"),
  imageChecksum: text("image_checksum"),
  pendingFields: jsonb("pending_fields").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  warnings: jsonb("warnings").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  lastError: text("last_error"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
}, (t) => ({
  profileIdempotencyUnique: uniqueIndex("radar360_runs_profile_idempotency_uidx").on(t.profileId, t.idempotencyKey),
  profileIdx: index("radar360_runs_profile_idx").on(t.profileId, t.createdAt.desc()),
  statusCheck: check("radar360_runs_status_check", sql`${t.status} IN ('draft', 'validation', 'ready', 'published', 'failed')`),
}));

export const radar360RunItemsTable = pgTable("radar360_run_items", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull().references(() => radar360RunsTable.id),
  sourceKey: text("source_key").notNull(),
  sourceName: text("source_name").notNull(),
  processNumber: text("process_number"),
  object: text("object").notNull(),
  contractor: text("contractor"),
  deadlineText: text("deadline_text"),
  timeZone: text("time_zone"),
  sourceUrl: text("source_url"),
  sourceCheckedAt: timestamp("source_checked_at", { withTimezone: true }),
  sourceTimeKnown: boolean("source_time_known").notNull().default(false),
  sector: text("sector"),
  region: text("region"),
  value: real("value"),
  status: text("status"),
  justification: text("justification").notNull(),
  pendingFields: jsonb("pending_fields").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  action: text("action").notNull(),
  urgency: text("urgency").notNull().default("pending"),
  fitScore: integer("fit_score"),
  scoreBreakdown: jsonb("score_breakdown").$type<Radar360ScoreLine[]>().notNull().default(sql`'[]'::jsonb`),
  category: text("category").notNull(),
  expired: boolean("expired").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ({
  runSourceUnique: uniqueIndex("radar360_run_items_run_source_uidx").on(t.runId, t.sourceKey),
  runOrderIdx: index("radar360_run_items_order_idx").on(t.runId, t.sortOrder),
  categoryCheck: check("radar360_run_items_category_check", sql`${t.category} IN ('gold', 'complementary', 'discarded')`),
  urgencyCheck: check("radar360_run_items_urgency_check", sql`${t.urgency} IN ('expired', 'today', 'urgent', 'soon', 'future', 'pending')`),
}));

export const radar360EventsTable = pgTable("radar360_events", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => radar360ProfilesTable.id),
  runId: integer("run_id").references(() => radar360RunsTable.id),
  importId: integer("import_id").references(() => radar360ImportsTable.id),
  eventType: text("event_type").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull(),
  actorId: integer("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  profileEventIdx: index("radar360_events_profile_created_idx").on(t.profileId, t.createdAt.desc()),
  runEventIdx: index("radar360_events_run_created_idx").on(t.runId, t.createdAt.desc()),
  importEventIdx: index("radar360_events_import_created_idx").on(t.importId, t.createdAt.desc()),
  statusCheck: check("radar360_events_status_check", sql`${t.status} IN ('pending', 'success', 'failure')`),
}));

export type Radar360Profile = typeof radar360ProfilesTable.$inferSelect;
export type Radar360File = typeof radar360FilesTable.$inferSelect;
export type Radar360Import = typeof radar360ImportsTable.$inferSelect;
export type Radar360ImportItem = typeof radar360ImportItemsTable.$inferSelect;
export type Radar360Run = typeof radar360RunsTable.$inferSelect;
export type Radar360RunItem = typeof radar360RunItemsTable.$inferSelect;
export type Radar360Event = typeof radar360EventsTable.$inferSelect;
