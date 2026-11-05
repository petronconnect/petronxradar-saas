import { pgTable, serial, integer, text, timestamp, unique, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companyUsersTable } from "./index";

export const googleIdentitiesTable = pgTable("google_identities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => companyUsersTable.id, { onDelete: "cascade" }),
  issuer: text("issuer").notNull(),
  subject: text("subject").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [unique().on(table.issuer, table.subject)]);

export const oauthFlowsTable = pgTable("oauth_flows", {
  stateHash: text("state_hash").primaryKey(),
  browserHash: text("browser_hash").notNull(),
  purpose: text("purpose").notNull(),
  userId: integer("user_id").references(() => companyUsersTable.id, { onDelete: "cascade" }),
  nonce: text("nonce").notNull(),
  verifier: text("verifier").notNull(),
  destination: text("destination").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [
  index("oauth_flows_expiry_idx").on(table.expiresAt),
  check("oauth_flows_purpose_check", sql`${table.purpose} IN ('login','link','register','reauth')`),
]);
