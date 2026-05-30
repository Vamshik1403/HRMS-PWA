import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { mapEsslVerifyModeToAuthType } from "@/lib/esslVerifyMode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OK = () => new NextResponse("OK", { status: 200 });

/** Nest API – processes essl_raw_attlog → process_att_logs for dashboard */
function backendProcessUrl() {
  const base =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://127.0.0.1:8000";
  const normalized = base.replace(/\/$/, "");
  return `${normalized}/process-essl-raw?limit=100`;
}

async function triggerEsslProcessing() {
  try {
    await fetch(backendProcessUrl(), { method: "GET", cache: "no-store" });
  } catch (err) {
    console.error("ESSL process trigger failed:", err);
  }
}

const VALID_SN = /^[A-Za-z0-9]+$/;
const SUSPICIOUS = ["DROP", "DELETE", "INSERT", "UPDATE", "--", ";"];

async function handleRequest(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const sn =
      url.searchParams.get("SN") ||
      url.searchParams.get("sn") ||
      url.searchParams.get("serial");

    const table = url.searchParams.get("table");
    const tableNorm = table?.toUpperCase() ?? "";
    const body = await req.text();

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // No SN → ignore
    if (!sn) return OK();

    // SN format validation
    if (!VALID_SN.test(sn)) return OK();

    // 1. Check if device exists in Devices table
    const device = await pool.query(
      `SELECT "deviceSN" FROM "Devices" WHERE "deviceSN" = $1`,
      [sn]
    );

    // Determine log_type based on device existence
    const logType = (device.rowCount ?? 0) > 0 ? "verified" : "unverified";

    // 2. Payload validation
    if (body.length > 10000) return OK();
    if (body.length < 5) return OK();
    if (tableNorm !== "ATTLOG") return OK();

    // 3. Reject suspicious payloads
    const upper = body.toUpperCase();
    if (SUSPICIOUS.some((p) => upper.includes(p))) return OK();

    // 4. Determine validity for soft-flag
    const isValid = /\d/.test(body);

    // 5. Extract user_id, punchTime, and auth_type from raw_body
    let userId = null;
    let punchTime = null;
    let authType = null;
    
    if (body.trim()) {
      const parts = body.trim().split(/\s+/);
      // ESSL ATTLOG format: [user_id, date, time, verify_mode, work_code]
      if (parts.length >= 3) {
        // Extract user_id (first value)
        if (/^\d+$/.test(parts[0])) {
          userId = parts[0];
        }
        // Extract and combine date and time (second and third values)
        if (parts[1] && parts[2]) {
          punchTime = `${parts[1]} ${parts[2]}`;
        }
        // Extract verify mode (5th value, index 4) and map to auth_type
        // ESSL format: user_id date time status verify_mode ...
        // parts[3] = status (in/out), parts[4] = verify_mode (auth type)
        if (parts[4] !== undefined) {
          authType = mapEsslVerifyModeToAuthType(parts[4]);
        }
      }
    }

    // 6. Store ALL logs in essl_raw_attlog with log_type, user_id, punchTime, and auth_type
    try {      await pool.query(
        `INSERT INTO essl_raw_attlog
         (device_sn, request_path, query_params, raw_body, ip_address, is_valid, log_type, user_id, punch_time, auth_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [sn, url.pathname, url.searchParams.toString(), body, ip, isValid, logType, userId, punchTime, authType]
      );

      console.log("✅ INSERT SUCCESS - log_type:", logType, "user_id:", userId, "punchTime:", punchTime, "authType:", authType);

      // Verified device punches → process_att_logs (dashboard "present")
      if (logType === "verified") {
        void triggerEsslProcessing();
      }
    } catch (err) {
      console.error("❌ DB INSERT ERROR:", err);
    }

    console.log("BODY:", body);
    console.log("TABLE:", table);
    console.log("SN:", sn);
    console.log("LOG_TYPE:", logType);
    console.log("USER_ID:", userId);
    console.log("PUNCH_TIME:", punchTime);
    console.log("AUTH_TYPE:", authType);

    return OK();
  } catch (err) {
    console.error("REQUEST ERROR:", err);
    return OK();
  }
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}
