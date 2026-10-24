import { randomBytes } from "crypto";

export const FNC1 = "<GS>";

function checkDigit(digits: string): number {
  let sum = 0;
  const reversed = digits.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    const d = parseInt(reversed[i]!, 10);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(gtin: string): boolean {
  if (!/^\d{13,14}$/.test(gtin)) return false;
  const padded = gtin.length === 13 ? "0" + gtin : gtin;
  const body = padded.slice(0, 13);
  const cd = parseInt(padded.slice(13), 10);
  return checkDigit(body) === cd;
}

function pad(value: number | string, len: number): string {
  return String(value).padStart(len, "0");
}

export function toYYMMDD(d: Date | string | null | undefined): string {
  if (!d) return "";
  if (typeof d === "string") {
    const s = d.trim();
    if (/^\d{6}$/.test(s)) return s;
    const m1 = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
    if (m1) {
      const dd = m1[1]!.padStart(2, "0");
      const months: Record<string, string> = {
        jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
        jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
      };
      const mm = months[m1[2]!.toLowerCase()] || "01";
      const yy = m1[3]!.slice(-2);
      return `${yy}${mm}${dd}`;
    }
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const yy = isoMatch[1]!.slice(-2);
      const mm = isoMatch[2]!;
      const dd = isoMatch[3]!;
      return `${yy}${mm}${dd}`;
    }
  }
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    if (date && !isNaN(date.getTime())) {
      const yy = String(date.getUTCFullYear() % 100).padStart(2, "0");
      const mm = pad(date.getUTCMonth() + 1, 2);
      const dd = pad(date.getUTCDate(), 2);
      return `${yy}${mm}${dd}`;
    }
  } catch {}
  return "";
}

function formatExpiry(d: Date | string | null | undefined): string {
  return toYYMMDD(d);
}

function makeSerial(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let serial = "";
  for (let i = 0; i < 9; i++) {
    const r = randomBytes(1)[0]! % chars.length;
    serial += chars[r];
  }
  return serial;
}

function makeRandomDigits(count: number): string {
  let out = "";
  while (out.length < count) {
    const buf = randomBytes(count);
    for (let i = 0; i < buf.length && out.length < count; i++) {
      const v = buf[i]!;
      if (v < 250) out += (v % 10).toString();
    }
  }
  return out;
}

export interface UnitCodeInput {
  gtin?: string | null;
  expiry?: Date | string | null;
  mfgDate?: Date | string | null;
  batch: string;
}

export function generateUnitCode(input: UnitCodeInput): {
  raw: string;
  serial: string;
} {
  const serial = makeSerial();
  const expiry = input.expiry ? toYYMMDD(input.expiry) : "";
  const mfg = input.mfgDate ? toYYMMDD(input.mfgDate) : "";

  // Path 1: With Valid GTIN
  if (input.gtin && isValidGtin(input.gtin)) {
    const padded = input.gtin.length === 13 ? "0" + input.gtin : input.gtin;
    let raw = `01${padded}21${serial}${FNC1}10${input.batch}`;
    if (mfg) raw += `${FNC1}11${mfg}`;
    if (expiry) raw += `${FNC1}17${expiry}`;
    return { raw, serial };
  }

  // Path 2: Without GTIN (Fix as per TracelyTag QR Architecture):
  // (01) is omitted because GSTIN is not a GTIN.
  // Encodes (10) Batch, (11) Mfg Date, (17) Expiry Date, (21) Serial Number.
  let raw = `10${input.batch}${FNC1}`;
  if (mfg) raw += `11${mfg}${FNC1}`;
  if (expiry) raw += `17${expiry}${FNC1}`;
  raw += `21${serial}`;
  return { raw, serial };
}

// SSCC = AI(00) + 1 extension digit + 7 digit company prefix + 9 digit serial reference + check digit
export function generateSsccCode(companyPrefix: string, _seq: number): {
  raw: string;
  sscc: string;
} {
  const ext = "1";
  const prefix = companyPrefix.padStart(7, "0").slice(0, 7);
  const serialRef = makeRandomDigits(9);
  const body = ext + prefix + serialRef;
  const cd = checkDigit(body);
  const sscc = body + cd.toString();
  const raw = `00${sscc}`;
  return { raw, sscc };
}

/* Parse GS1 codes to extract serial number, SSCC, GTIN, batch, expiry, mfg */
export function parseGs1Code(rawCode: string): {
  serialNumber?: string;
  ssccCode?: string;
  gtin?: string;
  batch?: string;
  expiry?: string;
  mfgDate?: string;
} {
  const result: Record<string, string | undefined> = {};
  if (!rawCode) return result;

  // Handle human-readable parentheses format: (01)...(10)...(11)...(17)...(21)...
  if (rawCode.includes("(") && rawCode.includes(")")) {
    const m00 = rawCode.match(/\(00\)([^()]+)/);
    if (m00) result.ssccCode = m00[1];

    const m01 = rawCode.match(/\(01\)([^()]+)/);
    if (m01 && /^\d{8,14}$/.test(m01[1]!)) {
      result.gtin = m01[1];
    }

    const m10 = rawCode.match(/\(10\)([^()]+)/);
    if (m10) result.batch = m10[1];

    const m11 = rawCode.match(/\(11\)([^()]+)/);
    if (m11) result.mfgDate = m11[1];

    const m17 = rawCode.match(/\(17\)([^()]+)/);
    if (m17) result.expiry = m17[1];

    const m21 = rawCode.match(/\(21\)([^()]+)/);
    if (m21) result.serialNumber = m21[1];

    if (result.gtin || result.batch || result.serialNumber || result.ssccCode) {
      return result;
    }
  }
  
  // Replace FNC1 variants with a separator for easier parsing
  const normalized = rawCode
    .replace(/<GS>/g, '|')
    .replace(/\u001d/g, '|')
    .replace(/\u00e8/g, '|');
  let pos = 0;

  while (pos < normalized.length) {
    const ai = normalized.substring(pos, pos + 2);
    pos += 2;

    // Fixed-length AIs
    if (ai === '00') {
      // SSCC - 18 digits
      result.ssccCode = normalized.substring(pos, pos + 18);
      pos += 18;
    } else if (ai === '01') {
      // GTIN - 14 digits
      const gtinVal = normalized.substring(pos, pos + 14);
      if (/^\d{8,14}$/.test(gtinVal)) {
        result.gtin = gtinVal;
      }
      pos += 14;
    } else if (ai === '17') {
      // Expiry date - 6 digits (YYMMDD)
      const yymmdd = normalized.substring(pos, pos + 6);
      pos += 6;
      result.expiry = yymmdd;
    } else if (ai === '11') {
      // Mfg date - 6 digits (YYMMDD)
      const yymmdd = normalized.substring(pos, pos + 6);
      pos += 6;
      result.mfgDate = yymmdd;
    } else if (ai === '10') {
      // Batch/Lot - variable, ends with FNC1 (|) or next AI
      let batchEnd = normalized.length;
      for (let j = pos; j < normalized.length; j++) {
        if (normalized.substring(j, j + 1) === '|') {
          batchEnd = j;
          break;
        }
      }
      result.batch = normalized.substring(pos, batchEnd).replace(/\|/g, '');
      pos = batchEnd + 1;
    } else if (ai === '21') {
      // Serial number - variable, ends with FNC1 (|) or next AI
      let serialEnd = normalized.length;
      for (let j = pos; j < normalized.length; j++) {
        if (normalized.substring(j, j + 1) === '|') {
          serialEnd = j;
          break;
        }
      }
      result.serialNumber = normalized.substring(pos, serialEnd).replace(/\|/g, '');
      pos = serialEnd + 1;
    } else {
      // Unknown AI, skip to next separator or end
      const nextSep = normalized.indexOf('|', pos);
      pos = nextSep > 0 ? nextSep + 1 : normalized.length;
    }
  }

  return result;
}

