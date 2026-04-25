// src/process-att-logs/process_att_logs.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProcessAttLogDto } from './dto/create-process_att_log.dto';
import { UpdateProcessAttLogDto } from './dto/update-process_att_log.dto';
import { QueryProcessAttLogDto } from './dto/query-process_att_log.dto';

@Injectable()
export class ProcessAttLogsService {
  constructor(private prisma: PrismaService) {}

  // Helper method to format date to YYYY-MM-DD
  private formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async create(createProcessAttLogDto: CreateProcessAttLogDto) {
    try {
      return await this.prisma.process_att_logs.create({
        data: {
          device_sn: createProcessAttLogDto.device_sn,
          user_id: createProcessAttLogDto.user_id,
          username: createProcessAttLogDto.username,
          punch_time: createProcessAttLogDto.punch_time || '',
          company_name: createProcessAttLogDto.company_name,
          branch_name: createProcessAttLogDto.branch_name,
          department_name: createProcessAttLogDto.department_name,
          device_emp_code: createProcessAttLogDto.device_emp_code,
          manage_employee_id: createProcessAttLogDto.manage_employee_id,
          device_id: createProcessAttLogDto.device_id,
          raw_body: createProcessAttLogDto.raw_body,
          status: createProcessAttLogDto.status,
          device_name: createProcessAttLogDto.device_name,
        },
      });
    } catch (error) {
      throw new BadRequestException(`Failed to create attendance log: ${(error as Error).message}`);
    }
  }

async findAll(query: QueryProcessAttLogDto = {}) {
  const {
    dateFrom,
    dateTo,
    deviceId,
    deviceIds,
    username,
    company_name,
    branch_name,
    limit: rawLimit = 1000,
    offset: rawOffset = 0,
    orderBy = 'desc',
  } = query;

  const limit = typeof rawLimit === 'string' ? parseInt(rawLimit, 10) || 1000 : Number(rawLimit) || 1000;
  const offset = typeof rawOffset === 'string' ? parseInt(rawOffset, 10) || 0 : Number(rawOffset) || 0;

  const whereConditions: any = {};

  // Fix for string-based date comparison
  // Fix: Use Date objects for DateTime field
  if (dateFrom && dateTo) {
    whereConditions.punch_time = {
      gte: new Date(`${dateFrom}T00:00:00.000Z`),
      lte: new Date(`${dateTo}T23:59:59.999Z`),
    };
  } else if (dateFrom) {
    whereConditions.punch_time = {
      gte: new Date(`${dateFrom}T00:00:00.000Z`),
    };
  } else if (dateTo) {
    whereConditions.punch_time = {
      lte: new Date(`${dateTo}T23:59:59.999Z`),
    };
  }

  // Convert device_id to number if it's a string field in your schema
  if (deviceId) {
    whereConditions.device_id = String(deviceId); // Convert to string if device_id is string
  }

  if (deviceIds) {
    const deviceIdArray = deviceIds.split(',').map(id => id.trim()); // Keep as strings
    whereConditions.device_id = {
      in: deviceIdArray,
    };
  }

  if (username) {
    whereConditions.username = {
      contains: username,
      mode: 'insensitive',
    };
  }

  if (company_name) {
    whereConditions.company_name = {
      contains: company_name,
      mode: 'insensitive',
    };
  }

  if (branch_name) {
    whereConditions.branch_name = {
      contains: branch_name,
      mode: 'insensitive',
    };
  }

  console.log('Where Conditions:', JSON.stringify(whereConditions, null, 2));

  try {
    const [logs, total] = await Promise.all([
      this.prisma.process_att_logs.findMany({
        where: whereConditions,
        orderBy: {
          punch_time: orderBy,
        },
        take: limit,
        skip: offset,
      }),
      this.prisma.process_att_logs.count({
        where: whereConditions,
      }),
    ]);

    return {
      data: logs,
      total,
      limit,
      offset,
      hasMore: offset + logs.length < total,
    };
  } catch (error) {
    console.error('Prisma error:', error);
    throw error;
  }
}

async findOne(id: number) {
    const log = await this.prisma.process_att_logs.findUnique({
      where: { id },
    });

    if (!log) {
      throw new NotFoundException(`Attendance log with ID ${id} not found`);
    }

    return log;
  }

  async findByDeviceId(deviceId: number, dateFrom?: string, dateTo?: string) {
    const whereConditions: any = {
      device_id: deviceId,
    };

    if (dateFrom && dateTo) {
      whereConditions.punch_time = {
        gte: new Date(`${dateFrom}T00:00:00.000Z`),
        lte: new Date(`${dateTo}T23:59:59.999Z`),
      };
    } else if (dateFrom) {
      whereConditions.punch_time = {
        gte: new Date(`${dateFrom}T00:00:00.000Z`),
      };
    } else if (dateTo) {
      whereConditions.punch_time = {
        lte: new Date(`${dateTo}T23:59:59.999Z`),
      };
    }

    return await this.prisma.process_att_logs.findMany({
      where: whereConditions,
      orderBy: {
        punch_time: 'desc',
      },
    });
  }

  async findByDeviceIds(deviceIds: number[], dateFrom?: string, dateTo?: string) {
    const whereConditions: any = {
      device_id: {
        in: deviceIds,
      },
    };

    if (dateFrom && dateTo) {
      whereConditions.punch_time = {
        gte: new Date(`${dateFrom}T00:00:00.000Z`),
        lte: new Date(`${dateTo}T23:59:59.999Z`),
      };
    } else if (dateFrom) {
      whereConditions.punch_time = {
        gte: new Date(`${dateFrom}T00:00:00.000Z`),
      };
    } else if (dateTo) {
      whereConditions.punch_time = {
        lte: new Date(`${dateTo}T23:59:59.999Z`),
      };
    }

    return await this.prisma.process_att_logs.findMany({
      where: whereConditions,
      orderBy: {
        punch_time: 'desc',
      },
    });
  }

  async findByUsername(username: string, dateFrom?: string, dateTo?: string) {
    const whereConditions: any = {
      username: {
        equals: username,
        mode: 'insensitive',
      },
    };

       if (dateFrom && dateTo) {
      whereConditions.punch_time = {
        gte: new Date(`${dateFrom}T00:00:00.000Z`),
        lte: new Date(`${dateTo}T23:59:59.999Z`),
      };
    } else if (dateFrom) {
      whereConditions.punch_time = {
        gte: new Date(`${dateFrom}T00:00:00.000Z`),
      };
    } else if (dateTo) {
      whereConditions.punch_time = {
        lte: new Date(`${dateTo}T23:59:59.999Z`),
      };
    }

    return await this.prisma.process_att_logs.findMany({
      where: whereConditions,
      orderBy: {
        punch_time: 'desc',
      },
    });
  }

  async getAttendanceSummary(
    deviceIds?: number[],
    dateFrom?: string,
    dateTo?: string,
  ) {
    const whereConditions: any = {};

    if (deviceIds && deviceIds.length > 0) {
      whereConditions.device_id = {
        in: deviceIds,
      };
    }

      if (dateFrom && dateTo) {
      whereConditions.punch_time = {
        gte: new Date(`${dateFrom}T00:00:00.000Z`),
        lte: new Date(`${dateTo}T23:59:59.999Z`),
      };
    } else if (dateFrom) {
      whereConditions.punch_time = {
        gte: new Date(`${dateFrom}T00:00:00.000Z`),
      };
    } else if (dateTo) {
      whereConditions.punch_time = {
        lte: new Date(`${dateTo}T23:59:59.999Z`),
      };
    }

    const logs = await this.prisma.process_att_logs.findMany({
      where: whereConditions,
      select: {
        username: true,
        punch_time: true,
        device_id: true,
        device_name: true,
      },
      orderBy: {
        punch_time: 'asc',
      },
    });

    // Group by username and date
    const summary = new Map();

    logs.forEach(log => {
      if (!log.username) return;
      if (!log.punch_time) return;
      
// Since punch_time is a DateTime object, we can use toISOString
const dateKey = log.punch_time instanceof Date 
  ? log.punch_time.toISOString().split('T')[0]
  : new Date(log.punch_time).toISOString().split('T')[0];
  
  const key = `${log.username}|${dateKey}`;
      
      if (!summary.has(key)) {
        summary.set(key, {
          username: log.username,
          date: dateKey,
          punches: [],
          deviceIds: new Set(),
          deviceNames: new Set(),
        });
      }
      
      const entry = summary.get(key);
      entry.punches.push(log.punch_time);
      if (log.device_id) entry.deviceIds.add(log.device_id);
      if (log.device_name) entry.deviceNames.add(log.device_name);
    });

    // Convert to array and format
    const result = Array.from(summary.values()).map(entry => ({
      username: entry.username,
      date: entry.date,
      punchCount: entry.punches.length,
      firstPunch: entry.punches.length > 0 
        ? entry.punches.sort()[0]
        : null,
      lastPunch: entry.punches.length > 0
        ? entry.punches.sort()[entry.punches.length - 1]
        : null,
      devices: Array.from(entry.deviceIds),
      deviceNames: Array.from(entry.deviceNames),
    }));

    return result;
  }

  async update(id: number, updateProcessAttLogDto: UpdateProcessAttLogDto) {
    // Check if log exists
    await this.findOne(id);

    try {
      return await this.prisma.process_att_logs.update({
        where: { id },
        data: {
          device_sn: updateProcessAttLogDto.device_sn,
          user_id: updateProcessAttLogDto.user_id,
          username: updateProcessAttLogDto.username,
          punch_time: updateProcessAttLogDto.punch_time || undefined,
          company_name: updateProcessAttLogDto.company_name,
          branch_name: updateProcessAttLogDto.branch_name,
          department_name: updateProcessAttLogDto.department_name,
          device_emp_code: updateProcessAttLogDto.device_emp_code,
          manage_employee_id: updateProcessAttLogDto.manage_employee_id,
          device_id: updateProcessAttLogDto.device_id,
          raw_body: updateProcessAttLogDto.raw_body,
          status: updateProcessAttLogDto.status,
          device_name: updateProcessAttLogDto.device_name,
        },
      });
    } catch (error) {
      throw new BadRequestException(`Failed to update attendance log: ${(error as Error).message}`);
    }
  }

  async remove(id: number) {
    // Check if log exists
    await this.findOne(id);

    try {
      return await this.prisma.process_att_logs.delete({
        where: { id },
      });
    } catch (error) {
      throw new BadRequestException(`Failed to delete attendance log: ${(error as Error).message}`);
    }
  }

  async removeMany(ids: number[]) {
    try {
      const result = await this.prisma.process_att_logs.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });
      return {
        deletedCount: result.count,
        message: `Successfully deleted ${result.count} attendance logs`,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to delete attendance logs: ${(error as Error).message}`);
    }
  }

  async getStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);

    const [total, todayCount, deviceStats, lastWeek] = await Promise.all([
      this.prisma.process_att_logs.count(),
      this.prisma.process_att_logs.count({
        where: {
          punch_time: {
            gte: todayStart,
          },
        },
      }),
      this.prisma.process_att_logs.groupBy({
        by: ['device_id', 'device_name'],
        where: {
          device_id: {
            not: null,
          },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      }),
      this.prisma.process_att_logs.count({
        where: {
          punch_time: {
            gte: sevenDaysAgo,
          },
        },
      }),
    ]);

    return {
      total,
      todayCount,
      lastWeekCount: lastWeek,
      topDevices: deviceStats.map(device => ({
        deviceId: device.device_id,
        deviceName: device.device_name,
        count: device._count.id,
      })),
    };
  }
}