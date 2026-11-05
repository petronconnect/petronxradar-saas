import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, real, boolean, timestamp, date, unique, index, check } from "drizzle-orm/pg-core";
export { sql };
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export * from "./radar360";

// Shared opportunity catalog: only public tender metadata belongs here.
export const opportunitiesTable = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  sector: text("sector").notNull(),
  company: text("company").notNull(),
  value: real("value").notNull(),
  status: text("status").notNull().default("ativa"),
  region: text("region").notNull(),
  description: text("description"),
  deadline: text("deadline"),
  petronectId: text("petronect_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOpportunitySchema = createInsertSchema(opportunitiesTable).omit({ id: true, createdAt: true });
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type Opportunity = typeof opportunitiesTable.$inferSelect;

// Curated source documents are a separate resource, not catalog row fields.
export const opportunityDocumentsTable = pgTable("opportunity_documents", {
  id: serial("id").primaryKey(),
  opportunityId: integer("opportunity_id").notNull(),
  kind: text("kind").notNull().default("outro"),
  label: text("label").notNull(),
  url: text("url").notNull(),
  createdBy: integer("created_by"),
  linkTestedAt: timestamp("link_tested_at", { withTimezone: true }),
  linkTestedBy: integer("link_tested_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type OpportunityDocument = typeof opportunityDocumentsTable.$inferSelect;

export const opportunityDocumentReviewsTable = pgTable("opportunity_document_reviews", {
  opportunityId: integer("opportunity_id").primaryKey(),
  status: text("status").notNull().default("pending"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: integer("verified_by"),
  sourceDocumentId: integer("source_document_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  statusCheck: check("opportunity_document_reviews_status_check", sql`${t.status} IN ('pending', 'verified')`),
}));

export type OpportunityDocumentReview = typeof opportunityDocumentReviewsTable.$inferSelect;

// Tenant-private tracking and notes; companyId is always taken from the session.
export const opportunityPortfolioTable = pgTable("opportunity_portfolio", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  opportunityId: integer("opportunity_id").notNull(),
  stage: text("stage").notNull().default("avaliando"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  companyOpportunityUnique: unique().on(t.companyId, t.opportunityId),
}));

export type OpportunityPortfolio = typeof opportunityPortfolioTable.$inferSelect;

// Bulletins
export const bulletinsTable = pgTable("bulletins", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  summary: text("summary").notNull(),
  content: text("content"),
  author: text("author").notNull(),
  tags: text("tags").array(),
  companyId: integer("company_id"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
});

export const insertBulletinSchema = createInsertSchema(bulletinsTable).omit({ id: true, publishedAt: true });
export type InsertBulletin = z.infer<typeof insertBulletinSchema>;
export type Bulletin = typeof bulletinsTable.$inferSelect;

// Clients
export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  segment: text("segment").notNull(),
  plan: text("plan").notNull(),
  status: text("status").notNull().default("ativo"),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;

// Inquiries (lead capture)
export const inquiriesTable = pgTable("inquiries", {
  cidade: text("cidade"),
  estado: text("estado"),
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  cnpj: text("cnpj").notNull(),
  contactName: text("contact_name").notNull(),
  contactRole: text("contact_role").notNull(),
  email: text("email").notNull(),
  whatsapp: text("whatsapp").notNull(),
  segment: text("segment").notNull(),
  servicesOffered: text("services_offered").notNull(),
  hasPetrobrasRegistration: boolean("has_petrobras_registration").notNull().default(false),
  availableDocuments: text("available_documents"),
  interestedInBidding: boolean("interested_in_bidding").notNull().default(false),
  operationalVolume: text("operational_volume").notNull(),
  regions: text("regions").notNull(),
  desiredPlan: text("desired_plan").notNull(),
  allowContact: boolean("allow_contact").notNull().default(true),
  notes: text("notes"),
  status: text("status").notNull().default("novo"),
  leadScore: integer("lead_score").notNull().default(0),
  source: text("source").notNull().default("formulario-web"),
  recommendedPlan: text("recommended_plan").notNull().default("radar-pro"),
  convertedClientId: integer("converted_client_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInquirySchema = createInsertSchema(inquiriesTable).omit({ id: true, createdAt: true, status: true, leadScore: true, source: true, recommendedPlan: true, convertedClientId: true });
export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type Inquiry = typeof inquiriesTable.$inferSelect;

// Petroconnect sync log
export const petroconnectSyncLogTable = pgTable("petroconnect_sync_log", {
  id: serial("id").primaryKey(),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  entities: text("entities").notNull(),
  totalSynced: integer("total_synced").notNull().default(0),
  status: text("status").notNull().default("success"),
  errorMessage: text("error_message"),
});

export type PetroconnectSyncLog = typeof petroconnectSyncLogTable.$inferSelect;

// Petroconnect config (single row)
export const petroconnectConfigTable = pgTable("petroconnect_config", {
  id: serial("id").primaryKey(),
  connected: boolean("connected").notNull().default(false),
  apiKey: text("api_key"),
  accountId: text("account_id"),
  accountName: text("account_name"),
  lastSyncAt: timestamp("last_sync_at"),
  syncedClients: integer("synced_clients").notNull().default(0),
  syncedOpportunities: integer("synced_opportunities").notNull().default(0),
  syncedDocuments: integer("synced_documents").notNull().default(0),
  syncedBulletins: integer("synced_bulletins").notNull().default(0),
});

export type PetroconnectConfig = typeof petroconnectConfigTable.$inferSelect;

// Beta Clients
export const betaClientsTable = pgTable("beta_clients", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  companyName: text("company_name").notNull(),
  tradeName: text("trade_name").notNull(),
  cnpj: text("cnpj").notNull(),
  segment: text("segment").notNull(),
  size: text("size").notNull(),
  legalNature: text("legal_nature").notNull(),
  simplesNacional: boolean("simples_nacional").notNull().default(false),
  isHeadquarters: boolean("is_headquarters").notNull().default(true),
  openedAt: text("opened_at").notNull(),
  capital: real("capital").notNull(),
  cadastralStatus: text("cadastral_status").notNull().default("ativa"),
  stateRegistrations: text("state_registrations").array(),
  petrobrasRegistration: boolean("petrobras_registration").notNull().default(false),
  priority: text("priority").notNull().default("media"),
  clientStatus: text("client_status").notNull().default("prospecto"),
  onboardingStatus: text("onboarding_status").notNull().default("pendente"),
  commercialReady: boolean("commercial_ready").notNull().default(false),
  contactName: text("contact_name"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  city: text("city"),
  state: text("state"),
  desiredPlan: text("desired_plan"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BetaClient = typeof betaClientsTable.$inferSelect;

export const betaClientChecklistTable = pgTable("beta_client_checklist", {
  id: serial("id").primaryKey(),
  betaClientId: integer("beta_client_id").notNull(),
  label: text("label").notNull(),
  completed: boolean("completed").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
});

export type BetaClientChecklist = typeof betaClientChecklistTable.$inferSelect;

// ─── Company Accounts (empresas cadastradas) ────────────────────────────────
export const companyAccountsTable = pgTable("company_accounts", {
  id: serial("id").primaryKey(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  cidade: text("cidade").notNull(),
  estado: text("estado").notNull(),
  email: text("email").notNull(),
  telefone: text("telefone"),
  whatsapp: text("whatsapp"),
  segmento: text("segmento").notNull(),
  socioAdministrador: text("socio_administrador"),
  capitalSocial: real("capital_social"),
  status: text("status").notNull().default("ativa"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCompanyAccountSchema = createInsertSchema(companyAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompanyAccount = z.infer<typeof insertCompanyAccountSchema>;
export type CompanyAccount = typeof companyAccountsTable.$inferSelect;

// ─── Company Users (usuários vinculados às empresas) ─────────────────────────
export const companyUsersTable = pgTable("company_users", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordEnabled: boolean("password_enabled").notNull().default(true),
  role: text("role").notNull().default("USUARIO_CLIENTE"),
  ativo: boolean("ativo").notNull().default(true),
  mustSetPassword: boolean("must_set_password").notNull().default(false),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export type CompanyUser = typeof companyUsersTable.$inferSelect;

// ─── Administrative access recovery audit ───────────────────────────────────
export const adminRecoveryAuditTable = pgTable("admin_recovery_audit", {
  id: serial("id").primaryKey(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  result: text("result").notNull(),
}, (t) => ({
  attemptedAtIdx: index("admin_recovery_audit_attempted_at_idx").on(t.attemptedAt.desc()),
  resultCheck: check(
    "admin_recovery_audit_result_check",
    sql`${t.result} IN ('in_progress', 'invalid_credential', 'rate_limited', 'success', 'unavailable', 'error', 'interrupted')`,
  ),
}));

export type AdminRecoveryAudit = typeof adminRecoveryAuditTable.$inferSelect;

// Shared, expiring authentication throttling state. Keys are SHA-256 digests,
// never raw email addresses or IP addresses.
export const authFailureLimitsTable = pgTable("auth_failure_limits", {
  limiterKey: text("limiter_key").primaryKey(),
  failures: integer("failures").notNull().default(0),
  pending: integer("pending").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }).notNull(),
  lockouts: integer("lockouts").notNull().default(0),
  pendingExpiresAt: timestamp("pending_expires_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => ({
  expiresAtIdx: index("auth_failure_limits_expires_at_idx").on(t.expiresAt),
}));

export type AuthFailureLimit = typeof authFailureLimitsTable.$inferSelect;

// ─── Subscriptions (assinaturas) ─────────────────────────────────────────────
export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().unique(),
  planSlug: text("plan_slug").notNull(),
  status: text("status").notNull().default("ativo"),
  startDate: date("start_date", { mode: "string" }).notNull(),
  renewalDate: date("renewal_date", { mode: "string" }).notNull(),
  lastPaymentAt: timestamp("last_payment_at", { withTimezone: true }),
  lastPaymentAmount: real("last_payment_amount"),
  nextBillingAmount: real("next_billing_amount"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;

// Plans
export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  price: real("price").notNull(),
  period: text("period").notNull().default("mês"),
  description: text("description").notNull(),
  targetAudience: text("target_audience").notNull(),
  opportunityLimit: integer("opportunity_limit"),
  bulletinLimit: integer("bulletin_limit"),
  clientLimit: integer("client_limit"),
  highlighted: boolean("highlighted").notNull().default(false),
  badge: text("badge"),
  ctaLabel: text("cta_label").notNull(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;

// ─── Payments (Mercado Pago Pix) ─────────────────────────────────────────────
// Also written via raw SQL; mirrored here so drizzle-kit push never drops it.
// created_at / paid_at are timestamp WITHOUT time zone (match live table).
export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  inquiryId: integer("inquiry_id"),
  mpPaymentId: text("mp_payment_id"),
  status: text("status").notNull().default("pending"),
  planSlug: text("plan_slug").notNull(),
  amount: real("amount").notNull(),
  pixQrCode: text("pix_qr_code"),
  pixQrCodeBase64: text("pix_qr_code_base64"),
  pixCopyPaste: text("pix_copy_paste"),
  payerEmail: text("payer_email"),
  payerName: text("payer_name"),
  createdAt: timestamp("created_at").defaultNow(),
  paidAt: timestamp("paid_at"),
  claimTokenHash: text("claim_token_hash"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  provisionedAt: timestamp("provisioned_at", { withTimezone: true }),
  provisionedUserId: integer("provisioned_user_id"),
  payerCnpj: text("payer_cnpj"),
  googleIssuer: text("google_issuer"),
  googleSubject: text("google_subject"),
  googleEmail: text("google_email"),
  newAccountCreated: boolean("new_account_created").notNull().default(false),
  recoveryTokenHash: text("recovery_token_hash"),
  recoveryExpiresAt: timestamp("recovery_expires_at", { withTimezone: true }),
});

export type Payment = typeof paymentsTable.$inferSelect;
export * from "./google-auth";
export * from "./petronect-public";
export * from "./notifications";
