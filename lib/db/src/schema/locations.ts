import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const locationsTable = pgTable("locations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "cascade" }),
  locationType: text("location_type").notNull(),
  uniqueName: text("unique_name").notNull(),
  locationName: text("location_name").notNull(),
  contactNo: text("contact_no").notNull(),
  state: text("state").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  gln: text("gln"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type Location = typeof locationsTable.$inferSelect;
export type InsertLocation = typeof locationsTable.$inferInsert;
