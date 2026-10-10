import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const ssoRequestsTable = pgTable("sso_requests", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  phone: text("phone"),
  provider: text("provider").notNull().default("SSO"),
  companyName: text("company_name"),
  requestedRole: text("requested_role").notNull().default("operator"),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type SsoRequest = typeof ssoRequestsTable.$inferSelect;
export type InsertSsoRequest = typeof ssoRequestsTable.$inferInsert;
