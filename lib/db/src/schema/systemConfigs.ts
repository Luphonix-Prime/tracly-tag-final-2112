import { pgTable, text } from "drizzle-orm/pg-core";

export const systemConfigsTable = pgTable("system_configs", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type SystemConfig = typeof systemConfigsTable.$inferSelect;
export type InsertSystemConfig = typeof systemConfigsTable.$inferInsert;
