/**
 * One-off backfill: reverse-geocode existing attendance_locations rows that
 * have GPS coordinates but no stored address, and mirror the address into the
 * matching process_att_logs.raw_body (LOCATION_APP) so the admin dashboard,
 * PWA attendance and history all show real addresses for past punches.
 *
 * Run: node scripts/backfill-attendance-address.js  (from repo root or backend)
 * Respects Nominatim's ~1 req/sec usage policy.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'OpenHRM/1.0 (attendance-location)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name || null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const rows = await prisma.attendanceLocation.findMany({
    where: { address: null, latitude: { not: undefined } },
    orderBy: { id: 'asc' },
  });
  console.log(`Backfilling ${rows.length} attendance rows…`);

  for (const r of rows) {
    if (r.latitude == null || r.longitude == null) continue;
    const address = await reverseGeocode(r.latitude, r.longitude);
    if (address) {
      await prisma.attendanceLocation.update({
        where: { id: r.id },
        data: { address },
      });

      // Mirror into the LOCATION_APP process_att_logs row at the same instant.
      const logs = await prisma.process_att_logs.findMany({
        where: {
          manage_employee_id: r.employeeId,
          device_sn: 'LOCATION_APP',
          punch_time: r.checkinTime,
        },
      });
      for (const log of logs) {
        let body = {};
        try {
          body = log.raw_body ? JSON.parse(log.raw_body) : {};
        } catch {}
        body.address = address;
        await prisma.process_att_logs.update({
          where: { id: log.id },
          data: { raw_body: JSON.stringify(body) },
        });
      }
      console.log(`#${r.id} → ${address.slice(0, 60)}…`);
    } else {
      console.log(`#${r.id} → no address`);
    }
    await sleep(1100); // Nominatim rate limit
  }
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
