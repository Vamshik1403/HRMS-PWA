/**
 * Repair Excel/UI-imported process_att_logs that were stored with local Date()
 * (IST instant → shows ~5:30 early via UTC getters).
 *
 * Run: cd backend && npx ts-node -r dotenv/config scripts/fix-imported-punch-times.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  devicePunchToStorageDate,
  wallClockInZoneToStorageDate,
} from '../src/common/device-punch-time';

const prisma = new PrismaClient();

/** Prefer wall-clock from raw_body "IMPORTED <emp> <YYYY-MM-DD HH:mm:ss> …" */
function punchFromRawBody(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const m = raw.match(
    /IMPORTED\s+\S+\s+(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?)/i,
  );
  if (!m?.[1]) return null;
  return devicePunchToStorageDate(m[1]);
}

async function main() {
  const logs = await prisma.process_att_logs.findMany({
    where: {
      OR: [
        { raw_body: { contains: 'IMPORTED' } },
        { raw_body: { startsWith: 'IMPORTED' } },
      ],
      punch_time: { not: null },
    },
    select: { id: true, punch_time: true, raw_body: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const log of logs) {
    if (!log.punch_time) continue;

    const fromRaw = punchFromRawBody(log.raw_body);
    const fixed =
      fromRaw ?? wallClockInZoneToStorageDate(log.punch_time);

    if (fixed.getTime() === log.punch_time.getTime()) {
      skipped++;
      continue;
    }

    await prisma.process_att_logs.update({
      where: { id: log.id },
      data: { punch_time: fixed },
    });
    updated++;
  }

  console.log(
    `Imported punch repair: updated=${updated}, already-ok=${skipped}, scanned=${logs.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
