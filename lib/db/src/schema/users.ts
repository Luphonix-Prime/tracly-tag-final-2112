import { pgTable, serial, integer, text, boolean } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  enabledModules: text("enabled_modules").notNull().default("dashboard,companies,users,products,locations,batches,generate_codes,mapping_code,customer_scan,summary,reports"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
