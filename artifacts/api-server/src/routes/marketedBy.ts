import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, marketedByTable, companiesTable } from "@workspace/db";
import { requireAuth } from '../lib/session.js';
import { z } from "@workspace/api-zod";

const router: IRouter = Router();

router.use("/marketed-by", requireAuth);

const marketedBySchema = z.object({
  companyId: z.coerce.number().optional().nullable(),
  name: z.string().min(1, "Marketed By entity name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  gstin: z.string().optional().or(z.literal("")),
  pan: z.string().optional().or(z.literal("")),
  cin: z.string().optional().or(z.literal("")),
  fssaiLicenseNo: z.string().optional().or(z.literal("")),
  drugLicenseNo: z.string().optional().or(z.literal("")),
});

// GET /api/marketed-by
router.get("/marketed-by", async (req, res): Promise<void> => {
  const isMaster = req.user!.role === "master" || req.user!.role === "super_master";
  const userCompanyId = req.user!.companyId;

  let query = db
    .select({
      id: marketedByTable.id,
      companyId: marketedByTable.companyId,
      companyName: companiesTable.name,
      name: marketedByTable.name,
      email: marketedByTable.email,
      phone: marketedByTable.phone,
      address: marketedByTable.address,
      gstin: marketedByTable.gstin,
      pan: marketedByTable.pan,
      cin: marketedByTable.cin,
      fssaiLicenseNo: marketedByTable.fssaiLicenseNo,
      drugLicenseNo: marketedByTable.drugLicenseNo,
      createdAt: marketedByTable.createdAt,
    })
    .from(marketedByTable)
    .leftJoin(companiesTable, eq(marketedByTable.companyId, companiesTable.id))
    .orderBy(desc(marketedByTable.createdAt));

  if (!isMaster) {
    if (!userCompanyId) {
      res.json([]);
      return;
    }
    const rows = await query.where(eq(marketedByTable.companyId, userCompanyId));
    res.json(rows);
    return;
  }

  const rows = await query;
  res.json(rows);
});

// POST /api/marketed-by
router.post("/marketed-by", async (req, res): Promise<void> => {
  try {
    const parsed = marketedBySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
      return;
    }

    const isMaster = req.user!.role === "master" || req.user!.role === "super_master";
    let targetCompanyId = isMaster
      ? (parsed.data.companyId ?? null)
      : (req.user!.companyId || parsed.data.companyId || null);

    if (!targetCompanyId && !isMaster) {
      res.status(403).json({ error: "No assigned parent company found for your user account." });
      return;
    }

    if (targetCompanyId) {
      const [comp] = await db
        .select({ id: companiesTable.id })
        .from(companiesTable)
        .where(eq(companiesTable.id, Number(targetCompanyId)));
      if (!comp) {
        res.status(400).json({ error: `Parent company #${targetCompanyId} not found` });
        return;
      }
    }

    const [row] = await db
      .insert(marketedByTable)
      .values({
        companyId: targetCompanyId ? Number(targetCompanyId) : null,
        name: parsed.data.name.trim(),
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        gstin: parsed.data.gstin ? parsed.data.gstin.trim().toUpperCase() : null,
        pan: parsed.data.pan ? parsed.data.pan.trim().toUpperCase() : null,
        cin: parsed.data.cin ? parsed.data.cin.trim().toUpperCase() : null,
        fssaiLicenseNo: parsed.data.fssaiLicenseNo || null,
        drugLicenseNo: parsed.data.drugLicenseNo || null,
      })
      .returning();

    res.status(201).json(row);
  } catch (err: any) {
    req.log?.error?.({ err }, "Failed to create marketed-by entity");
    res.status(500).json({ error: err.message || "Failed to create entity" });
  }
});

// PUT /api/marketed-by/:id
router.put("/marketed-by/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = marketedBySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
      return;
    }

    const [existing] = await db.select().from(marketedByTable).where(eq(marketedByTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Record not found" });
      return;
    }

    const isMaster = req.user!.role === "master" || req.user!.role === "super_master";
    if (!isMaster && existing.companyId && req.user!.companyId && existing.companyId !== req.user!.companyId) {
      res.status(403).json({ error: "Forbidden: Cannot edit record for another company" });
      return;
    }

    const targetCompanyId = isMaster
      ? (parsed.data.companyId !== undefined ? parsed.data.companyId : existing.companyId)
      : (existing.companyId || req.user!.companyId || null);

    const [updated] = await db
      .update(marketedByTable)
      .set({
        companyId: targetCompanyId ? Number(targetCompanyId) : null,
        name: parsed.data.name.trim(),
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        gstin: parsed.data.gstin ? parsed.data.gstin.trim().toUpperCase() : null,
        pan: parsed.data.pan ? parsed.data.pan.trim().toUpperCase() : null,
        cin: parsed.data.cin ? parsed.data.cin.trim().toUpperCase() : null,
        fssaiLicenseNo: parsed.data.fssaiLicenseNo || null,
        drugLicenseNo: parsed.data.drugLicenseNo || null,
      })
      .where(eq(marketedByTable.id, id))
      .returning();

    res.json(updated);
  } catch (err: any) {
    req.log?.error?.({ err }, "Failed to update marketed-by entity");
    res.status(500).json({ error: err.message || "Failed to update entity" });
  }
});

// DELETE /api/marketed-by/:id
router.delete("/marketed-by/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [existing] = await db.select().from(marketedByTable).where(eq(marketedByTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Record not found" });
      return;
    }

    const isMaster = req.user!.role === "master" || req.user!.role === "super_master";
    if (!isMaster && existing.companyId && req.user!.companyId && existing.companyId !== req.user!.companyId) {
      res.status(403).json({ error: "Forbidden: Cannot delete record for another company" });
      return;
    }

    await db.delete(marketedByTable).where(eq(marketedByTable.id, id));
    res.sendStatus(204);
  } catch (err: any) {
    req.log?.error?.({ err }, "Failed to delete marketed-by entity");
    res.status(500).json({ error: err.message || "Failed to delete entity" });
  }
});

export default router;