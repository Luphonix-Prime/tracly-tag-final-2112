import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth, requireRole } from '../lib/session.js';
import { resetAndSeedDatabase } from '../lib/db-reset.js';
import { systemConfigsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// Helper to read config from database
const readConfig = async () => {
  let hideMappingCode = true;
  let datamatrixUrlMode = false;
  let hidePackagingHierarchy = true;
  let hidePackagingLevel = true;
  let enableOtpSystem = true;
  let enableCustomerScanOtp = true;
  try {
    const rows = await db
      .select()
      .from(systemConfigsTable);

    const mapCodeRow = rows.find(r => r.key === "hideMappingCode");
    if (mapCodeRow) {
      hideMappingCode = mapCodeRow.value === "true";
    }
    const dmRow = rows.find(r => r.key === "datamatrixUrlMode");
    if (dmRow) {
      datamatrixUrlMode = dmRow.value === "true";
    }
    const phRow = rows.find(r => r.key === "hidePackagingHierarchy");
    if (phRow) {
      hidePackagingHierarchy = phRow.value === "true";
    }
    const plRow = rows.find(r => r.key === "hidePackagingLevel");
    if (plRow) {
      hidePackagingLevel = plRow.value === "true";
    }
    const otpRow = rows.find(r => r.key === "enableOtpSystem");
    if (otpRow) {
      enableOtpSystem = otpRow.value !== "false";
    }
    const cOtpRow = rows.find(r => r.key === "enableCustomerScanOtp");
    if (cOtpRow) {
      enableCustomerScanOtp = cOtpRow.value !== "false";
    }
  } catch (err) {
    // ignore
  }
  return { hideMappingCode, datamatrixUrlMode, hidePackagingHierarchy, hidePackagingLevel, enableOtpSystem, enableCustomerScanOtp };
};

// Helper to write config to database
const writeConfig = async (config: { hideMappingCode?: boolean; datamatrixUrlMode?: boolean; hidePackagingHierarchy?: boolean; hidePackagingLevel?: boolean; enableOtpSystem?: boolean; enableCustomerScanOtp?: boolean }) => {
  try {
    if (config.hideMappingCode !== undefined) {
      await db
        .insert(systemConfigsTable)
        .values({
          key: "hideMappingCode",
          value: String(config.hideMappingCode),
        })
        .onConflictDoUpdate({
          target: systemConfigsTable.key,
          set: { value: String(config.hideMappingCode) },
        });
    }
    if (config.datamatrixUrlMode !== undefined) {
      await db
        .insert(systemConfigsTable)
        .values({
          key: "datamatrixUrlMode",
          value: String(config.datamatrixUrlMode),
        })
        .onConflictDoUpdate({
          target: systemConfigsTable.key,
          set: { value: String(config.datamatrixUrlMode) },
        });
    }
    if (config.hidePackagingHierarchy !== undefined) {
      await db
        .insert(systemConfigsTable)
        .values({
          key: "hidePackagingHierarchy",
          value: String(config.hidePackagingHierarchy),
        })
        .onConflictDoUpdate({
          target: systemConfigsTable.key,
          set: { value: String(config.hidePackagingHierarchy) },
        });
    }
    if (config.hidePackagingLevel !== undefined) {
      await db
        .insert(systemConfigsTable)
        .values({
          key: "hidePackagingLevel",
          value: String(config.hidePackagingLevel),
        })
        .onConflictDoUpdate({
          target: systemConfigsTable.key,
          set: { value: String(config.hidePackagingLevel) },
        });
    }
    if (config.enableOtpSystem !== undefined) {
      await db
        .insert(systemConfigsTable)
        .values({
          key: "enableOtpSystem",
          value: String(config.enableOtpSystem),
        })
        .onConflictDoUpdate({
          target: systemConfigsTable.key,
          set: { value: String(config.enableOtpSystem) },
        });
    }
    if (config.enableCustomerScanOtp !== undefined) {
      await db
        .insert(systemConfigsTable)
        .values({
          key: "enableCustomerScanOtp",
          value: String(config.enableCustomerScanOtp),
        })
        .onConflictDoUpdate({
          target: systemConfigsTable.key,
          set: { value: String(config.enableCustomerScanOtp) },
        });
    }
  } catch (err) {
    // ignore
  }
};

// Public/standard auth config getter (public so public-verify scan page can check settings without login)
router.get("/system-config", async (req, res) => {
  const config = await readConfig();
  res.json(config);
});

// Super master config setter
router.post("/system-config", requireAuth, requireRole("super_master"), async (req, res) => {
  const { hideMappingCode, datamatrixUrlMode, hidePackagingHierarchy, hidePackagingLevel, enableOtpSystem, enableCustomerScanOtp } = req.body;
  const updates: { hideMappingCode?: boolean; datamatrixUrlMode?: boolean; hidePackagingHierarchy?: boolean; hidePackagingLevel?: boolean; enableOtpSystem?: boolean; enableCustomerScanOtp?: boolean } = {};
  
  if (hideMappingCode !== undefined) {
    if (typeof hideMappingCode !== "boolean") {
      res.status(400).json({ error: "Invalid value for hideMappingCode" });
      return;
    }
    updates.hideMappingCode = hideMappingCode;
  }
  
  if (datamatrixUrlMode !== undefined) {
    if (typeof datamatrixUrlMode !== "boolean") {
      res.status(400).json({ error: "Invalid value for datamatrixUrlMode" });
      return;
    }
    updates.datamatrixUrlMode = datamatrixUrlMode;
  }

  if (hidePackagingHierarchy !== undefined) {
    if (typeof hidePackagingHierarchy !== "boolean") {
      res.status(400).json({ error: "Invalid value for hidePackagingHierarchy" });
      return;
    }
    updates.hidePackagingHierarchy = hidePackagingHierarchy;
  }

  if (hidePackagingLevel !== undefined) {
    if (typeof hidePackagingLevel !== "boolean") {
      res.status(400).json({ error: "Invalid value for hidePackagingLevel" });
      return;
    }
    updates.hidePackagingLevel = hidePackagingLevel;
  }

  if (enableOtpSystem !== undefined) {
    if (typeof enableOtpSystem !== "boolean") {
      res.status(400).json({ error: "Invalid value for enableOtpSystem" });
      return;
    }
    updates.enableOtpSystem = enableOtpSystem;
  }

  if (enableCustomerScanOtp !== undefined) {
    if (typeof enableCustomerScanOtp !== "boolean") {
      res.status(400).json({ error: "Invalid value for enableCustomerScanOtp" });
      return;
    }
    updates.enableCustomerScanOtp = enableCustomerScanOtp;
  }
  
  await writeConfig(updates);
  const config = await readConfig();
  res.json({ success: true, config });
});

// Apply auth and role protection to all routes under /system
router.use("/system", requireAuth, requireRole("super_master"));

router.post("/system/reset-database", async (req, res): Promise<void> => {
  try {
    const { seedData } = req.body;
    req.log.info("Supermaster database reset requested...");
    await resetAndSeedDatabase(db, seedData);
    req.log.info("Database reset completed successfully");
    res.json({ success: true, message: "Database reset and seeded successfully." });
  } catch (err: any) {
    req.log.error({ err }, "Database reset failed");
    res.status(500).json({ error: err.message || "Failed to reset database" });
  }
});

router.post("/system/reset-id-sequence", async (req, res): Promise<void> => {
  try {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
          EXECUTE 'ALTER SEQUENCE ' || quote_ident(r.sequence_name) || ' RESTART WITH 1';
        END LOOP;
      END $$;
    `);
    res.json({ success: true, message: "ID autoincrement sequence reset to start from 1 for all tables." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reset ID sequences" });
  }
});

router.get("/system/info", async (req, res): Promise<void> => {
  try {
    res.json({
      env: process.env,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cwd: process.cwd(),
    });
  } catch (err: any) {
    req.log.error({ err }, "Failed to fetch system info");
    res.status(500).json({ error: err.message || "Failed to fetch system info" });
  }
});

router.get("/system/smtp-status", async (req, res): Promise<void> => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    res.json({
      configured: false,
      status: "unconfigured",
      host,
      port,
      user: user || null,
      message: "SMTP user/password missing in environment variables",
    });
    return;
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 5000,
    });

    await transporter.verify();
    res.json({
      configured: true,
      status: "connected",
      host,
      port,
      user,
      message: "SMTP server connection verified successfully",
    });
  } catch (err: any) {
    res.json({
      configured: true,
      status: "error",
      host,
      port,
      user,
      message: err.message || "SMTP connection verification failed",
    });
  }
});

export default router;
