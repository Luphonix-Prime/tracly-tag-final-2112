import { Router, type IRouter } from "express";
import { and, eq, desc, inArray, or, sql } from "drizzle-orm";
import {
  db,
  codesTable,
  productsTable,
  batchesTable,
  locationsTable,
  usersTable,
  companiesTable,
  customerScansTable,
  counterTable,
} from "@workspace/db";
import { GenerateCodesBody, MapCodeBody } from "@workspace/api-zod";
import { requireAuth, requireModule } from '../lib/session.js';
import { generateUnitCode, generateSsccCode, parseGs1Code, isValidGtin } from '../lib/gs1.js';

const router: IRouter = Router();

// Debug endpoint - shows recent codes in database
router.get("/codes/debug/recent", async (_req, res): Promise<void> => {
  try {
    const codes = await db
      .select({
        id: codesTable.id,
        serialNumber: codesTable.serialNumber,
        ssccCode: codesTable.ssccCode,
        rawString: codesTable.rawString,
        level: codesTable.level,
        createdAt: codesTable.createdAt,
      })
      .from(codesTable)
      .orderBy(desc(codesTable.createdAt))
      .limit(10);
    
    res.json({ 
      total_codes_shown: codes.length,
      codes: codes.map(c => ({
        id: c.id,
        level: c.level,
        serialNumber: c.serialNumber || "null",
        ssccCode: c.ssccCode || "null",
        rawString: c.rawString.substring(0, 50) + (c.rawString.length > 50 ? "..." : ""),
        createdAt: c.createdAt,
      }))
    });
  } catch (error: any) {
    console.error("Debug endpoint error:", error);
    res.status(500).json({ error: error.message });
  }
});

const getCityFromZip = (zip: string) => {
  const cleanZip = String(zip || "").toLowerCase().trim();
  
  if (cleanZip.includes("mumbai")) return "Mumbai";
  if (cleanZip.includes("pune")) return "Pune";
  if (cleanZip.includes("delhi") || cleanZip.includes("new delhi")) return "New Delhi";
  if (cleanZip.includes("chennai")) return "Chennai";
  if (cleanZip.includes("hyderabad")) return "Hyderabad";
  if (cleanZip.includes("bangalore") || cleanZip.includes("bengaluru")) return "Bengaluru";
  if (cleanZip.includes("new york") || cleanZip.includes(" ny")) return "New York";
  if (cleanZip.includes("singapore")) return "Singapore";
  if (cleanZip.includes("dubai")) return "Dubai";

  // Fallbacks for zip code prefixes
  if (cleanZip.startsWith("411")) return "Pune";
  if (cleanZip.startsWith("400")) return "Mumbai";
  if (cleanZip.startsWith("110")) return "New Delhi";
  if (cleanZip.startsWith("600")) return "Chennai";
  if (cleanZip.startsWith("500")) return "Hyderabad";
  if (cleanZip.startsWith("560")) return "Bengaluru";
  if (cleanZip.startsWith("100")) return "New York";
  if (cleanZip.length === 6 && !isNaN(Number(cleanZip))) return "Singapore";
  
  // Try to parse from a comma separated address
  const parts = cleanZip.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed && isNaN(Number(trimmed)) && trimmed.length > 2) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
  }

  const defaultCities = ["Mumbai", "Singapore", "Dubai", "New Delhi", "Pune"];
  let hash = 0;
  for (let i = 0; i < cleanZip.length; i++) {
    hash = cleanZip.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % defaultCities.length;
  return defaultCities[idx] || "Mumbai";
};

const logCustomerScan = async (codeId: number, query: any, rawLink?: string) => {
  try {
    const customerName = String(query.customerName || "Anonymous Customer");
    const mobileNumber = String(query.mobileNumber || "N/A");
    const zipCode = String(query.zipCode || "N/A");
    const city = getCityFromZip(zipCode);
    const linkStr = rawLink || String(query.rawLink || query.serial || "");
    
    // Check counter table for prior count of this link/code (keyed by rawLink)
    const existingCounters = linkStr
      ? await db
          .select()
          .from(counterTable)
          .where(eq(counterTable.rawLink, linkStr))
          .limit(1)
      : [];

    let alreadyScanned = false;
    let scanCount = 1;
    let firstScannedAt = new Date().toISOString();

    if (existingCounters.length > 0) {
      const cnt = existingCounters[0];
      alreadyScanned = cnt.scanCount > 0;
      scanCount = cnt.scanCount + 1;
      firstScannedAt = cnt.firstScannedAt;
      
      await db
        .update(counterTable)
        .set({
          scanCount: scanCount,
          lastScannedAt: new Date().toISOString(),
          codeId: codeId || cnt.codeId,
        })
        .where(eq(counterTable.id, cnt.id));
    } else {
      // Check customerScansTable as fallback count
      const previousScans = await db
        .select()
        .from(customerScansTable)
        .where(eq(customerScansTable.codeId, codeId))
        .orderBy(customerScansTable.createdAt);

      if (previousScans.length > 0) {
        alreadyScanned = true;
        scanCount = previousScans.length + 1;
        firstScannedAt = previousScans[0].createdAt;
      }

      await db.insert(counterTable).values({
        codeId,
        rawLink: linkStr,
        scanCount,
        firstScannedAt,
        lastScannedAt: new Date().toISOString(),
      });
    }

    const previousScans = await db
      .select()
      .from(customerScansTable)
      .where(eq(customerScansTable.codeId, codeId))
      .orderBy(customerScansTable.createdAt);

    const previousScan = previousScans.length > 0 ? previousScans[previousScans.length - 1] : null;

    const now = new Date();
    const scanTime = now.toTimeString().split(" ")[0];
    const day = String(now.getDate()).padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear();
    const scanDate = `${day} ${month} ${year}`;
    
    await db.insert(customerScansTable).values({
      codeId,
      customerName,
      mobileNumber,
      zipCode,
      city,
      scanTime,
      scanDate,
    });
    console.log(`[Public Verify] Logged customer scan for code ID ${codeId} (${customerName}, ${city}) - total count #${scanCount}`);

    return {
      alreadyScanned,
      scanCount,
      firstScannedAt,
      previousScan: previousScan ? {
        customerName: previousScan.customerName,
        city: previousScan.city,
        scanDate: previousScan.scanDate,
        scanTime: previousScan.scanTime,
        createdAt: previousScan.createdAt
      } : null
    };
  } catch (err) {
    console.error("Failed to log customer scan:", err);
    return { alreadyScanned: false, scanCount: 1, firstScannedAt: null, previousScan: null };
  }
};

router.get("/codes/check/:serial", async (req, res): Promise<void> => {
  let serial = req.params.serial;
  if (!serial) {
    res.status(400).json({ error: "Serial number is required" });
    return;
  }

  try {
    let searchSerial = serial.trim();
    if (searchSerial.includes("::")) {
      searchSerial = searchSerial.split("::")[1] || searchSerial;
    } else if (searchSerial.includes(":")) {
      const parts = searchSerial.split(":");
      searchSerial = parts[parts.length - 1] || searchSerial;
    }

    if (searchSerial.includes("-")) {
      const parts = searchSerial.split("-");
      if (parts.length >= 4) {
        const potentialSerial = parts[parts.length - 1];
        if (potentialSerial && potentialSerial.length >= 6 && !potentialSerial.includes(" ")) {
          const matches = await db
            .select({ id: codesTable.id })
            .from(codesTable)
            .where(
              or(
                eq(codesTable.serialNumber, potentialSerial),
                eq(codesTable.ssccCode, potentialSerial)
              )
            )
            .limit(1);
          if (matches.length > 0) {
            searchSerial = potentialSerial;
          } else {
            searchSerial = potentialSerial;
          }
        }
      }
    }

    if (searchSerial.includes("-")) {
      const parts = searchSerial.split("-");
      const serialIndex = parts.findIndex(p => p.startsWith("21"));
      if (serialIndex > -1) {
        searchSerial = parts.slice(serialIndex).join("-").substring(2);
      } else {
        const ssccIndex = parts.findIndex(p => p.startsWith("00"));
        if (ssccIndex > -1) {
          searchSerial = parts.slice(ssccIndex).join("-").substring(2);
        }
      }
    } else if (searchSerial.includes("(21)")) {
      const match = searchSerial.match(/\(21\)([^()]+)/);
      if (match && match[1]) {
        searchSerial = match[1];
      }
    } else if (searchSerial.includes("(00)")) {
      const match = searchSerial.match(/\(00\)([^()]+)/);
      if (match && match[1]) {
        searchSerial = match[1];
      }
    }

    const rows = await db
      .select({ id: codesTable.id })
      .from(codesTable)
      .where(
        or(
          eq(codesTable.serialNumber, searchSerial),
          eq(codesTable.ssccCode, searchSerial),
          eq(codesTable.rawString, searchSerial)
        )
      )
      .limit(1);

    if (rows.length === 0) {
      res.json({ alreadyScanned: false, scanCount: 0 });
      return;
    }

    const codeId = rows[0].id;

    // Check counterTable first by rawLink or codeId
    const rawLinkParam = serial.trim();
    const counters = await db
      .select()
      .from(counterTable)
      .where(or(eq(counterTable.rawLink, rawLinkParam), eq(counterTable.codeId, codeId)))
      .limit(1);

    const previousScans = await db
      .select()
      .from(customerScansTable)
      .where(eq(customerScansTable.codeId, codeId))
      .orderBy(customerScansTable.createdAt);

    let scanCount = previousScans.length;
    if (counters.length > 0 && counters[0].scanCount > scanCount) {
      scanCount = counters[0].scanCount;
    }

    const alreadyScanned = scanCount > 0;
    const previousScan = alreadyScanned ? previousScans[previousScans.length - 1] : null;

    res.json({
      alreadyScanned,
      scanCount,
      previousScan: previousScan ? {
        customerName: previousScan.customerName,
        city: previousScan.city,
        scanDate: previousScan.scanDate,
        scanTime: previousScan.scanTime,
        createdAt: previousScan.createdAt
      } : null
    });
  } catch (err) {
    console.error("Check scan error:", err);
    res.json({ alreadyScanned: false, scanCount: 0 });
  }
});

router.get("/codes/public/:serial", async (req, res): Promise<void> => {
  let serial = req.params.serial;
  if (!serial) {
    res.status(400).json({ error: "Serial number is required" });
    return;
  }

  try {
    const aliasUser = usersTable;
    
    // Helper function to build the select query
    const buildQuery = (condition: any) => {
      return db
        .select({
          id: codesTable.id,
          productId: codesTable.productId,
          productName: productsTable.name,
          batchId: codesTable.batchId,
          batchNumber: batchesTable.batchNumber,
          level: codesTable.level,
          rawString: codesTable.rawString,
          serialNumber: codesTable.serialNumber,
          ssccCode: codesTable.ssccCode,
          mapped: codesTable.mapped,
          mappedAt: codesTable.mappedAt,
          mappedByUserId: codesTable.mappedByUserId,
          mappedByUsername: aliasUser.username,
          locationId: codesTable.locationId,
          locationName: locationsTable.locationName,
          createdAt: codesTable.createdAt,
          mfgDate: batchesTable.mfgDate,
          expiryDate: batchesTable.expiryDate,
          marketedBy: productsTable.marketedBy,
          registrationNo: productsTable.registrationNo,
          mrp: productsTable.mrp,
          sapDescription: productsTable.sapDescription,
          companyName: companiesTable.name,
          companyAddress: companiesTable.address,
          companyGstin: companiesTable.gstin,
          companyFssai: companiesTable.fssaiLicenseNo,
          factoryLocationName: locationsTable.locationName,
          factoryAddress: locationsTable.address,
          factoryCity: locationsTable.city,
          factoryState: locationsTable.state,
          // Keep public verification resilient even when optional product
          // branding columns are absent in an older deployed database.
          productLogoUrl: sql<string | null>`null`,
        })
        .from(codesTable)
        .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
        .leftJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
        .leftJoin(aliasUser, eq(codesTable.mappedByUserId, aliasUser.id))
        .leftJoin(locationsTable, eq(codesTable.locationId, locationsTable.id))
        .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
        .where(condition)
        .limit(1);
    };
    
    // Normalize serial: remove common scanner prefixes and trim whitespace
    let searchSerial = serial.trim();
    if (searchSerial.includes("::")) {
      searchSerial = searchSerial.split("::")[1] || searchSerial;
    } else if (searchSerial.includes(":")) {
      const parts = searchSerial.split(":");
      searchSerial = parts[parts.length - 1] || searchSerial;
    }

    // Extract actual serial/SSCC from new format: <gst/gtin>-<batch>-<mfg>-<expiry>-<serial>
    if (searchSerial.includes("-")) {
      const parts = searchSerial.split("-");
      if (parts.length >= 4) {
        const potentialSerial = parts[parts.length - 1];
        if (potentialSerial && potentialSerial.length >= 6 && !potentialSerial.includes(" ")) {
          const matches = await db
            .select({ id: codesTable.id })
            .from(codesTable)
            .where(
              or(
                eq(codesTable.serialNumber, potentialSerial),
                eq(codesTable.ssccCode, potentialSerial)
              )
            )
            .limit(1);
          if (matches.length > 0) {
            searchSerial = potentialSerial;
            console.log(`[Public Verify] Normalized dash-separated URL to serial: "${searchSerial}"`);
          } else {
            searchSerial = potentialSerial;
          }
        }
      }
    }

    // Extract actual serial/SSCC from concatenated product string if formatted with (21) or (00)
    if (searchSerial.includes("-")) {
      const parts = searchSerial.split("-");
      const serialIndex = parts.findIndex(p => p.startsWith("21"));
      if (serialIndex > -1) {
        searchSerial = parts.slice(serialIndex).join("-").substring(2);
      } else {
        const ssccIndex = parts.findIndex(p => p.startsWith("00"));
        if (ssccIndex > -1) {
          searchSerial = parts.slice(ssccIndex).join("-").substring(2);
        }
      }
    } else if (searchSerial.includes("(21)")) {
      const match = searchSerial.match(/\(21\)([^()]+)/);
      if (match && match[1]) {
        searchSerial = match[1];
      }
    } else if (searchSerial.includes("(00)")) {
      const match = searchSerial.match(/\(00\)([^()]+)/);
      if (match && match[1]) {
        searchSerial = match[1];
      }
    } else if (searchSerial.startsWith("01") && searchSerial.length >= 18) {
      searchSerial = searchSerial.substring(18);
    } else if (searchSerial.startsWith("00") && searchSerial.length >= 20) {
      searchSerial = searchSerial.substring(2);
    }
    
    console.log(`[Public Verify] Searching for: "${serial}" (normalized: "${searchSerial}")`);
    
    // Try direct lookup (serialNumber or ssccCode) FIRST - most common for QR codes
    let rows = await buildQuery(
      or(
        eq(codesTable.serialNumber, searchSerial),
        eq(codesTable.ssccCode, searchSerial)
      )
    );
    
    // Helper function to resolve row with fallback location data
    const formatProductRow = async (row: any) => {
      if (!row) return null;
      let factoryLoc = row.factoryLocationName;
      let factoryAddr = row.factoryAddress;
      let factoryCty = row.factoryCity;
      let factorySt = row.factoryState;

      // If locationId on code was null, attempt to join company's first registered location
      if (!factoryLoc && row.productId) {
        const product = await db
          .select({ companyId: productsTable.companyId })
          .from(productsTable)
          .where(eq(productsTable.id, row.productId))
          .limit(1);

        if (product.length > 0 && product[0].companyId) {
          const locs = await db
            .select()
            .from(locationsTable)
            .where(eq(locationsTable.companyId, product[0].companyId))
            .limit(1);
          if (locs.length > 0) {
            factoryLoc = locs[0].locationName;
            factoryAddr = locs[0].address;
            factoryCty = locs[0].city;
            factorySt = locs[0].state;
          }
        }
      }

      return {
        ...row,
        sapDescription: row.sapDescription || `${row.productName.toUpperCase()} Industrial Pack`,
        mrp: row.mrp != null && !isNaN(row.mrp) ? Number(row.mrp) : 499.00,
        factoryLocationName: factoryLoc || row.companyName || "Primary Manufacturing Unit",
        factoryAddress: factoryAddr || row.companyAddress || "Industrial Zone",
        factoryCity: factoryCty || "Mumbai",
        factoryState: factorySt || "Maharashtra",
      };
    };

    if (rows.length > 0) {
      console.log(`[Public Verify] Found by serialNumber/ssccCode`);
      const scanInfo = await logCustomerScan(rows[0].id, req.query, serial);
      const formatted = await formatProductRow(rows[0]);
      res.json({ ...formatted, ...scanInfo });
      return;
    }

    // Try rawString match SECOND (barcode label scans)
    rows = await buildQuery(eq(codesTable.rawString, searchSerial));
    if (rows.length > 0) {
      console.log(`[Public Verify] Found by rawString (barcode match)`);
      const scanInfo = await logCustomerScan(rows[0].id, req.query, serial);
      const formatted = await formatProductRow(rows[0]);
      res.json({ ...formatted, ...scanInfo });
      return;
    }

    // Try parsing as GS1 code and extract serial/SSCC
    const parsed = parseGs1Code(searchSerial);
    if (parsed.serialNumber || parsed.ssccCode) {
      const searchConditions = [];
      if (parsed.serialNumber) {
        searchConditions.push(eq(codesTable.serialNumber, parsed.serialNumber));
        console.log(`[Public Verify] Parsed GS1 serialNumber: "${parsed.serialNumber}"`);
      }
      if (parsed.ssccCode) {
        searchConditions.push(eq(codesTable.ssccCode, parsed.ssccCode));
        console.log(`[Public Verify] Parsed GS1 ssccCode: "${parsed.ssccCode}"`);
      }
      
      if (searchConditions.length > 0) {
        rows = await buildQuery(or(...searchConditions));
        if (rows.length > 0) {
          console.log(`[Public Verify] Found by GS1 parsing`);
          const scanInfo = await logCustomerScan(rows[0].id, req.query, serial);
          const formatted = await formatProductRow(rows[0]);
          res.json({ ...formatted, ...scanInfo });
          return;
        }
      }
    }

    // If not found in database, insert a placeholder code record dynamically and log the scan details
    console.log(`[Public Verify] NOT FOUND. Creating placeholder code to log scan details.`);
    try {
      const isSscc = searchSerial.length === 18 && /^\d+$/.test(searchSerial);
      const [fallbackProduct] = await db.select({ id: productsTable.id }).from(productsTable).limit(1);
      const fallbackProductId = fallbackProduct ? fallbackProduct.id : 1;
      
      const inserted = await db.insert(codesTable).values({
        productId: fallbackProductId,
        level: isSscc ? "shipper" : "unit",
        rawString: `INVALID_${searchSerial}_${Date.now()}`,
        serialNumber: isSscc ? null : searchSerial,
        ssccCode: isSscc ? searchSerial : null,
        mapped: false,
      }).returning();
      
      if (inserted && inserted[0]) {
        await logCustomerScan(inserted[0].id, req.query, serial);
      }
    } catch (dbErr) {
      console.error("Failed to insert placeholder code for failed scan logging:", dbErr);
    }

    res.status(404).json({ 
      error: "Product serial verification code not found or invalid",
      searched: searchSerial,
      hint: "Code does not exist in database. Please verify the code was generated and saved."
    });
  } catch (error: any) {
    console.error("Error fetching public code details:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

const aliasUser = usersTable;

async function fetchEnrichedCodes(ids: number[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: codesTable.id,
      productId: codesTable.productId,
      productName: productsTable.name,
      batchId: codesTable.batchId,
      batchNumber: batchesTable.batchNumber,
      level: codesTable.level,
      rawString: codesTable.rawString,
      serialNumber: codesTable.serialNumber,
      ssccCode: codesTable.ssccCode,
      mapped: codesTable.mapped,
      mappedAt: codesTable.mappedAt,
      mappedByUserId: codesTable.mappedByUserId,
      mappedByUsername: aliasUser.username,
      locationId: codesTable.locationId,
      locationName: locationsTable.locationName,
      createdAt: codesTable.createdAt,
      mfgDate: batchesTable.mfgDate,
      expiryDate: batchesTable.expiryDate,
      marketedBy: productsTable.marketedBy,
      registrationNo: productsTable.registrationNo,
      companyName: companiesTable.name,
      companyAddress: companiesTable.address,
      companyGstin: companiesTable.gstin,
    })
    .from(codesTable)
    .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
    .leftJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
    .leftJoin(aliasUser, eq(codesTable.mappedByUserId, aliasUser.id))
    .leftJoin(locationsTable, eq(codesTable.locationId, locationsTable.id))
    .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
    .where(
      ids.length === 1
        ? eq(codesTable.id, ids[0]!)
        : inArray(codesTable.id, ids),
    )
    .orderBy(desc(codesTable.createdAt));
  return rows;
}

const requireGenerateOrMapCodes = (req: any, res: any, next: any) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.user.role === "master" || req.user.role === "super_master") {
    next();
    return;
  }
  const modules = (req.user.enabledModules || "").split(",");
  if (!modules.includes("generate_codes") && !modules.includes("mapping_code")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};

router.get("/codes", requireAuth, requireGenerateOrMapCodes, async (req, res): Promise<void> => {
  const level = typeof req.query.level === "string" ? req.query.level : null;
  const batchId =
    typeof req.query.batchId === "string"
      ? parseInt(req.query.batchId, 10)
      : null;
  const productId =
    typeof req.query.productId === "string"
      ? parseInt(req.query.productId, 10)
      : null;
  const createdAt =
    typeof req.query.createdAt === "string" ? req.query.createdAt : null;
  const limit =
    typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 5000;

  const conds = [];
  if (level) conds.push(eq(codesTable.level, level));
  if (batchId && !Number.isNaN(batchId))
    conds.push(eq(codesTable.batchId, batchId));
  if (productId && !Number.isNaN(productId))
    conds.push(eq(codesTable.productId, productId));
  if (createdAt)
    conds.push(eq(codesTable.createdAt, createdAt));
  if (req.user!.role !== "master" && req.user!.role !== "super_master") {
    if (!req.user!.companyId) {
      res.json([]);
      return;
    }
    conds.push(eq(productsTable.companyId, req.user!.companyId));
  }
  const where =
    conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);

  const rows = await db
    .select({
      id: codesTable.id,
      productId: codesTable.productId,
      productName: productsTable.name,
      batchId: codesTable.batchId,
      batchNumber: batchesTable.batchNumber,
      level: codesTable.level,
      rawString: codesTable.rawString,
      serialNumber: codesTable.serialNumber,
      ssccCode: codesTable.ssccCode,
      mapped: codesTable.mapped,
      mappedAt: codesTable.mappedAt,
      mappedByUserId: codesTable.mappedByUserId,
      mappedByUsername: aliasUser.username,
      locationId: codesTable.locationId,
      locationName: locationsTable.locationName,
      createdAt: codesTable.createdAt,
      mfgDate: batchesTable.mfgDate,
      expiryDate: batchesTable.expiryDate,
      gtin: productsTable.gtin,
      marketedBy: productsTable.marketedBy,
      registrationNo: productsTable.registrationNo,
      companyName: companiesTable.name,
      companyAddress: companiesTable.address,
      companyGstin: companiesTable.gstin,
      companyUrl: companiesTable.companyUrl,
    })
    .from(codesTable)
    .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
    .leftJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
    .leftJoin(aliasUser, eq(codesTable.mappedByUserId, aliasUser.id))
    .leftJoin(locationsTable, eq(codesTable.locationId, locationsTable.id))
    .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
    .where(where)
    .orderBy(desc(codesTable.createdAt))
    .limit(Math.min(Math.max(limit, 1), 5000));

  res.json(rows);
});

router.post("/codes", requireAuth, requireModule("generate_codes"), async (req, res): Promise<void> => {
  const parsed = GenerateCodesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [batch] = await db
    .select({
      id: batchesTable.id,
      productId: batchesTable.productId,
      batchNumber: batchesTable.batchNumber,
      batchExpiryDate: batchesTable.expiryDate,
      batchMfgDate: batchesTable.mfgDate,
      productExpiryDate: productsTable.expiryDate,
      gtin: productsTable.gtin,
      isGs1Compliant: productsTable.isGs1Compliant,
      companyId: productsTable.companyId,
      companyGstin: companiesTable.gstin,
      companyPrefix: companiesTable.companyPrefix,
    })
    .from(batchesTable)
    .innerJoin(productsTable, eq(batchesTable.productId, productsTable.id))
    .leftJoin(companiesTable, eq(productsTable.companyId, companiesTable.id))
    .where(eq(batchesTable.id, parsed.data.batchId));

  if (!batch) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  if (
    req.user!.role !== "master" &&
    req.user!.role !== "super_master" &&
    batch.companyId !== req.user!.companyId
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const isUnitLevel = ["unit", "l1", "l2"].includes(parsed.data.level);
  const generationTime = new Date().toISOString();

  const inserts = [];
  const hasValidGtin = Boolean(batch.gtin && isValidGtin(batch.gtin));
  const expiryValue = batch.batchExpiryDate || batch.productExpiryDate || "";
  const mfgValue = batch.batchMfgDate || "";

  for (let i = 0; i < parsed.data.quantity; i++) {
    if (isUnitLevel) {
      // If product is GS1 compliant or has batch/dates, generate GS1 standard code
      // Path 1 (Valid GTIN): AI(01) GTIN + AI(21) Serial + AI(10) Batch + AI(11) Mfg + AI(17) Exp
      // Path 2 (Without GTIN): AI(10) Batch + AI(11) Mfg + AI(17) Exp + AI(21) Serial (No AI 01, GSTIN in separate field)
      const { raw, serial } = generateUnitCode({
        gtin: hasValidGtin ? batch.gtin! : null,
        expiry: expiryValue,
        mfgDate: mfgValue,
        batch: batch.batchNumber,
      });

      inserts.push({
        productId: batch.productId,
        batchId: batch.id,
        level: parsed.data.level,
        rawString: raw,
        serialNumber: serial,
        ssccCode: null,
        createdAt: generationTime,
      });
    } else {
      // Outer packaging (shipper / pallet)
      const prefixToUse = batch.companyPrefix || (hasValidGtin && batch.gtin!.length >= 8 ? batch.gtin!.slice(1, 8) : "8901234");
      const { raw, sscc } = generateSsccCode(prefixToUse, i);
      inserts.push({
        productId: batch.productId,
        batchId: batch.id,
        level: parsed.data.level,
        rawString: raw,
        serialNumber: null,
        ssccCode: sscc,
        createdAt: generationTime,
      });
    }
  }

  const inserted = await db.insert(codesTable).values(inserts).returning();
  const ids = inserted.map((r) => r.id);
  const rows = await fetchEnrichedCodes(ids);
  res.status(201).json({ generated: inserted.length, codes: rows });
});

router.post("/codes/:id/map", requireAuth, requireModule("mapping_code"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = MapCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db
    .update(codesTable)
    .set({
      mapped: true,
      mappedAt: new Date().toISOString(),
      mappedByUserId: req.user!.id,
      locationId: parsed.data.locationId,
    })
    .where(eq(codesTable.id, id));

  const [row] = await fetchEnrichedCodes([id]);
  if (!row) {
    res.status(404).json({ error: "Code not found" });
    return;
  }
  res.json(row);
});

router.get("/codes/scans", requireAuth, requireModule("customer_scan"), async (req, res): Promise<void> => {
  try {
    const scans = await db
      .select({
        id: customerScansTable.id,
        codeId: customerScansTable.codeId,
        customerName: customerScansTable.customerName,
        mobileNumber: customerScansTable.mobileNumber,
        zipCode: customerScansTable.zipCode,
        city: customerScansTable.city,
        scanTime: customerScansTable.scanTime,
        scanDate: customerScansTable.scanDate,
        createdAt: customerScansTable.createdAt,
        qr: codesTable.serialNumber,
        sscc: codesTable.ssccCode,
        level: codesTable.level,
        productName: productsTable.name,
        batchNumber: batchesTable.batchNumber,
        batchCreatedAt: batchesTable.createdAt,
      })
      .from(customerScansTable)
      .innerJoin(codesTable, eq(customerScansTable.codeId, codesTable.id))
      .innerJoin(productsTable, eq(codesTable.productId, productsTable.id))
      .leftJoin(batchesTable, eq(codesTable.batchId, batchesTable.id))
      .where(
        (req.user!.role === "master" || req.user!.role === "super_master")
          ? undefined
          : req.user!.companyId
            ? eq(productsTable.companyId, req.user!.companyId)
            : eq(productsTable.companyId, -1)
      )
      .orderBy(desc(customerScansTable.id));

    // Group scans by codeId to get counts and the latest scan
    const groupedMap = new Map<number, any>();
    
    for (const scan of scans) {
      if (!groupedMap.has(scan.codeId)) {
        groupedMap.set(scan.codeId, {
          product: scan.productName,
          batch: scan.batchNumber || "N/A",
          batchDate: scan.batchCreatedAt ? new Date(scan.batchCreatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "N/A",
          qr: scan.qr ? `...${scan.qr.slice(-6)}` : (scan.sscc ? `...${scan.sscc.slice(-6)}` : "N/A"),
          customer: scan.customerName,
          city: scan.city,
          mobile: scan.mobileNumber,
          scanTime: scan.scanTime,
          scanDate: scan.scanDate,
          count: 0,
          type: "normal",
          codeId: scan.codeId,
          level: scan.level,
          events: []
        });
      }
      
      const entry = groupedMap.get(scan.codeId);
      entry.count += 1;
      
      entry.events.push({
        customer: scan.customerName,
        city: scan.city,
        mobile: scan.mobileNumber,
        time: scan.scanTime,
        date: scan.scanDate,
        id: scan.id
      });
    }

    // Query counter table to get total counts per codeId (summing across distinct rawLink counter entries)
    const counterRows = await db.select().from(counterTable);
    const counterMap = new Map<number, number>();
    for (const c of counterRows) {
      const current = counterMap.get(c.codeId) || 0;
      counterMap.set(c.codeId, current + c.scanCount);
    }

    const result = Array.from(groupedMap.values()).map(entry => {
      // Use counterTable aggregate count if available and higher
      if (counterMap.has(entry.codeId)) {
        entry.count = Math.max(entry.count, counterMap.get(entry.codeId)!);
      }
      if (entry.count > 5) {
        entry.type = "anomaly";
      } else if (entry.count > 1) {
        entry.type = "error";
      } else {
        entry.type = "normal";
      }
      return entry;
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching scans:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

export default router;

