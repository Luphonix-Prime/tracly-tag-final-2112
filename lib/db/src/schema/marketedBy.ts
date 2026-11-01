import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies.js";

export const marketedByTable = pgTable("marketed_by", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  gstin: text("gstin"),
  pan: text("pan"),
  cin: text("cin"),
  fssaiLicenseNo: text("fssai_license_no"),
  drugLicenseNo: text("drug_license_no"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type MarketedBy = typeof marketedByTable.$inferSelect;
export type InsertMarketedBy = typeof marketedByTable.$inferInsert;