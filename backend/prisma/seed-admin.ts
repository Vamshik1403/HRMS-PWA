import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const username = "admin";
  const password = "admin123";
  const saltRounds = 12;

  const passwordHash = await bcrypt.hash(password, saltRounds);

  const existing = await prisma.user.findUnique({
    where: { username },
  });

  let user;
  if (existing) {
    user = await prisma.user.update({
      where: { username },
      data: {
        passwordHash,
        role: "SUPERADMIN",
        isActive: true,
      },
    });
    console.log(`Existing user "${username}" updated with new password and SUPERADMIN role.`);
  } else {
    user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: "SUPERADMIN",
        isActive: true,
      },
    });
    console.log(`New super admin user created.`);
  }

  console.log(`Super admin user created:`);
  console.log(`  ID:       ${user.id}`);
  console.log(`  Username: ${username}`);
  console.log(`  Password: ${password}`);
  console.log(`  Role:     SUPERADMIN`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
