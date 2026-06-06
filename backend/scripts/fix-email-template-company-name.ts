/**
 * One-off: replace static OpenHRM in email templates with {{companyName}}.
 * Usage: npm run fix:email-template-company
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.emailTemplate.findMany();
  let updated = 0;
  for (const row of rows) {
    const subject = row.subject.replace(/\bOpenHRM\b/gi, '{{companyName}}');
    const bodyHtml = row.bodyHtml.replace(/\bOpenHRM\b/gi, '{{companyName}}');
    if (subject !== row.subject || bodyHtml !== row.bodyHtml) {
      await prisma.emailTemplate.update({
        where: { id: row.id },
        data: { subject, bodyHtml },
      });
      updated += 1;
      console.log(`Updated template #${row.id} (${row.eventType})`);
    }
  }
  console.log(`Done. ${updated} template(s) updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
