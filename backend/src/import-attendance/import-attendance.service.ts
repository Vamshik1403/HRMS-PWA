import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

@Injectable()
export class ImportAttendanceService {
  constructor(private prisma: PrismaService) { }

  async importFromBuffer(buffer: Buffer, originalName: string) {
    const ext = originalName.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      throw new BadRequestException('Only CSV, XLSX, and XLS files are supported');
    }

    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: false,
      raw: true,
    });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('The file contains no sheets');
    }
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { 
      defval: null,
      raw: true
    });

    if (!rows.length) {
      throw new BadRequestException('The file contains no data rows');
    }

    // Validate required columns exist
    const headers = Object.keys(rows[0]);
    const hasLogTime = headers.includes('log_time');
    const hasPunchTime = headers.includes('punch_time');
    
    if (!hasLogTime && !hasPunchTime) {
      throw new BadRequestException(
        `Missing required column: log_time (or punch_time). Found columns: ${headers.join(', ')}`
      );
    }

    const requiredCols = ['user_id', 'device_sn'];
    const missing = requiredCols.filter(c => !headers.includes(c));
    if (missing.length) {
      throw new BadRequestException(
        `Missing required columns: ${missing.join(', ')}. Found columns: ${headers.join(', ')}`
      );
    }

    const esslRawAttlogRows: any[] = [];
    const processAttLogsRows: any[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Parse log_time to string format
        const timeValue = row.log_time || row.punch_time;
        const punchTimeString = this.parseDateTimeToString(timeValue);
        const punchTimeDate = this.parseStringToDate(punchTimeString);
        
        if (!punchTimeString || !punchTimeDate) {
          errors.push({ row: i + 2, error: 'Invalid log_time/punch_time format' });
          continue;
        }

        // Validate required fields
        if (!row.user_id) {
          errors.push({ row: i + 2, error: 'user_id is required' });
          continue;
        }

        if (!row.device_sn) {
          errors.push({ row: i + 2, error: 'device_sn is required' });
          continue;
        }

        // Build raw_body in ESSL format (matching device log format)
        const rawBody = `IMPORTED ${row.user_id} ${punchTimeString} 1 1 ${row.auth_type || ''}`;

        // Build essl_raw_attlog row (string date)
        esslRawAttlogRows.push({
          device_sn: String(row.device_sn),
          user_id: String(row.user_id),
          punch_time: punchTimeString,
          auth_type: row.auth_type ? String(row.auth_type) : null,
          raw_body: rawBody,
          log_type: 'IMPORT',
          is_valid: true,
          export: 0,
          created_at: new Date(),
        });

        // Build process_att_logs row (Date object)
        processAttLogsRows.push({
          device_sn: String(row.device_sn),
          user_id: String(row.user_id),
          punch_time: punchTimeDate,
          auth_type: row.auth_type ? String(row.auth_type) : null,
          raw_body: rawBody,
          status: '0',
          processed_at: new Date(),
        });

      } catch (err) {
        errors.push({ row: i + 2, error: (err as Error).message });
      }
    }

    if (esslRawAttlogRows.length === 0) {
      throw new BadRequestException(
        `No valid rows to import. ${errors.length} rows had errors. ` +
        `First error: ${errors[0]?.error || 'unknown'}`
      );
    }

    // Insert into both tables
    const rawResult = await this.prisma.essl_raw_attlog.createMany({
      data: esslRawAttlogRows,
      skipDuplicates: true,
    });

    const processResult = await this.prisma.process_att_logs.createMany({
      data: processAttLogsRows,
      skipDuplicates: true,
    });

    return {
      success: true,
      totalRowsInFile: rows.length,
      recordsInserted: rawResult.count,
      recordsProcessed: processResult.count,
      errorsCount: errors.length,
      errors: errors.slice(0, 20),
    };
  }

  async getImportedRecords() {
    const records = await this.prisma.essl_raw_attlog.findMany({
      where: {
        log_type: 'IMPORT',
      },
      orderBy: { id: 'desc' },
      take: 100,
    });
    return records;
  }

  async deleteImportedRecords() {
    // Delete from both tables
    const rawResult = await this.prisma.essl_raw_attlog.deleteMany({
      where: {
        log_type: 'IMPORT',
      },
    });

    const processResult = await this.prisma.process_att_logs.deleteMany({
      where: {
        raw_body: {
          contains: 'IMPORTED',
        },
      },
    });

    return {
      success: true,
      deletedCount: rawResult.count,
      processedDeletedCount: processResult.count,
      message: `Successfully deleted ${rawResult.count} raw records and ${processResult.count} processed records`,
    };
  }

  async downloadTemplate(): Promise<Buffer> {
    const headers = [
      'user_id',
      'log_time',
      'device_sn',
      'auth_type',
    ];

    const sampleRows = [
      {
        user_id: '101',
        log_time: '01/02/2026 09:00:00', // 1st Feb 2026
        device_sn: 'CQZ7232160084',
        auth_type: 'FINGER',
      },
      {
        user_id: '102',
        log_time: '15/12/2026 20:00:00', // 15th Dec 2026
        device_sn: 'CQZ7232160084',
        auth_type: 'CARD',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    
    ws['!cols'] = [
      { wch: 12 }, // user_id
      { wch: 22 }, // log_time
      { wch: 20 }, // device_sn
      { wch: 15 }, // auth_type
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template (DD-MM-YYYY)');
    
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  private parseDateTimeToString(value: any): string | null {
    if (value == null || value === '') return null;

    // Handle Excel serial number
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        const year = date.y;
        const month = String(date.m).padStart(2, '0');
        const day = String(date.d).padStart(2, '0');
        const hour = String(date.H).padStart(2, '0');
        const minute = String(date.M).padStart(2, '0');
        const second = String(Math.round(date.S || 0)).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
      }
    }

    // Handle string format
    if (typeof value === 'string') {
      return this.formatRawDateTimeString(value);
    }

    // Handle Date object
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      const hour = String(value.getHours()).padStart(2, '0');
      const minute = String(value.getMinutes()).padStart(2, '0');
      const second = String(value.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    return null;
  }

  private formatRawDateTimeString(rawString: string): string | null {
    const str = rawString.trim();
    
    // Format: DD/MM/YYYY HH:mm:ss (e.g., "01/02/2026 09:00:00" = 1st Feb 2026)
    let match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
    if (match) {
      const [, day, month, year, hour, minute, second] = match;
      
      // Validate ranges
      const d = parseInt(day);
      const m = parseInt(month);
      const y = parseInt(year);
      const h = parseInt(hour);
      const min = parseInt(minute);
      const sec = parseInt(second);
      
      if (m < 1 || m > 12) {
        throw new Error(`Invalid month: ${month}. Month must be between 01-12`);
      }
      if (d < 1 || d > 31) {
        throw new Error(`Invalid day: ${day}. Day must be between 01-31`);
      }
      if (h < 0 || h > 23) {
        throw new Error(`Invalid hour: ${hour}. Hour must be between 00-23`);
      }
      if (min < 0 || min > 59) {
        throw new Error(`Invalid minute: ${minute}. Minute must be between 00-59`);
      }
      
      // Check if date is valid (e.g., 31/02/2026 is invalid)
      const testDate = new Date(y, m - 1, d);
      if (testDate.getMonth() !== m - 1 || testDate.getDate() !== d) {
        throw new Error(`Invalid date: ${day}/${month}/${year} is not a valid calendar date`);
      }
      
      return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    
    // Format: DD/MM/YYYY HH:mm (e.g., "1/2/2026 09:00" = 1st Feb 2026)
    match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (match) {
      const [, day, month, year, hour, minute] = match;
      return this.formatRawDateTimeString(`${day}/${month}/${year} ${hour}:${minute}:00`);
    }
    
    // Format: DD/MM/YYYY HH:mm:ss AM/PM (e.g., "01/02/2026 09:00:00 AM")
    match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      const [, day, month, year, hour, minute, second, ampm] = match;
      let h = parseInt(hour);
      if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
      
      return this.formatRawDateTimeString(`${day}/${month}/${year} ${String(h).padStart(2, '0')}:${minute}:${second}`);
    }
    
    // Format: DD/MM/YYYY HH:mm AM/PM (e.g., "1/2/2026 9:00 PM")
    match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      const [, day, month, year, hour, minute, ampm] = match;
      let h = parseInt(hour);
      if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
      
      return this.formatRawDateTimeString(`${day}/${month}/${year} ${String(h).padStart(2, '0')}:${minute}:00`);
    }
    
    // Format: YYYY-MM-DD HH:mm:ss (already formatted)
    match = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      return str;
    }
    
    throw new Error(`Invalid date format: "${rawString}". Expected format: DD/MM/YYYY HH:mm:ss (e.g., 01/02/2026 09:00:00 for 1st Feb 2026)`);
  }

  private parseStringToDate(dateString: string | null): Date | null {
    if (!dateString) return null;
    
    // Handle YYYY-MM-DD HH:mm:ss format
    let match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      // Note: month is 0-indexed in JavaScript Date
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
      
      // Validate the date is valid
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${dateString}`);
      }
      
      return date;
    }
    
    // Handle DD/MM/YYYY HH:mm:ss format as fallback
    match = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      const [, day, month, year, hour, minute, second] = match;
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
      
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${dateString}`);
      }
      
      return date;
    }
    
    throw new Error(`Cannot parse date: ${dateString}`);
  }
}