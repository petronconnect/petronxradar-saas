import { pgTable, serial, text, integer, date, jsonb, timestamp, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const petronectPublicImportRunsTable = pgTable("petronect_public_import_runs", {
  id: serial("id").primaryKey(),
  fileName: text("file_name"),
  status: text("status").notNull().default("pending"),
  totalRows: integer("total_rows").notNull().default(0),
  newRows: integer("new_rows").notNull().default(0),
  updatedRows: integer("updated_rows").notNull().default(0),
  unchangedRows: integer("unchanged_rows").notNull().default(0),
  duplicateRows: integer("duplicate_rows").notNull().default(0),
  invalidRows: integer("invalid_rows").notNull().default(0),
  errorMessage: text("error_message"),
  previewRows: jsonb("preview_rows").$type<Array<Record<string, unknown>> | null>(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => ({
  statusCheck: check("petronect_public_import_runs_status_check", sql`${t.status} IN ('pending', 'success', 'failed')`),
  createdAtIdx: index("petronect_public_import_runs_created_at_idx").on(t.createdAt.desc()),
}));

export const petronectPublicOpportunitiesTable = pgTable("petronect_public_opportunities", {
  id: serial("id").primaryKey(),
  petronectId: text("petronect_id").notNull(),
  title: text("title").notNull(),
  subStatus: text("sub_status"),
  company: text("company"),
  scope: text("scope"),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  processType: text("process_type"),
  deliveryLocation: text("delivery_location"),
  lastImportRunId: integer("last_import_run_id").references(() => petronectPublicImportRunsTable.id),
  sourceFirstSeenAt: timestamp("source_first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  petronectIdUnique: uniqueIndex("petronect_public_opportunities_petronect_id_uidx").on(t.petronectId),
  sourceUpdatedIdx: index("petronect_public_opportunities_source_updated_idx").on(t.sourceUpdatedAt.desc()),
}));

export const petronectPublicChangesTable = pgTable("petronect_public_changes", {
  id: serial("id").primaryKey(),
  importRunId: integer("import_run_id").notNull().references(() => petronectPublicImportRunsTable.id),
  publicOpportunityId: integer("public_opportunity_id").notNull().references(() => petronectPublicOpportunitiesTable.id),
  changeType: text("change_type").notNull(),
  beforeData: jsonb("before_data").$type<Record<string, unknown> | null>(),
  afterData: jsonb("after_data").$type<Record<string, unknown>>().notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueRunChange: uniqueIndex("petronect_public_changes_run_opportunity_uidx").on(t.importRunId, t.publicOpportunityId),
  changeTypeCheck: check("petronect_public_changes_type_check", sql`${t.changeType} IN ('new', 'updated')`),
  changedAtIdx: index("petronect_public_changes_changed_at_idx").on(t.changedAt.desc()),
}));
