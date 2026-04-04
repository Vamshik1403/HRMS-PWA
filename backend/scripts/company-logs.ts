import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


async function ensureCompanyLogsTable(companyId: number) {
  const tableName = `"${companyId}_logs"`; 

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id SERIAL PRIMARY KEY,
      serviceProviderID INT,
      companyID INT,
      branchesID INT,
      deviceID INT,
      employeeID INT,
      punchTimeStamp VARCHAR,
      latitude INT NULL,
      longitude INT NULL,
      googleMapLink INT NULL,
      location INT NULL,
      mobileDeviceID INT NULL,
      mobileDeviceInfo INT NULL,
      exported INT DEFAULT 0,
      createdAt TIMESTAMP DEFAULT now()
    );
  `);

  return tableName;
}

async function insertLog(companyId: number, log: any) {
  const tableName = await ensureCompanyLogsTable(companyId);

  await prisma.$executeRawUnsafe(`
    INSERT INTO ${tableName}
      (id, serviceProviderID, companyID, branchesID, deviceID, employeeID, punchTimeStamp,
       latitude, longitude, googleMapLink, location, mobileDeviceID, mobileDeviceInfo, exported, createdAt)
    VALUES (
      ${log.id},
      ${log.serviceProviderID},
      ${log.companyID},
      ${log.branchesID},
      ${log.deviceID},
      ${log.employeeID},
      '${log.punchTimeStamp}',
      ${log.latitude ?? 'NULL'},
      ${log.longitude ?? 'NULL'},
      ${log.googleMapLink ?? 'NULL'},
      ${log.location ?? 'NULL'},
      ${log.mobileDeviceID ?? 'NULL'},
      ${log.mobileDeviceInfo ?? 'NULL'},
      ${log.exported},
      '${log.createdAt}'
    )
    ON CONFLICT (id) DO NOTHING;
  `);
}

async function main() {

  const res = await fetch('localhost:8000/emp-attendance-logs');
  if (!res.ok) {
    throw new Error(`Failed to fetch logs: ${res.status} ${res.statusText}`);
  }
  const logs = (await res.json()) as any[];
  for (const log of logs) {
    try {
      await insertLog(log.companyID, log);
      console.log(`✅ Inserted log ${log.id} into ${log.companyID}_logs`);
    } catch (err) {
      console.error(`❌ Failed to insert log ${log.id}:`, err);
    }
  }

  console.log('🎉 Sync finished');
}

main()
  .catch((e) => {
    console.error('❌ Script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
