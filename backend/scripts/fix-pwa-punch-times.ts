/**
 * One-off: re-encode LOCATION_APP / attendance_locations punch times as India wall-clock storage.
 * Run: npx ts-node -r tsconfig-paths/register scripts/fix-pwa-punch-times.ts
 */
import { PrismaClient } from '@prisma/client';
import { wallClockInZoneToStorageDate } from '../src/common/device-punch-time';

const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.process_att_logs.findMany({
    where: { device_sn: 'LOCATION_APP', punch_time: { not: null } },
    select: { id: true, punch_time: true },
  });

  let updated = 0;
  for (const log of logs) {
    if (!log.punch_time) continue;
    const fixed = wallClockInZoneToStorageDate(log.punch_time);
    if (fixed.getTime() === log.punch_time.getTime()) continue;
    await prisma.process_att_logs.update({
      where: { id: log.id },
      data: { punch_time: fixed },
    });
    updated++;
  }

  const locs = await prisma.attendanceLocation.findMany({
    select: { id: true, checkinTime: true },
  });

  let locUpdated = 0;
  for (const loc of locs) {
    const fixed = wallClockInZoneToStorageDate(loc.checkinTime);
    if (fixed.getTime() === loc.checkinTime.getTime()) continue;
    await prisma.attendanceLocation.update({
      where: { id: loc.id },
      data: { checkinTime: fixed },
    });
    locUpdated++;
  }

  console.log(`Updated process_att_logs: ${updated}, attendance_locations: ${locUpdated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
