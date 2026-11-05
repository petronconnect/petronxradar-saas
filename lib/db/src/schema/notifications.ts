import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const userNotificationsTable = pgTable("user_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  kind: text("kind").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  href: text("href"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
}, (table) => ({
  userDedupeUnique: uniqueIndex("user_notifications_user_dedupe_unique")
    .on(table.userId, table.dedupeKey),
  userCreatedAtIdx: index("user_notifications_user_created_at_idx")
    .on(table.userId, table.createdAt.desc()),
}));

export type UserNotification = typeof userNotificationsTable.$inferSelect;
