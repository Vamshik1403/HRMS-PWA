import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';

const prisma = new PrismaClient();

async function main() {
  const from = new Date('2026-06-01T00:00:00.000Z');
  const to = new Date('2026-06-21T00:00:00.000Z');

  const logs = await prisma.process_att_logs.findMany({
    where: {
      punch_time: {
        gte: from,
        lt: to,
      },
    },
    orderBy: [
      { username: 'asc' },
      { punch_time: 'asc' },
    ],
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Process Attendance Logs');

  sheet.columns = [
    { header: 'Sr No', key: 'sr_no', width: 10 },
    { header: 'User ID', key: 'user_id', width: 15 },
    { header: 'Username', key: 'username', width: 30 },
    { header: 'Punch Time', key: 'punch_time', width: 25 },
    { header: 'Company', key: 'company_name', width: 35 },
    { header: 'Branch', key: 'branch_name', width: 25 },
    { header: 'Department', key: 'department_name', width: 25 },
    { header: 'Device SN', key: 'device_sn', width: 20 },
  ];

  logs.forEach((log, index) => {
    sheet.addRow({
      sr_no: index + 1,
      user_id: log.user_id,
      username: log.username,
punch_time: log.punch_time
  ? log.punch_time.toISOString()
  : '',
      company_name: log.company_name,
      branch_name: log.branch_name,
      department_name: log.department_name,
      device_sn: log.device_sn,
    });
  });

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: 'A1',
    to: 'H1',
  };

  const fileName = 'process_att_logs_01_Jun_to_20_Jun_2026.xlsx';

  await workbook.xlsx.writeFile(fileName);

  console.log(`Exported ${logs.length} records`);
  console.log(`File created: ${fileName}`);
}

main()
  .catch((error) => {
    console.error('Export failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });