import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { codesTable } from "./codes";

export const customerScansTable = pgTable("customer_scans", {
  id: serial("id").primaryKey(),
  codeId: integer("code_id").notNull().references(() => codesTable.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  mobileNumber: text("mobile_number").notNull(),
  zipCode: text("zip_code").notNull(),
  city: text("city").notNull(),
  scanTime: text("scan_time").notNull(),
  scanDate: text("scan_date").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type CustomerScan = typeof customerScansTable.$inferSelect;
export type InsertCustomerScan = typeof customerScansTable.$inferInsert;
