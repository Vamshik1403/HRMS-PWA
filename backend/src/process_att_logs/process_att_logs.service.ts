// src/process-att-logs/process_att_logs.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProcessAttLogDto } from './dto/create-process_att_log.dto';
import { UpdateProcessAttLogDto } from './dto/update-process_att_log.dto';
import { QueryProcessAttLogDto } from './dto/query-process_att_log.dto';

@Injectable()
export class ProcessAttLogsService {
  constructor(private prisma: PrismaService) {}

  async create(createProcessAttLogDto: CreateProcessAttLogDto) {
    try {
      return await this.prisma.process_att_logs.create({
        data: {
          device_sn: createProcessAttLogDto.device_sn,
          user_id: createProcessAttLogDto.user_id,
          username: createProcessAttLogDto.username,
          punch_time: createProcessAttLogDto.punch_time ? new Date(createProcessAttLogDto.punch_time) : null,
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
      limit = 1000,
      offset = 0,
      orderBy = 'desc',
    } = query;

    const whereConditions: any = {};

    // Date range filter - with null check
    if (dateFrom && dateTo) {
      whereConditions.punch_time = {
        gte: new Date(dateFrom),
        lte: new Date(`${dateTo} 23:59:59`),
        not: null, // Exclude null values if needed
      };
    } else if (dateFrom) {
      whereConditions.punch_time = {
        gte: new Date(dateFrom),
        not: null,
      };
    } else if (dateTo) {
      whereConditions.punch_time = {
        lte: new Date(`${dateTo} 23:59:59`),
        not: null,
      };
    }

    // Device filter - single device
    if (deviceId) {
      whereConditions.device_id = deviceId;
    }

    // Device filter - multiple devices
    if (deviceIds) {
      const deviceIdArray = deviceIds.split(',').map(id => parseInt(id.trim()));
      whereConditions.device_id = {
        in: deviceIdArray,
      };
    }

    // Username filter
    if (username) {
      whereConditions.username = {
        contains: username,
        mode: 'insensitive',
      };
    }

    // Company name filter
    if (company_name) {
      whereConditions.company_name = {
        contains: company_name,
        mode: 'insensitive',
      };
    }

    // Branch name filter
    if (branch_name) {
      whereConditions.branch_name = {
        contains: branch_name,
        mode: 'insensitive',
      };
    }

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
        gte: new Date(dateFrom),
        lte: new Date(`${dateTo} 23:59:59`),
        not: null,
      };
    } else if (dateFrom) {
      whereConditions.punch_time = {
        gte: new Date(dateFrom),
        not: null,
      };
    } else if (dateTo) {
      whereConditions.punch_time = {
        lte: new Date(`${dateTo} 23:59:59`),
        not: null,
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
        gte: new Date(dateFrom),
        lte: new Date(`${dateTo} 23:59:59`),
        not: null,
      };
    } else if (dateFrom) {
      whereConditions.punch_time = {
        gte: new Date(dateFrom),
        not: null,
      };
    } else if (dateTo) {
      whereConditions.punch_time = {
        lte: new Date(`${dateTo} 23:59:59`),
        not: null,
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
        gte: new Date(dateFrom),
        lte: new Date(`${dateTo} 23:59:59`),
        not: null,
      };
    } else if (dateFrom) {
      whereConditions.punch_time = {
        gte: new Date(dateFrom),
        not: null,
      };
    } else if (dateTo) {
      whereConditions.punch_time = {
        lte: new Date(`${dateTo} 23:59:59`),
        not: null,
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
        gte: new Date(dateFrom),
        lte: new Date(`${dateTo} 23:59:59`),
        not: null,
      };
    } else if (dateFrom) {
      whereConditions.punch_time = {
        gte: new Date(dateFrom),
        not: null,
      };
    } else if (dateTo) {
      whereConditions.punch_time = {
        lte: new Date(`${dateTo} 23:59:59`),
        not: null,
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

    // Group by username and date - with null check for punch_time
    const summary = new Map();

    logs.forEach(log => {
      if (!log.username) return;
      if (!log.punch_time) return; // Skip null punch_time
      
      const dateKey = log.punch_time.toISOString().split('T')[0];
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
        ? new Date(Math.min(...entry.punches.map(p => new Date(p).getTime())))
        : null,
      lastPunch: entry.punches.length > 0
        ? new Date(Math.max(...entry.punches.map(p => new Date(p).getTime())))
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
          punch_time: updateProcessAttLogDto.punch_time ? new Date(updateProcessAttLogDto.punch_time) : null,
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
    const [total, todayCount, deviceStats, lastWeek] = await Promise.all([
      this.prisma.process_att_logs.count(),
      this.prisma.process_att_logs.count({
        where: {
          punch_time: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            not: null,
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
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
            not: null,
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