const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Debug levels
const DEBUG = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
} as const;

type DebugLevel = typeof DEBUG[keyof typeof DEBUG];
let currentDebugLevel: DebugLevel = 3;

function log(level: DebugLevel, message: string, data: any = null): void {
  if (level <= currentDebugLevel) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(DEBUG).find(key => DEBUG[key as keyof typeof DEBUG] === level);
    
    console.log(`[${timestamp}] [${levelName}] ${message}`);
    if (data && level === DEBUG.DEBUG) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hrms',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

interface DeviceInfo {
  id: number;
  deviceName: string;
  deviceType: string;
  authTypes: string[];
}

interface EmpInfo {
  manageEmployeeID: number;
  username: string;
  companyName: string;
  branchName: string;
  departmentName: string;
  deviceID: number;
  deviceSN: string;
  deviceName: string;
  deviceType: string;
}

interface TokenInfo {
  manageEmployeeID: number;
  username: string;
  deviceID: number;
  deviceSN: string;
  deviceName: string;
  deviceType: string;
}

interface UnmatchedLog {
  user_id: string;
  device_sn: string;
  punch_time: string;
}

interface ProcessResult {
  success: boolean;
  processedCount?: number;
  matchedCount?: number;
  unmatchedCount?: number;
  duration?: string;
  error?: string;
}

// ==================== DATE CONVERSION HELPER ====================
/**
 * Convert DD/MM/YYYY HH:mm to YYYY-MM-DD HH:mm:ss string format
 */
function convertToTimestampString(dateStr: string | null): string | null {
  if (!dateStr) return null;
  
  // Format: "13/4/2026 10:00" or "13/04/2026 10:00"
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (match) {
    const [, day, month, year, hour, minute] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute}:00`;
  }
  
  // If already in YYYY-MM-DD format, return as is
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/)) {
    return dateStr;
  }
  
  return dateStr;
}

async function processAttendanceLogs(): Promise<ProcessResult> {
  const startTime = Date.now();
  
  try {
    log(DEBUG.INFO, "🚀 Starting attendance logs processing...");
    
    // Step 1: Create process_att_logs table if not exists with VARCHAR punch_time
    log(DEBUG.DEBUG, "Creating process_att_logs table...");
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS process_att_logs (
          id SERIAL PRIMARY KEY,
          device_sn VARCHAR(100),
          user_id VARCHAR(50),
          username VARCHAR(255),
          punch_time VARCHAR(50),
          company_name VARCHAR(255),
          branch_name VARCHAR(255),
          department_name VARCHAR(255),
          device_emp_code VARCHAR(50),
          manage_employee_id INTEGER,
          device_id INTEGER,
          device_name VARCHAR(100),
          device_type VARCHAR(10),
          raw_body TEXT,
          processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(20) DEFAULT '0'
      )
    `);
    
    // Step 2: Add columns if they don't exist (for existing tables)
    try {
      await pool.query(`ALTER TABLE process_att_logs ADD COLUMN IF NOT EXISTS device_name VARCHAR(100)`);
      await pool.query(`ALTER TABLE process_att_logs ADD COLUMN IF NOT EXISTS device_type VARCHAR(10)`);
      await pool.query(`ALTER TABLE process_att_logs ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20)`);
      await pool.query(`ALTER TABLE process_att_logs ALTER COLUMN status SET DEFAULT '0'`);
      
      // Ensure punch_time is VARCHAR (convert if it's TIMESTAMP)
      await pool.query(`ALTER TABLE process_att_logs ALTER COLUMN punch_time TYPE VARCHAR(50)`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log(DEBUG.DEBUG, "Columns already exist or couldn't be added: " + errorMessage);
    }
    
    // Add auth_type to essl_raw_attlog if not exists
    try {
      await pool.query(`ALTER TABLE essl_raw_attlog ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20)`);
    } catch (err) {
      log(DEBUG.DEBUG, "auth_type column already exists in essl_raw_attlog");
    }
    
    // Add auth_type to canteen tables if not exists
    try {
      await pool.query(`ALTER TABLE canteen_tr_logs ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20)`);
      await pool.query(`ALTER TABLE canteen_tv_logs ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20)`);
      await pool.query(`ALTER TABLE canteen_tv_not_logs ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20)`);
    } catch (err) {
      log(DEBUG.DEBUG, "Canteen table columns already exist");
    }
    
    // Step 3: Get unprocessed logs from essl_raw_attlog
    log(DEBUG.DEBUG, "Fetching unprocessed logs from essl_raw_attlog...");
    
    const logsResult = await pool.query(`
      SELECT id, device_sn, user_id, punch_time, raw_body, auth_type
      FROM essl_raw_attlog
      WHERE user_id IS NOT NULL 
        AND user_id != ''
        AND COALESCE(export, 0) = 0
    `);
    
    const unprocessedLogs = logsResult.rows;
    log(DEBUG.INFO, `📊 Found ${unprocessedLogs.length} unprocessed records`);
    
    if (unprocessedLogs.length === 0) {
      log(DEBUG.INFO, "✨ No new records to process");
      await pool.end();
      return { success: true, processedCount: 0 };
    }
    
    // Show unique user_ids in logs
    const uniqueUserIds = [...new Set(unprocessedLogs.map((l: any) => l.user_id))];
    log(DEBUG.INFO, `User IDs in logs: ${uniqueUserIds.join(', ')}`);
    
    // Step 4: Build device SN → device info map (for all devices)
    log(DEBUG.DEBUG, "Building device SN map...");

    const allDevicesResult = await pool.query(`
      SELECT id, "deviceSN", "deviceName", "deviceType", "authTypes"
      FROM "Devices"
      WHERE status = 'Active'
    `);

    // Map: deviceSN → { id, deviceName, deviceType, authTypes }
    const deviceSnMap = new Map<string, DeviceInfo>();
    for (const row of allDevicesResult.rows) {
      deviceSnMap.set(row.deviceSN, {
        id: row.id,
        deviceName: row.deviceName,
        deviceType: row.deviceType || 'AT',
        authTypes: row.authTypes || [],
      });
    }
    log(DEBUG.INFO, `📋 Found ${deviceSnMap.size} active devices`);
    for (const [sn, info] of deviceSnMap) {
      log(DEBUG.INFO, `  Device SN: "${sn}" -> ${info.deviceName} (Type: ${info.deviceType})`);
    }

    // Step 4b: Build EmpDeviceMapping (for AT devices → process_att_logs)
    log(DEBUG.DEBUG, "Building employee mapping from EmpDeviceMapping...");
    
    const empMappingResult = await pool.query(`
      SELECT 
        edm."deviceEmpCode",
        edm."manageEmployeeID",
        edm."deviceID",
        d."deviceSN",
        d."deviceName" as device_name,
        d."deviceType" as device_type,
        me."employeeFirstName",
        me."employeeLastName",
        me."companyID",
        me."branchesID",
        me."departmentNameID",
        c."companyName",
        b."branchName",
        dep."departmentName"
      FROM "EmpDeviceMapping" edm
      LEFT JOIN "Devices" d ON edm."deviceID" = d.id
      LEFT JOIN "ManageEmployee" me ON edm."manageEmployeeID" = me.id
      LEFT JOIN "Company" c ON me."companyID" = c.id
      LEFT JOIN "Branches" b ON me."branchesID" = b.id
      LEFT JOIN "Departments" dep ON me."departmentNameID" = dep.id
      WHERE edm."deviceEmpCode" IS NOT NULL
    `);
    
    log(DEBUG.INFO, `Found ${empMappingResult.rows.length} device mappings in EmpDeviceMapping`);

    // Map: "deviceSN:deviceEmpCode" → employee info (for AT devices)
    const empMap = new Map<string, EmpInfo>();
    for (const row of empMappingResult.rows) {
      const key = `${row.deviceSN}:${row.deviceEmpCode}`;
      const username = `${row.employeeFirstName || ''} ${row.employeeLastName || ''}`.trim() || `Employee ${row.deviceEmpCode}`;
      empMap.set(key, {
        manageEmployeeID: row.manageEmployeeID,
        username,
        companyName: row.companyName,
        branchName: row.branchName,
        departmentName: row.departmentName,
        deviceID: row.deviceID,
        deviceSN: row.deviceSN,
        deviceName: row.device_name,
        deviceType: row.device_type || 'AT',
      });
      log(DEBUG.DEBUG, `EmpMap "${key}" -> "${username}" (Type: ${row.device_type || 'AT'})`);
    }

    // Step 4c: Build TokenDeviceMapping (for TR/TV devices → canteen tables)
    log(DEBUG.DEBUG, "Building employee mapping from TokenDeviceMapping...");
    
    const tokenMappingResult = await pool.query(`
      SELECT 
        tdm."deviceEmpCode",
        tdm."manageEmployeeID",
        tdm."deviceID",
        d."deviceSN",
        d."deviceName" as device_name,
        d."deviceType" as device_type,
        me."employeeFirstName",
        me."employeeLastName"
      FROM "TokenDeviceMapping" tdm
      LEFT JOIN "Devices" d ON tdm."deviceID" = d.id
      LEFT JOIN "ManageEmployee" me ON tdm."manageEmployeeID" = me.id
      WHERE tdm."deviceEmpCode" IS NOT NULL
    `);

    log(DEBUG.INFO, `Found ${tokenMappingResult.rows.length} device mappings in TokenDeviceMapping`);

    // Map: "deviceSN:deviceEmpCode" → employee info (for TR/TV devices)
    const tokenMap = new Map<string, TokenInfo>();
    for (const row of tokenMappingResult.rows) {
      const key = `${row.deviceSN}:${row.deviceEmpCode}`;
      const username = `${row.employeeFirstName || ''} ${row.employeeLastName || ''}`.trim() || `Employee ${row.deviceEmpCode}`;
      tokenMap.set(key, {
        manageEmployeeID: row.manageEmployeeID,
        username,
        deviceID: row.deviceID,
        deviceSN: row.deviceSN,
        deviceName: row.device_name,
        deviceType: row.device_type,
      });
      log(DEBUG.DEBUG, `TokenMap "${key}" -> "${username}" (${row.device_type})`);
    }

    log(DEBUG.INFO, `📋 EmpMap: ${empMap.size} entries, TokenMap: ${tokenMap.size} entries`);

    // Fetch current canteen setup for default_token flag
    let defaultTokenEnabled = false;
    try {
      const canteenSetupResult = await pool.query(`SELECT default_token_enabled FROM canteen_setup LIMIT 1`);
      defaultTokenEnabled = canteenSetupResult.rows.length > 0 ? canteenSetupResult.rows[0].default_token_enabled : false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log(DEBUG.WARN, `⚠️ Could not read canteen_setup: ${errorMessage}. Defaulting to false.`);
    }
    log(DEBUG.INFO, `🍽️ Canteen default_token_enabled: ${defaultTokenEnabled}`);
    
    // Step 5: Process each log entry
    let insertedCount = 0;
    let canteenTrInserted = 0;
    let canteenTvInserted = 0;
    let attInserted = 0;
    let matchedCount = 0;
    const unmatchedLogs: UnmatchedLog[] = [];

    function parseAuthTypeFromRawBody(rawBody: string | null): string | null {
      if (!rawBody) return null;
      const parts = rawBody.trim().split(/\s+/);
      if (parts.length < 5) return null;
      const mode = parts[4];
      switch (mode) {
        case '0':  return 'PIN';
        case '1':  return 'FINGER';
        case '2':  return 'CARD';
        case '3':  return 'PIN';
        case '15': return 'FACE';
        default:   return null;
      }
    }
    
    for (const logEntry of unprocessedLogs) {
      const user_id = logEntry.user_id;
      const rawDeviceSN = logEntry.device_sn;

      const deviceInfo = deviceSnMap.get(rawDeviceSN);
      
      if (!deviceInfo) {
        unmatchedLogs.push({ user_id, device_sn: rawDeviceSN, punch_time: logEntry.punch_time });
        log(DEBUG.WARN, `⚠️ Unknown device SN: "${rawDeviceSN}" for user_id: "${user_id}"`);
        continue;
      }

      const deviceType = deviceInfo.deviceType || 'AT';
      const deviceAuthTypes = deviceInfo.authTypes || [];
      const lookupKey = `${rawDeviceSN}:${user_id}`;

      const authType = logEntry.auth_type || parseAuthTypeFromRawBody(logEntry.raw_body);

      let attendanceAuth: string | null = null;
      let tokenRegAuth: string | null = null;
      for (const at of deviceAuthTypes) {
        if (at.startsWith('ATT:')) attendanceAuth = at.replace('ATT:', '');
        else if (at.startsWith('TR:')) tokenRegAuth = at.replace('TR:', '');
      }

      const useTaggedRouting = deviceType === 'AT+TR' && attendanceAuth && tokenRegAuth && authType;

      const convertedPunchTime = convertToTimestampString(logEntry.punch_time);

      if (deviceType === 'TR' || (useTaggedRouting && authType === tokenRegAuth)) {
        let empInfo: EmpInfo | TokenInfo | null = null;
        if (deviceType === 'TR') {
          empInfo = tokenMap.get(lookupKey) || null;
        } else {
          empInfo = empMap.get(lookupKey) || null;
        }

        if (empInfo) {
          await pool.query(`
            INSERT INTO canteen_tr_logs (
                device_sn, user_id, username, punch_time,
                manage_employee_id, device_id, default_token, auth_type, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `, [
            rawDeviceSN, user_id, empInfo.username, convertedPunchTime,
            empInfo.manageEmployeeID, empInfo.deviceID || deviceInfo.id, defaultTokenEnabled, authType
          ]);
          canteenTrInserted++;
          insertedCount++;
          matchedCount++;
          log(DEBUG.INFO, `🍽️ TR log: user_id "${user_id}" -> "${empInfo.username}" (Device: ${deviceInfo.deviceName}, AuthType: ${authType})`);
        } else {
          unmatchedLogs.push({ user_id, device_sn: rawDeviceSN, punch_time: logEntry.punch_time });
          log(DEBUG.WARN, `⚠️ No mapping for user_id: "${user_id}" on TR/canteen route. Key: "${lookupKey}"`);
        }

      } else if (deviceType === 'TV') {
        const tokenInfo = tokenMap.get(lookupKey);
        if (tokenInfo) {
          await pool.query(`
            INSERT INTO canteen_tv_logs (
                device_sn, user_id, username, punch_time,
                manage_employee_id, device_id, default_token, auth_type, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `, [
            rawDeviceSN, user_id, tokenInfo.username, convertedPunchTime,
            tokenInfo.manageEmployeeID, tokenInfo.deviceID, defaultTokenEnabled, authType
          ]);
          canteenTvInserted++;
          insertedCount++;
          matchedCount++;
          log(DEBUG.INFO, `🍽️ TV log: user_id "${user_id}" -> "${tokenInfo.username}" (Device: ${deviceInfo.deviceName})`);
        } else {
          unmatchedLogs.push({ user_id, device_sn: rawDeviceSN, punch_time: logEntry.punch_time });
          log(DEBUG.WARN, `⚠️ No token mapping for user_id: "${user_id}" on TV device: "${rawDeviceSN}". Key: "${lookupKey}"`);
        }

      } else {
        const empInfo = empMap.get(lookupKey);
        if (empInfo) {
          await pool.query(`
            INSERT INTO process_att_logs (
                device_sn, user_id, username, punch_time, 
                company_name, branch_name, department_name, 
                device_emp_code, manage_employee_id, device_id,
                device_name, device_type, auth_type, raw_body, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, '0')
          `, [
            rawDeviceSN, user_id, empInfo.username, convertedPunchTime,
            empInfo.companyName, empInfo.branchName, empInfo.departmentName,
            user_id, empInfo.manageEmployeeID, empInfo.deviceID,
            empInfo.deviceName, empInfo.deviceType, authType, logEntry.raw_body
          ]);
          attInserted++;
          insertedCount++;
          matchedCount++;
          log(DEBUG.INFO, `✅ AT log: user_id "${user_id}" -> "${empInfo.username}" (Device: ${empInfo.deviceName}, Type: ${empInfo.deviceType}, AuthType: ${authType})`);
        } else {
          unmatchedLogs.push({ user_id, device_sn: rawDeviceSN, punch_time: logEntry.punch_time });
          log(DEBUG.WARN, `⚠️ No emp mapping for user_id: "${user_id}" on AT device: "${rawDeviceSN}". Key: "${lookupKey}"`);
        }
      }
    }
    
    log(DEBUG.INFO, `✅ Inserted ${insertedCount} records total`);
    log(DEBUG.INFO, `   - process_att_logs: ${attInserted}`);
    log(DEBUG.INFO, `   - canteen_tr_logs: ${canteenTrInserted}`);
    log(DEBUG.INFO, `   - canteen_tv_logs: ${canteenTvInserted}`);
    
    // Step 6: Update export flag
    if (insertedCount > 0) {
      const processedIds = unprocessedLogs
        .filter((logEntry: any) => {
          const di = deviceSnMap.get(logEntry.device_sn);
          if (!di) return false;
          const key = `${logEntry.device_sn}:${logEntry.user_id}`;
          const dt = di.deviceType || 'AT';
          const logAuthType = logEntry.auth_type || parseAuthTypeFromRawBody(logEntry.raw_body);
          
          let attAuth: string | null = null;
          let trAuth: string | null = null;
          for (const at of (di.authTypes || [])) {
            if (at.startsWith('ATT:')) attAuth = at.replace('ATT:', '');
            else if (at.startsWith('TR:')) trAuth = at.replace('TR:', '');
          }
          const useTagged = dt === 'AT+TR' && attAuth && trAuth && logAuthType;
          
          if (dt === 'TV') return tokenMap.has(key);
          if (dt === 'TR') return tokenMap.has(key);
          if (useTagged && logAuthType === trAuth) return empMap.has(key);
          return empMap.has(key);
        })
        .map((logEntry: any) => logEntry.id);
      
      if (processedIds.length > 0) {
        await pool.query(`
          UPDATE essl_raw_attlog 
          SET export = 1 
          WHERE id = ANY($1::int[])
        `, [processedIds]);
        log(DEBUG.INFO, `✅ Updated ${processedIds.length} records with export=1`);
      }
    }
    
    // Step 7: Show summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(DEBUG.INFO, `🎉 Processing completed in ${duration} seconds`);
    log(DEBUG.INFO, `📈 Summary:`, {
      total_logs: unprocessedLogs.length,
      matched: matchedCount,
      unmatched: unmatchedLogs.length,
      inserted: insertedCount
    });
    
    if (unmatchedLogs.length > 0) {
      const unmatchedUserIds = [...new Set(unmatchedLogs.map((l: UnmatchedLog) => l.user_id))];
      log(DEBUG.WARN, `⚠️ Unmatched user_ids: ${unmatchedUserIds.join(', ')}`);
    }
    
    // Step 8: Show last 10 processed records
    const processedRecords = await pool.query(`
      SELECT id, user_id, username, device_name, device_type, company_name, branch_name, department_name, punch_time, status
      FROM process_att_logs 
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    if (processedRecords.rows.length > 0) {
      console.log("\n📋 Last 10 processed records:");
      console.table(processedRecords.rows);
    }
    
    await pool.end();
    
    return {
      success: true,
      processedCount: insertedCount,
      matchedCount: matchedCount,
      unmatchedCount: unmatchedLogs.length,
      duration: duration
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(DEBUG.ERROR, `❌ Error: ${errorMessage}`);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    await pool.end();
    return {
      success: false,
      error: errorMessage
    };
  }
}

// Run the script
processAttendanceLogs()
  .then((result: ProcessResult) => {
    if (result.success) {
      console.log("\n✅ Script completed successfully!");
      console.log(`📊 Processed: ${result.processedCount} records`);
      if (result.unmatchedCount && result.unmatchedCount > 0) {
        console.log(`⚠️ Unmatched: ${result.unmatchedCount} records`);
      }
      console.log(`⏱️ Duration: ${result.duration} seconds`);
      process.exit(0);
    } else {
      console.error("\n❌ Script failed:", result.error);
      process.exit(1);
    }
  })
  .catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Fatal error:", errorMessage);
    process.exit(1);
  });