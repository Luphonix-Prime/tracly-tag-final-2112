import { Router, type IRouter } from "express";
import { eq, desc, and, or } from "drizzle-orm";
import { db, productsTable, companiesTable } from "@workspace/db";
import { CreateProductBody } from "@workspace/api-zod";
import { requireAuth, requireModule } from '../lib/session.js';
import { isValidGtin } from '../lib/gs1.js';

const router: IRouter = Router();

router.use("/products", requireAuth, requireModule("products"));

function effectiveCompanyId(user: NonNullable<typeof globalThis> extends never ? never : { role: string; companyId: number | null }): number | null {
  if (user.role === "master" || user.role === "super_master") return null;
  return user.companyId;
}

router.get("/products", async (req, res): Promise<void> => {
  const isMaster = req.user!.role === "master" || req.user!.role === "super_master";
  const rows = isMaster
    ? await db
        .select({
          product: productsTable,
          companyGstin: companiesTable.gstin,
          companyName: companiesTable.name,
        })
        .from(productsTable)
        .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
        .orderBy(desc(productsTable.createdAt))
    : req.user!.companyId
      ? await db
          .select({
            product: productsTable,
            companyGstin: companiesTable.gstin,
            companyName: companiesTable.name,
          })
          .from(productsTable)
          .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
          .where(eq(productsTable.companyId, req.user!.companyId))
          .orderBy(desc(productsTable.createdAt))
      : [];
  res.json(
    rows.map((r) => ({
      ...r.product,
      companyGstin: r.companyGstin || null,
      companyName: r.companyName || null,
      mrp: typeof r.product.mrp === "string" ? parseFloat(r.product.mrp) : r.product.mrp,
      description: r.product.sapDescription || "",
    })),
  );
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let companyId = (req.user!.role === "master" || req.user!.role === "super_master")
    ? (req.body.companyId || req.query.companyId || null)
    : req.user!.companyId;

  if (!companyId && req.user!.role !== "master" && req.user!.role !== "super_master") {
    res.status(403).json({ error: "Forbidden: User has no assigned company context" });
    return;
  }

  const isGs1Compliant = parsed.data.isGs1Compliant ?? false;

  if (isGs1Compliant) {
    if (!parsed.data.gtin) {
      if (companyId) {
        const [company] = await db
          .select({ gstin: companiesTable.gstin })
          .from(companiesTable)
          .where(eq(companiesTable.id, Number(companyId)));

        if (!company || !company.gstin) {
          res.status(400).json({ error: "GTIN or Company GST is required for GS1 compliant products" });
          return;
        }
      } else {
        res.status(400).json({ error: "GTIN is required for GS1 compliant products without company GSTIN" });
        return;
      }
    } else {
      if (!isValidGtin(parsed.data.gtin)) {
        res.status(400).json({ error: "Invalid GTIN check digit" });
        return;
      }
    }
  }

  // Prevent duplicate product creation (by SKU ID, Product Name, or GTIN)
  const productConditions = [
    eq(productsTable.skuId, parsed.data.skuId.trim()),
    eq(productsTable.name, parsed.data.name.trim()),
  ];
  if (parsed.data.gtin && parsed.data.gtin.trim()) {
    productConditions.push(eq(productsTable.gtin, parsed.data.gtin.trim()));
  }

  const existingProduct = await db
    .select({ id: productsTable.id, skuId: productsTable.skuId, name: productsTable.name, gtin: productsTable.gtin })
    .from(productsTable)
    .where(
      companyId
        ? and(eq(productsTable.companyId, Number(companyId)), or(...productConditions))
        : or(...productConditions)
    )
    .limit(1);

  if (existingProduct.length > 0) {
    const match = existingProduct[0];
    if (match.skuId.toLowerCase() === parsed.data.skuId.trim().toLowerCase()) {
      res.status(409).json({ error: `A product with SKU ID '${parsed.data.skuId}' already exists.` });
      return;
    }
    if (match.name.toLowerCase() === parsed.data.name.trim().toLowerCase()) {
      res.status(409).json({ error: `A product with name '${parsed.data.name}' already exists.` });
      return;
    }
    if (parsed.data.gtin && match.gtin === parsed.data.gtin.trim()) {
      res.status(409).json({ error: `A product with GTIN '${parsed.data.gtin}' already exists.` });
      return;
    }
  }

  const [row] = await db
    .insert(productsTable)
    .values({
      companyId: companyId ? Number(companyId) : null,
      skuId: parsed.data.skuId,
      name: parsed.data.name,
      skuSize: parsed.data.skuSize,
      marketedBy: parsed.data.marketedBy,
      sapDescription: parsed.data.sapDescription ?? null,
      gtin: parsed.data.gtin ?? null,
      mrp: Number(parsed.data.mrp),
      registrationNo: parsed.data.registrationNo ?? null,
      hsnCode: parsed.data.hsnCode ?? null,
      gstRate: parsed.data.gstRate !== undefined && parsed.data.gstRate !== null ? Number(parsed.data.gstRate) : null,
      unit: parsed.data.unit ?? null,
      weightValue: parsed.data.weightValue !== undefined && parsed.data.weightValue !== null ? Number(parsed.data.weightValue) : null,
      weightUnit: parsed.data.weightUnit ?? null,
      packagingType: parsed.data.packagingType ?? null,
      shelfLifeDays: parsed.data.shelfLifeDays !== undefined && parsed.data.shelfLifeDays !== null ? Number(parsed.data.shelfLifeDays) : null,
      countryOfOrigin: parsed.data.countryOfOrigin ?? "IND",
      isGs1Compliant,
      l1Size: parsed.data.l1Size,
      l2Size: parsed.data.l2Size,
      shipperSize: parsed.data.shipperSize,
      cautionLogoUrl: parsed.data.cautionLogoUrl ?? null,
      productLogoUrl: parsed.data.productLogoUrl ?? null,
      labelPdfUrl: parsed.data.labelPdfUrl ?? null,
      expiryDate:
        parsed.data.expiryDate instanceof Date
          ? parsed.data.expiryDate.toISOString().slice(0, 10)
          : String(parsed.data.expiryDate).slice(0, 10),
    })
    .returning();
  res.status(201).json({
    ...row,
    mrp: typeof row!.mrp === "string" ? parseFloat(row!.mrp) : row!.mrp,
  });
});

router.put("/products/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [targetProduct] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id));

  if (!targetProduct) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (req.user!.role !== "master" && req.user!.role !== "super_master") {
    if (!req.user!.companyId || targetProduct.companyId !== req.user!.companyId) {
      res.status(403).json({ error: "Forbidden: Cannot edit products outside your assigned company" });
      return;
    }
  }

  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const isGs1Compliant = parsed.data.isGs1Compliant ?? false;

  if (isGs1Compliant) {
    if (parsed.data.gtin && !isValidGtin(parsed.data.gtin)) {
      res.status(400).json({ error: "Invalid GTIN check digit" });
      return;
    }
  }

  const expiryDateStr = parsed.data.expiryDate instanceof Date
    ? parsed.data.expiryDate.toISOString().slice(0, 10)
    : String(parsed.data.expiryDate).slice(0, 10);

  const [row] = await db
    .update(productsTable)
    .set({
      skuId: parsed.data.skuId,
      name: parsed.data.name,
      skuSize: parsed.data.skuSize,
      marketedBy: parsed.data.marketedBy,
      sapDescription: parsed.data.sapDescription ?? null,
      gtin: parsed.data.gtin ?? null,
      mrp: Number(parsed.data.mrp),
      registrationNo: parsed.data.registrationNo ?? null,
      hsnCode: parsed.data.hsnCode ?? null,
      gstRate: parsed.data.gstRate !== undefined && parsed.data.gstRate !== null ? Number(parsed.data.gstRate) : null,
      unit: parsed.data.unit ?? null,
      weightValue: parsed.data.weightValue !== undefined && parsed.data.weightValue !== null ? Number(parsed.data.weightValue) : null,
      weightUnit: parsed.data.weightUnit ?? null,
      packagingType: parsed.data.packagingType ?? null,
      shelfLifeDays: parsed.data.shelfLifeDays !== undefined && parsed.data.shelfLifeDays !== null ? Number(parsed.data.shelfLifeDays) : null,
      countryOfOrigin: parsed.data.countryOfOrigin ?? "IND",
      isGs1Compliant,
      l1Size: parsed.data.l1Size,
      l2Size: parsed.data.l2Size,
      shipperSize: parsed.data.shipperSize,
      cautionLogoUrl: parsed.data.cautionLogoUrl ?? null,
      productLogoUrl: parsed.data.productLogoUrl ?? null,
      labelPdfUrl: parsed.data.labelPdfUrl ?? null,
      expiryDate: expiryDateStr,
    })
    .where(eq(productsTable.id, id))
    .returning();

  res.json({
    ...row,
    mrp: typeof row.mrp === "string" ? parseFloat(row.mrp) : row.mrp,
  });
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [targetProduct] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id));

  if (!targetProduct) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (req.user!.role !== "master" && req.user!.role !== "super_master") {
    if (!req.user!.companyId || targetProduct.companyId !== req.user!.companyId) {
      res.status(403).json({ error: "Forbidden: Cannot delete products outside your assigned company" });
      return;
    }
  }

  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

export default router;
