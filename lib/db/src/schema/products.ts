import { pgTable, serial, integer, text, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id, { onDelete: "cascade" }),
  skuId: text("sku_id").notNull(),
  name: text("name").notNull(),
  skuSize: text("sku_size").notNull(),
  marketedBy: text("marketed_by").notNull(),
  sapDescription: text("sap_description"),
  gtin: text("gtin"),
  mrp: doublePrecision("mrp").notNull(),
  registrationNo: text("registration_no"),
  hsnCode: text("hsn_code"),
  gstRate: doublePrecision("gst_rate"),
  unit: text("unit"),
  weightValue: doublePrecision("weight_value"),
  weightUnit: text("weight_unit"),
  packagingType: text("packaging_type"),
  shelfLifeDays: integer("shelf_life_days"),
  countryOfOrigin: text("country_of_origin").$defaultFn(() => "IND"),
  isGs1Compliant: boolean("is_gs1_compliant").default(false),
  l1Size: integer("l1_size").notNull(),
  l2Size: integer("l2_size").notNull(),
  shipperSize: integer("shipper_size").notNull(),
  cautionLogoUrl: text("caution_logo_url"),
  productLogoUrl: text("product_logo_url"),
  labelPdfUrl: text("label_pdf_url"),
  expiryDate: text("expiry_date").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type Product = typeof productsTable.$inferSelect;
export type InsertProduct = typeof productsTable.$inferInsert;
