import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

function normalizeEmail(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

function digitsOnly(value?: string | null): string {
  return String(value || '').replace(/\D/g, '');
}

async function main() {
  await prisma.user.updateMany({
    where: {
      role: 'SUPERADMIN',
      username: { not: 'superadmin' },
    },
    data: { requireLoginOtp: true },
  });

  await prisma.user.updateMany({
    where: { username: 'superadmin' },
    data: { requireLoginOtp: false },
  });

  const credentials = await prisma.employeeCredentials.findMany({
    include: {
      employee: {
        select: {
          personalEmail: true,
          businessEmail: true,
          personalPhoneNo: true,
        },
      },
    },
  });

  const used = new Set<string>();
  for (const row of credentials) {
    used.add(row.username.trim().toLowerCase());
  }

  let updated = 0;
  for (const row of credentials) {
    const email =
      normalizeEmail(row.employee?.personalEmail) ||
      normalizeEmail(row.employee?.businessEmail);
    if (!email) continue;

    const data: {
      username?: string;
      password?: string;
    } = {};

    if (row.username.trim().toLowerCase() !== email) {
      if (used.has(email)) {
        console.warn(
          `Skip username change for employee ${row.employeeID}: email ${email} already used`,
        );
      } else {
        data.username = email;
      }
    }

    if (row.mustChangePassword) {
      const mobile =
        digitsOnly(row.employee?.personalPhoneNo) ||
        String(row.employee?.personalPhoneNo || '').trim();
      if (mobile) {
        data.password = await bcrypt.hash(mobile, SALT_ROUNDS);
      }
    }

    if (!data.username && !data.password) continue;

    await prisma.employeeCredentials.update({
      where: { id: row.id },
      data,
    });

    if (data.username) {
      used.delete(row.username.trim().toLowerCase());
      used.add(data.username);
    }
    updated += 1;
  }

  console.log(`Updated ${updated} employee credential row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
