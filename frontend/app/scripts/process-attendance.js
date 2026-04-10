const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Debug levels
const DEBUG = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

let currentDebugLevel = 3;

function log(level, message, data = null) {
  if (level <= currentDebugLevel) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(DEBUG).find(key => DEBUG[key] === level);
    
    console.log(`[${timestamp}] [${levelName}] ${message}`);
    if (data && level === DEBUG.DEBUG) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'hrms',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function processAttendanceLogs() {
  const startTime = Date.now();
  
  try {
    log(DEBUG.INFO, "🚀 Starting attendance logs processing...");
    
    // Step 1: Create process_att_logs table if not exists with updated schema
    log(DEBUG.DEBUG, "Creating process_att_logs table...");
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS process_att_logs (
          id SERIAL PRIMARY KEY,
          device_sn VARCHAR(100),
          user_id VARCHAR(50),
          username VARCHAR(255),
          punch_time TIMESTAMP,
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
      // Add auth_type to essl_raw_attlog if not exists
      await pool.query(`ALTER TABLE essl_raw_attlog ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20)`);
      // Add auth_type to canteen tables if not exists
      await pool.query(`ALTER TABLE canteen_tr_logs ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20)`);
      await pool.query(`ALTER TABLE canteen_tv_logs ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20)`);
      await pool.query(`ALTER TABLE canteen_tv_not_logs ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20)`);
    } catch (err) {
      log(DEBUG.DEBUG, "Columns already exist or couldn't be added: " + err.message);
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
    const uniqueUserIds = [...new Set(unprocessedLogs.map(l => l.user_id))];
    log(DEBUG.INFO, `User IDs in logs: ${uniqueUserIds.join(', ')}`);
    
    // Step 4: Build device SN → device info map (for all devices)
    log(DEBUG.DEBUG, "Building device SN map...");

    const allDevicesResult = await pool.query(`
      SELECT id, "deviceSN", "deviceName", "deviceType", "authTypes"
      FROM "Devices"
      WHERE status = 'Active'
    `);

    // Map: deviceSN → { id, deviceName, deviceType, authTypes }
    const deviceSnMap = new Map();
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
    const empMap = new Map();
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
    const tokenMap = new Map();
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
      log(DEBUG.WARN, `⚠️ Could not read canteen_setup: ${err.message}. Defaulting to false.`);
    }
    log(DEBUG.INFO, `🍽️ Canteen default_token_enabled: ${defaultTokenEnabled}`);
    
    // Step 5: Process each log entry - route based on device type AND auth type
    let insertedCount = 0;
    let canteenTrInserted = 0;
    let canteenTvInserted = 0;
    let attInserted = 0;
    let matchedCount = 0;
    let unmatchedLogs = [];

    /**
     * Map ESSL verify mode from raw_body to auth_type (fallback if auth_type not in DB).
     * ESSL: 0=PIN, 1=FINGER, 2=CARD, 15=FACE
     */
    function parseAuthTypeFromRawBody(rawBody) {
      if (!rawBody) return null;
      const parts = rawBody.trim().split(/\s+/);
      // ESSL format: user_id date time status verify_mode ...
      // parts[3] = status (in/out), parts[4] = verify_mode (auth type)
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

      // Look up the device by its SN to determine its type
      const deviceInfo = deviceSnMap.get(rawDeviceSN);
      
      if (!deviceInfo) {
        unmatchedLogs.push({ user_id, device_sn: rawDeviceSN, punch_time: logEntry.punch_time });
        log(DEBUG.WARN, `⚠️ Unknown device SN: "${rawDeviceSN}" for user_id: "${user_id}"`);
        continue;
      }

      const deviceType = deviceInfo.deviceType || 'AT';
      const deviceAuthTypes = deviceInfo.authTypes || [];
      const lookupKey = `${rawDeviceSN}:${user_id}`;

      // Determine auth type: prefer DB column, fallback to parsing raw body
      const authType = logEntry.auth_type || parseAuthTypeFromRawBody(logEntry.raw_body);

      // Parse tagged auth types (e.g. ["ATT:FACE", "TR:PIN"])
      let attendanceAuth = null;
      let tokenRegAuth = null;
      for (const at of deviceAuthTypes) {
        if (at.startsWith('ATT:')) attendanceAuth = at.replace('ATT:', '');
        else if (at.startsWith('TR:')) tokenRegAuth = at.replace('TR:', '');
      }

      // Auth-type routing for AT+TR combo devices with tagged auth types
      const useTaggedRouting = deviceType === 'AT+TR' && attendanceAuth && tokenRegAuth && authType;

      if (deviceType === 'TR' || (useTaggedRouting && authType === tokenRegAuth)) {
        // Token Register → canteen_tr_logs
        // For dedicated TR devices: use TokenDeviceMapping
        // For auth-type routed AT devices: use EmpDeviceMapping
        let empInfo = null;
        if (deviceType === 'TR') {
          empInfo = tokenMap.get(lookupKey);
        } else {
          empInfo = empMap.get(lookupKey);
        }

        if (empInfo) {
          await pool.query(`
            INSERT INTO canteen_tr_logs (
                device_sn, user_id, username, punch_time,
                manage_employee_id, device_id, default_token, auth_type, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `, [
            rawDeviceSN, user_id, empInfo.username, logEntry.punch_time,
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
        // Token Verifier device → canteen_tv_logs
        const tokenInfo = tokenMap.get(lookupKey);
        if (tokenInfo) {
          await pool.query(`
            INSERT INTO canteen_tv_logs (
                device_sn, user_id, username, punch_time,
                manage_employee_id, device_id, default_token, auth_type, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `, [
            rawDeviceSN, user_id, tokenInfo.username, logEntry.punch_time,
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
        // AT device (FACE auth or no auth-type routing) → process_att_logs (attendance)
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
            rawDeviceSN, user_id, empInfo.username, logEntry.punch_time,
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
    
    // Step 6: Update export flag in essl_raw_attlog for processed logs
    if (insertedCount > 0) {
      const processedIds = unprocessedLogs
        .filter(logEntry => {
          const di = deviceSnMap.get(logEntry.device_sn);
          if (!di) return false;
          const key = `${logEntry.device_sn}:${logEntry.user_id}`;
          const dt = di.deviceType || 'AT';
          const logAuthType = logEntry.auth_type || parseAuthTypeFromRawBody(logEntry.raw_body);
          
          // Parse tagged auth types
          let attAuth = null;
          let trAuth = null;
          for (const at of (di.authTypes || [])) {
            if (at.startsWith('ATT:')) attAuth = at.replace('ATT:', '');
            else if (at.startsWith('TR:')) trAuth = at.replace('TR:', '');
          }
          const useTagged = dt === 'AT+TR' && attAuth && trAuth && logAuthType;
          
          // Check if any mapping exists for this log
          if (dt === 'TV') return tokenMap.has(key);
          if (dt === 'TR') return tokenMap.has(key);
          if (useTagged && logAuthType === trAuth) return empMap.has(key);
          return empMap.has(key);
        })
        .map(logEntry => logEntry.id);
      
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
      log(DEBUG.WARN, `⚠️ Unmatched user_ids: ${[...new Set(unmatchedLogs.map(l => l.user_id))].join(', ')}`);
    }
    
    // Step 8: Show last 10 processed records with device_type
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
    log(DEBUG.ERROR, `❌ Error: ${error.message}`);
    console.error(error.stack);
    await pool.end();
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the script
processAttendanceLogs()
  .then(result => {
    if (result.success) {
      console.log("\n✅ Script completed successfully!");
      console.log(`📊 Processed: ${result.processedCount} records`);
      if (result.unmatchedCount > 0) {
        console.log(`⚠️ Unmatched: ${result.unmatchedCount} records`);
      }
      console.log(`⏱️ Duration: ${result.duration} seconds`);
      process.exit(0);
    } else {
      console.error("\n❌ Script failed:", result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });