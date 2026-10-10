import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const deviceCodesTable = pgTable("device_codes", {
  id: serial("id").primaryKey(),
  deviceCode: text("device_code").notNull().unique(),
  userCode: text("user_code").notNull().unique(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // 'pending', 'approved', 'expired', 'denied'
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type DeviceCode = typeof deviceCodesTable.$inferSelect;
export type InsertDeviceCode = typeof deviceCodesTable.$inferInsert;
