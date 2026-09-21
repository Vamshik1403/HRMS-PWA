/**
 * Fill latitude/longitude for branches, task sites, and WFH home addresses
 * that already have an address but empty coordinates. Does not overwrite
 * existing coords or other fields.
 *
 *   cd backend && npx ts-node -r dotenv/config scripts/backfill-geocode-locations.ts
 */
import { PrismaClient } from '@prisma/client';
import { composeAddressQuery, geocodeAddressParts } from '../src/common/reverse-geocode';
import { parseCoord } from '../src/common/geo-distance';

const prisma = new PrismaClient();
const PAUSE_MS = 1100;

function hasCoords(lat: unknown, lng: unknown): boolean {
  const a = parseCoord(lat);
  const b = parseCoord(lng);
  if (a == null || b == null) return false;
  const key = `${a},${b}`;
  // City-level Nominatim centroids from the first pass — refine with PIN.
  const generic = new Set([
    '19.054999,72.8692035',
    '19.1943294,72.9701779',
    '18.5213738,73.8545071',
  ]);
  return !generic.has(key);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocode(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
}) {
  const query = composeAddressQuery(
    parts.address,
    parts.city,
    parts.state,
    parts.pincode,
    parts.country,
  );
  if (!query) return null;
  return geocodeAddressParts(parts);
}

async function main() {
  let filled = 0;
  let skipped = 0;
  let failed = 0;

  const branches = await prisma.branches.findMany({
    select: {
      id: true,
      branchName: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      country: true,
      latitude: true,
      longitude: true,
    },
  });
  for (const row of branches) {
    if (hasCoords(row.latitude, row.longitude)) {
      skipped += 1;
      continue;
    }
    const query = composeAddressQuery(
      row.address,
      row.city,
      row.state,
      row.pincode,
      row.country,
    );
    if (!query) {
      skipped += 1;
      continue;
    }
    const point = await geocode({
      address: row.address,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      country: row.country,
    });
    if (!point) {
      failed += 1;
      console.log(`branch ${row.id} (${row.branchName}): no geocode for "${query}"`);
      await sleep(PAUSE_MS);
      continue;
    }
    await prisma.branches.update({
      where: { id: row.id },
      data: { latitude: String(point.lat), longitude: String(point.lng) },
    });
    filled += 1;
    console.log(`branch ${row.id} (${row.branchName}): ${point.lat}, ${point.lng}`);
    await sleep(PAUSE_MS);
  }

  const sites = await prisma.taskCustomerSite.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      branchName: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      country: true,
      latitude: true,
      longitude: true,
    },
  });
  for (const row of sites) {
    if (hasCoords(row.latitude, row.longitude)) {
      skipped += 1;
      continue;
    }
    const query = composeAddressQuery(
      row.address,
      row.city,
      row.state,
      row.pincode,
      row.country,
    );
    if (!query) {
      skipped += 1;
      continue;
    }
    const point = await geocode({
      address: row.address,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      country: row.country,
    });
    if (!point) {
      failed += 1;
      console.log(`site ${row.id} (${row.branchName}): no geocode for "${query}"`);
      await sleep(PAUSE_MS);
      continue;
    }
    await prisma.taskCustomerSite.update({
      where: { id: row.id },
      data: { latitude: String(point.lat), longitude: String(point.lng) },
    });
    filled += 1;
    console.log(`site ${row.id} (${row.branchName}): ${point.lat}, ${point.lng}`);
    await sleep(PAUSE_MS);
  }

  const homes = await prisma.manageEmployee.findMany({
    where: {
      isDeleted: false,
      wfhAllowed: true,
      wfhHomeAddress: { not: null },
    },
    select: {
      id: true,
      employeeID: true,
      employeeFirstName: true,
      employeeLastName: true,
      wfhHomeAddress: true,
      wfhHomeLatitude: true,
      wfhHomeLongitude: true,
    },
  });
  for (const row of homes) {
    if (hasCoords(row.wfhHomeLatitude, row.wfhHomeLongitude)) {
      skipped += 1;
      continue;
    }
    const query = composeAddressQuery(row.wfhHomeAddress);
    if (!query) {
      skipped += 1;
      continue;
    }
    const point = await geocode({ address: row.wfhHomeAddress });
    if (!point) {
      failed += 1;
      console.log(`employee ${row.id} (${row.employeeID}): no geocode for "${query}"`);
      await sleep(PAUSE_MS);
      continue;
    }
    await prisma.manageEmployee.update({
      where: { id: row.id },
      data: { wfhHomeLatitude: point.lat, wfhHomeLongitude: point.lng },
    });
    filled += 1;
    console.log(`employee ${row.id} (${row.employeeID}): ${point.lat}, ${point.lng}`);
    await sleep(PAUSE_MS);
  }

  console.log(`Done. filled=${filled} skipped=${skipped} failed=${failed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
