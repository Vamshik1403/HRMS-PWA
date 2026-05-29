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

// ==================== CORRECTED DATE CONVERSION FOR TIMESTAMP ====================
/**
 * Convert DD/MM/YYYY HH:MM to JavaScript Date object WITHOUT timezone issues
 * Returns a Date object that will be stored correctly in PostgreSQL TIMESTAMP
 */
function convertToDate(dateString) {
  if (!dateString) return null;

  const match = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    log(DEBUG.WARN, `⚠️ Could not parse date: ${dateString}`);
    return null;
  }

  const [, day, month, year, hour, minute, second = '00'] = match;

  // Create as LOCAL date (no timezone conversion)
  // This stores "10:00" as "10:00" in the database
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}

async function processAttendanceLogs() {
  const startTime = Date.now();
  
  try {
    log(DEBUG.INFO, "🚀 Starting attendance logs processing...");
    
    // Step 1: Create process_att_logs table with TIMESTAMP punch_time
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
    
    // Step 2: Add columns if they don't exist
    try {
      await pool.query(`ALTER TABLE process_att_logs ADD COLUMN IF NOT EXISTS device_name VARCHAR(100)`);
      await pool.query(`ALTER TABLE process_att_logs ADD COLUMN IF NOT EXISTS device_type VARCHAR(10)`);
      await pool.query(`ALTER TABLE process_att_logs ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20)`);
      await pool.query(`ALTER TABLE process_att_logs ALTER COLUMN status SET DEFAULT '0'`);
      await pool.query(`ALTER TABLE essl_raw_attlog ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20)`);
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
    
    const uniqueUserIds = [...new Set(unprocessedLogs.map(l => l.user_id))];
    log(DEBUG.INFO, `User IDs in logs: ${uniqueUserIds.join(', ')}`);
    
    // Step 4: Build device SN → device info map
    log(DEBUG.DEBUG, "Building device SN map...");

    const allDevicesResult = await pool.query(`
      SELECT id, "deviceSN", "deviceName", "deviceType", "authTypes"
      FROM "Devices"
      WHERE status = 'Active'
    `);

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

    // Step 4b: Build EmpDeviceMapping
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
    }

    // Step 4c: Build TokenDeviceMapping
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
    }

    log(DEBUG.INFO, `📋 EmpMap: ${empMap.size} entries, TokenMap: ${tokenMap.size} entries`);

    // Fetch canteen setup
    let defaultTokenEnabled = false;
    try {
      const canteenSetupResult = await pool.query(`SELECT default_token_enabled FROM canteen_setup LIMIT 1`);
      defaultTokenEnabled = canteenSetupResult.rows.length > 0 ? canteenSetupResult.rows[0].default_token_enabled : false;
    } catch (err) {
      log(DEBUG.WARN, `⚠️ Could not read canteen_setup: ${err.message}. Defaulting to false.`);
    }
    log(DEBUG.INFO, `🍽️ Canteen default_token_enabled: ${defaultTokenEnabled}`);
    
    // Step 5: Process each log entry
    let insertedCount = 0;
    let canteenTrInserted = 0;
    let canteenTvInserted = 0;
    let attInserted = 0;
    let matchedCount = 0;
    let unmatchedLogs = [];
    let skippedDueToDate = 0;

    function parseAuthTypeFromRawBody(rawBody) {
      if (!rawBody) return null;
      const parts = rawBody.trim().split(/\s+/);
      if (parts.length < 5) return null;
      const mode = parts[4];
      switch (mode) {
        case '0':
        case '3':
          return 'PIN';
        case '1':
          return 'FINGER';
        case '2':
        case '4':
          return 'CARD';
        case '15':
          return 'FACE';
        default:
          return null;
      }
    }
    
    for (const logEntry of unprocessedLogs) {
      const user_id = logEntry.user_id;
      const rawDeviceSN = logEntry.device_sn;

      // Convert to Date object (UTC-based to avoid timezone issues)
      const convertedPunchTime = convertToDate(logEntry.punch_time);
      if (!convertedPunchTime) {
        log(DEBUG.WARN, `⚠️ Skipping record with invalid date: ${logEntry.punch_time} (ID: ${logEntry.id}, User: ${user_id})`);
        await pool.query(`UPDATE essl_raw_attlog SET export = 1 WHERE id = $1`, [logEntry.id]);
        skippedDueToDate++;
        continue;
      }

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

      let attendanceAuth = null;
      let tokenRegAuth = null;
      for (const at of deviceAuthTypes) {
        if (at.startsWith('ATT:')) attendanceAuth = at.replace('ATT:', '');
        else if (at.startsWith('TR:')) tokenRegAuth = at.replace('TR:', '');
      }

      const useTaggedRouting = deviceType === 'AT+TR' && attendanceAuth && tokenRegAuth && authType;

      if (deviceType === 'TR' || (useTaggedRouting && authType === tokenRegAuth)) {
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
            rawDeviceSN, user_id, empInfo.username, convertedPunchTime,
            empInfo.manageEmployeeID, empInfo.deviceID || deviceInfo.id, defaultTokenEnabled, authType
          ]);
          canteenTrInserted++;
          insertedCount++;
          matchedCount++;
          log(DEBUG.INFO, `🍽️ TR log: user_id "${user_id}" -> "${empInfo.username}"`);
        } else {
          unmatchedLogs.push({ user_id, device_sn: rawDeviceSN, punch_time: logEntry.punch_time });
          log(DEBUG.WARN, `⚠️ No mapping for user_id: "${user_id}" on TR route`);
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
          log(DEBUG.INFO, `🍽️ TV log: user_id "${user_id}" -> "${tokenInfo.username}"`);
        } else {
          unmatchedLogs.push({ user_id, device_sn: rawDeviceSN, punch_time: logEntry.punch_time });
          log(DEBUG.WARN, `⚠️ No token mapping for user_id: "${user_id}" on TV device`);
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
          log(DEBUG.INFO, `✅ AT log: user_id "${user_id}" -> "${empInfo.username}"`);
        } else {
          unmatchedLogs.push({ user_id, device_sn: rawDeviceSN, punch_time: logEntry.punch_time });
          log(DEBUG.WARN, `⚠️ No emp mapping for user_id: "${user_id}" on AT device`);
        }
      }
    }
    
    log(DEBUG.INFO, `✅ Inserted ${insertedCount} records total`);
    log(DEBUG.INFO, `   - process_att_logs: ${attInserted}`);
    log(DEBUG.INFO, `   - canteen_tr_logs: ${canteenTrInserted}`);
    log(DEBUG.INFO, `   - canteen_tv_logs: ${canteenTvInserted}`);
    if (skippedDueToDate > 0) {
      log(DEBUG.WARN, `   - Skipped due to invalid date: ${skippedDueToDate}`);
    }
    
    // Step 6: Update export flag
    if (insertedCount > 0) {
      const processedIds = unprocessedLogs
        .filter(logEntry => {
          const convertedDate = convertToDate(logEntry.punch_time);
          if (!convertedDate) return false;
          
          const di = deviceSnMap.get(logEntry.device_sn);
          if (!di) return false;
          const key = `${logEntry.device_sn}:${logEntry.user_id}`;
          return empMap.has(key) || tokenMap.has(key);
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
      skipped_invalid_date: skippedDueToDate,
      inserted: insertedCount
    });
    
    if (unmatchedLogs.length > 0) {
      log(DEBUG.WARN, `⚠️ Unmatched user_ids: ${[...new Set(unmatchedLogs.map(l => l.user_id))].join(', ')}`);
    }
    
    await pool.end();
    
    return {
      success: true,
      processedCount: insertedCount,
      matchedCount: matchedCount,
      unmatchedCount: unmatchedLogs.length,
      skippedInvalidDate: skippedDueToDate,
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