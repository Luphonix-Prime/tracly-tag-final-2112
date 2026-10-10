import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const passkeysTable = pgTable("passkeys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type Passkey = typeof passkeysTable.$inferSelect;
export type InsertPasskey = typeof passkeysTable.$inferInsert;
