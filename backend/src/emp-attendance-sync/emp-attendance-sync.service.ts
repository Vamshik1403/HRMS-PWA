// src/emp-attendance-sync/emp-attendance-sync.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceStatus, Prisma } from '@prisma/client';

@Injectable()
export class EmpAttendanceSyncService {
  constructor(private readonly prisma: PrismaService) {}

 
  async sync(input: { take: number; dryRun: boolean }) {
    const { take, dryRun } = input;

    // Run everything atomically
    return await this.prisma.$transaction(async (tx) => {
      // 1) Fetch up to `take` unprocessed logs (across all devices)
      const logs = await tx.attendanceLogs.findMany({
        where: { processed: '0' },  // <- only not-processed
        orderBy: { id: 'asc' },
        take,
        include: {
          device: {
            select: {
              id: true,
              status: true,
              serviceProviderID: true,
              companyID: true,
              branchesID: true,
              deviceSN: true,
            },
          },
        },
      });

      if (!logs.length) {
        return {
          picked: 0,
          preMarkedProcessed: 0,
          inserted: 0,
          skippedNoDevice: 0,
          skippedInactiveDevice: 0,
          skippedNoMapping: 0,
          details: [] as any[],
        };
      }

      const pickedIds = logs.map((l) => l.id);

      // 2) Pre-mark fetched logs to '1' so they won't be re-fetched next run
      //    (Skip this in dryRun)
    // inside transaction
const successIds: number[] = [];
const insertRows: Prisma.EmpAttendanceLogsCreateManyInput[] = [];
let skippedNoDevice = 0;
let skippedInactiveDevice = 0;
let skippedNoMapping = 0;
const details: any[] = [];

for (const log of logs) {
  const dev = log.device;

  if (!dev) {
    skippedNoDevice++;
    details.push({ logId: log.id, reason: 'device_not_found' });
    continue;
  }

  if (dev.status !== DeviceStatus.Active) {
    skippedInactiveDevice++;
    details.push({ logId: log.id, reason: 'device_inactive', deviceId: dev.id });
    continue;
  }

  const mapping = await tx.empDeviceMapping.findFirst({
    where: { deviceID: dev.id, deviceEmpCode: log.userId },
    select: { manageEmployeeID: true },
  });

  if (!mapping) {
    skippedNoMapping++;
    details.push({
      logId: log.id,
      reason: 'emp_mapping_not_found',
      deviceId: dev.id,
      deviceSN: dev.deviceSN,
      userId: log.userId,
    });
    continue;
  }

  // ✅ This log is valid → queue for insertion and mark success
  insertRows.push({
    serviceProviderID: dev.serviceProviderID ?? 0,
    companyID:         dev.companyID ?? 0,
    branchesID:        dev.branchesID ?? 0,
    deviceID:          dev.id,
    employeeID:        mapping.manageEmployeeID,
    punchTimeStamp:    log.logTime,
    exported:          0,
    latitude:          null,
    longitude:         null,
    googleMapLink:     null,
    location:          null,
    mobileDeviceID:    null,
    mobileDeviceInfo:  null,
  });

  successIds.push(log.id);

  details.push({
    logId: log.id,
    queued: true,
    deviceId: dev.id,
    employeeId: mapping.manageEmployeeID,
    punchTimeStamp: log.logTime,
  });
}

// ✅ Only mark *successful* logs as processed
let preMarkedProcessed = 0;
if (!dryRun && successIds.length) {
  const upd = await tx.attendanceLogs.updateMany({
    where: { id: { in: successIds } },
    data: { processed: '1' },
  });
  preMarkedProcessed = upd.count ?? successIds.length;
}

// Insert rows (if not dryRun)
let inserted = 0;
if (!dryRun && insertRows.length) {
  const ins = await tx.empAttendanceLogs.createMany({
    data: insertRows,
  });
  inserted = ins.count ?? 0;
}

return {
  picked: logs.length,
  preMarkedProcessed,
  inserted,
  skippedNoDevice,
  skippedInactiveDevice,
  skippedNoMapping,
  details,
};

      return {
        picked: logs.length,
        preMarkedProcessed,
        inserted,
        skippedNoDevice,
        skippedInactiveDevice,
        skippedNoMapping,
        details,
      };
    });
  }
}
