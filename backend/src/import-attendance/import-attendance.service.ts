import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

@Injectable()
export class ImportAttendanceService {
  constructor(private prisma: PrismaService) {}

  async importFromBuffer(buffer: Buffer, originalName: string) {
    const ext = originalName.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      throw new BadRequestException('Only CSV, XLSX, and XLS files are supported');
    }

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('The file contains no sheets');
    }
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (!rows.length) {
      throw new BadRequestException('The file contains no data rows');
    }

    // Validate required columns exist
    const requiredCols = ['punch_time'];
    const headers = Object.keys(rows[0]);
    const missing = requiredCols.filter(c => !headers.includes(c));
    if (missing.length) {
      throw new BadRequestException(
        `Missing required columns: ${missing.join(', ')}. ` +
        `Found columns: ${headers.join(', ')}`
      );
    }

    const processAttLogRows: any[] = [];
    const empAttLogRows: any[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const punchTime = this.parseDateTime(row.punch_time);
        if (!punchTime) {
          errors.push({ row: i + 2, error: 'Invalid punch_time format' });
          continue;
        }

        // Build process_att_logs row
        processAttLogRows.push({
          device_sn: row.device_sn ? String(row.device_sn) : null,
          user_id: row.user_id != null ? String(row.user_id) : null,
          username: row.username ? String(row.username) : null,
          punch_time: punchTime,
          company_name: row.company_name ? String(row.company_name) : null,
          branch_name: row.branch_name ? String(row.branch_name) : null,
          department_name: row.department_name ? String(row.department_name) : null,
          device_emp_code: row.device_emp_code ? String(row.device_emp_code) : null,
          manage_employee_id: row.manage_employee_id ? parseInt(String(row.manage_employee_id)) : null,
          device_id: row.device_id ? parseInt(String(row.device_id)) : null,
          raw_body: row.raw_body ? String(row.raw_body) : `IMPORTED:${originalName}`,
          status: row.status ? String(row.status) : '1',
          device_name: row.device_name ? String(row.device_name) : null,
          device_type: row.device_type ? String(row.device_type) : null,
        });

        // Build EmpAttendanceLogs row if we have enough data
        if (row.manage_employee_id || row.employee_id) {
          const empId = parseInt(String(row.manage_employee_id || row.employee_id));
          if (!isNaN(empId)) {
            empAttLogRows.push({
              serviceProviderID: row.service_provider_id ? parseInt(String(row.service_provider_id)) : 1,
              companyID: row.company_id ? parseInt(String(row.company_id)) : 1,
              branchesID: row.branches_id ? parseInt(String(row.branches_id)) : 1,
              deviceID: row.device_id ? parseInt(String(row.device_id)) : 0,
              employeeID: empId,
              punchTimeStamp: this.formatDateTimeString(punchTime),
              exported: 0,
              latitude: null,
              longitude: null,
              googleMapLink: null,
              location: null,
              mobileDeviceID: null,
              mobileDeviceInfo: null,
            });
          }
        }
      } catch (err) {
        errors.push({ row: i + 2, error: (err as Error).message });
      }
    }

    if (processAttLogRows.length === 0) {
      throw new BadRequestException(
        `No valid rows to import. ${errors.length} rows had errors. ` +
        `First error: ${errors[0]?.error || 'unknown'}`
      );
    }

    // Insert into database using transactions
    const result = await this.prisma.$transaction(async (tx) => {
      const processResult = await tx.process_att_logs.createMany({
        data: processAttLogRows,
      });

      let empResult = { count: 0 };
      if (empAttLogRows.length > 0) {
        empResult = await tx.empAttendanceLogs.createMany({
          data: empAttLogRows,
        });
      }

      return {
        processAttLogsInserted: processResult.count,
        empAttendanceLogsInserted: empResult.count,
      };
    });

    return {
      success: true,
      totalRowsInFile: rows.length,
      processAttLogsInserted: result.processAttLogsInserted,
      empAttendanceLogsInserted: result.empAttendanceLogsInserted,
      errorsCount: errors.length,
      errors: errors.slice(0, 20), // Return first 20 errors max
    };
  }

  async getImportedRecords() {
    const processLogs = await this.prisma.process_att_logs.findMany({
      where: {
        raw_body: { startsWith: 'IMPORTED:' },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });
    return processLogs;
  }

  async deleteImportedRecords(fileName?: string) {
    const whereClause = fileName
      ? { raw_body: `IMPORTED:${fileName}` }
      : { raw_body: { startsWith: 'IMPORTED:' } };

    const result = await this.prisma.$transaction(async (tx) => {
      // Get the employee IDs and punch times from imported process logs
      // so we can remove matching EmpAttendanceLogs too
      const importedLogs = await tx.process_att_logs.findMany({
        where: whereClause,
        select: { manage_employee_id: true, punch_time: true },
      });

      let empDeleteCount = 0;
      // Delete matching EmpAttendanceLogs
      for (const log of importedLogs) {
        if (log.manage_employee_id && log.punch_time) {
          const punchStr = this.formatDateTimeString(log.punch_time);
          const deleted = await tx.empAttendanceLogs.deleteMany({
            where: {
              employeeID: log.manage_employee_id,
              punchTimeStamp: punchStr,
            },
          });
          empDeleteCount += deleted.count;
        }
      }

      // Delete imported process_att_logs
      const processDeleted = await tx.process_att_logs.deleteMany({
        where: whereClause,
      });

      return {
        processAttLogsDeleted: processDeleted.count,
        empAttendanceLogsDeleted: empDeleteCount,
      };
    });

    return { success: true, ...result };
  }

  async downloadTemplate(): Promise<Buffer> {
    const headers = [
      'user_id',
      'punch_time',
      'device_sn',
      'username',
      'company_name',
      'branch_name',
      'department_name',
      'device_emp_code',
      'manage_employee_id',
      'device_id',
      'device_name',
      'device_type',
      'service_provider_id',
      'company_id',
      'branches_id',
      'employee_id',
      'status',
    ];

    const sampleRow = {
      user_id: '101',
      punch_time: '2025-03-01 09:00:00',
      device_sn: 'DEV001',
      username: 'John Doe',
      company_name: 'My Company',
      branch_name: 'Main Branch',
      department_name: 'Engineering',
      device_emp_code: 'EMP101',
      manage_employee_id: 1,
      device_id: 1,
      device_name: 'Main Gate Device',
      device_type: 'bio',
      service_provider_id: 1,
      company_id: 1,
      branches_id: 1,
      employee_id: 1,
      status: '1',
    };

    const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AttendanceLogs');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  private parseDateTime(value: any): Date | null {
    if (!value) return null;

    // Handle Excel serial date numbers
    if (typeof value === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return isNaN(date.getTime()) ? null : date;
    }

    const str = String(value).trim();

    // Try ISO / common date-time formats
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed;

    // Try DD/MM/YYYY HH:mm:ss
    const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?$/);
    if (dmyMatch) {
      const [, d, m, y, h, min, sec] = dmyMatch;
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min), parseInt(sec || '0'));
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  private formatDateTimeString(date: Date): string {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  }
}
