// src/emp-attendance-sync/emp-attendance-sync.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { devicePunchToStorageDate } from '../common/device-punch-time';
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
              deviceType: true,
              authTypes: true,
              deviceName: true,
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
const processAttRows: Prisma.process_att_logsCreateManyInput[] = [];
let skippedNoDevice = 0;
let skippedInactiveDevice = 0;
let skippedNoMapping = 0;
let canteenTrInserted = 0;
let canteenTvInserted = 0;
const details: any[] = [];

// Fetch canteen setup for default_token flag
const canteenSetup = await tx.canteen_setup.findFirst();
const defaultTokenEnabled = canteenSetup?.default_token_enabled ?? false;

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

  const deviceType = dev.deviceType || 'AT';
  const authType = log.authType || null;
  const deviceAuthTypes = dev.authTypes || [];

  // Parse tagged auth types (e.g. ["ATT:FACE", "TR:PIN"])
  let attendanceAuth: string | null = null;
  let tokenRegAuth: string | null = null;
  for (const at of deviceAuthTypes) {
    if (at.startsWith('ATT:')) attendanceAuth = at.replace('ATT:', '');
    else if (at.startsWith('TR:')) tokenRegAuth = at.replace('TR:', '');
  }

  // Auth-type routing for AT+TR combo devices with tagged auth types
  const useTaggedRouting = deviceType === 'AT+TR' && attendanceAuth && tokenRegAuth && authType;

  if (deviceType === 'TV') {
    // Token Verifier → canteen_tv_logs (use TokenDeviceMapping)
    const tokenMapping = await tx.tokenDeviceMapping.findFirst({
      where: { deviceID: dev.id, deviceEmpCode: log.userId },
      select: { manageEmployeeID: true },
    });
    if (!tokenMapping) {
      skippedNoMapping++;
      details.push({ logId: log.id, reason: 'token_mapping_not_found', deviceId: dev.id, userId: log.userId });
      continue;
    }
    const emp = await tx.manageEmployee.findUnique({
      where: { id: tokenMapping.manageEmployeeID! },
      select: { employeeFirstName: true, employeeLastName: true },
    });
    const username = `${emp?.employeeFirstName || ''} ${emp?.employeeLastName || ''}`.trim();
    if (!dryRun) {
      await tx.canteen_tv_logs.create({
        data: {
          device_sn: dev.deviceSN,
          user_id: log.userId,
          username,
          punch_time: log.logTime ? new Date(log.logTime) : null,
          manage_employee_id: tokenMapping.manageEmployeeID,
          device_id: dev.id,
          default_token: defaultTokenEnabled,
          auth_type: authType,
        },
      });
      canteenTvInserted++;
    }
    successIds.push(log.id);
    details.push({ logId: log.id, queued: true, route: 'canteen_tv', deviceId: dev.id, employeeId: tokenMapping.manageEmployeeID });
    continue;
  }

  if (deviceType === 'TR' || (useTaggedRouting && authType === tokenRegAuth)) {
    // Token Register / Canteen action
    // Use TokenDeviceMapping for dedicated TR devices, EmpDeviceMapping for auth-type routed
    let empId: number | null = null;
    if (deviceType === 'TR') {
      const tokenMapping = await tx.tokenDeviceMapping.findFirst({
        where: { deviceID: dev.id, deviceEmpCode: log.userId },
        select: { manageEmployeeID: true },
      });
      empId = tokenMapping?.manageEmployeeID ?? null;
    } else {
      // Auth-type routing on AT device: use EmpDeviceMapping
      const empMapping = await tx.empDeviceMapping.findFirst({
        where: { deviceID: dev.id, deviceEmpCode: log.userId },
        select: { manageEmployeeID: true },
      });
      empId = empMapping?.manageEmployeeID ?? null;
    }

    if (!empId) {
      skippedNoMapping++;
      details.push({ logId: log.id, reason: 'mapping_not_found_for_canteen', deviceId: dev.id, userId: log.userId });
      continue;
    }

    const emp = await tx.manageEmployee.findUnique({
      where: { id: empId },
      select: { employeeFirstName: true, employeeLastName: true },
    });
    const username = `${emp?.employeeFirstName || ''} ${emp?.employeeLastName || ''}`.trim();

    if (!dryRun) {
      await tx.canteen_tr_logs.create({
        data: {
          device_sn: dev.deviceSN,
          user_id: log.userId,
          username,
          punch_time: log.logTime ? new Date(log.logTime) : null,
          manage_employee_id: empId,
          device_id: dev.id,
          default_token: defaultTokenEnabled,
          auth_type: authType,
        },
      });
      canteenTrInserted++;
    }
    successIds.push(log.id);
    details.push({ logId: log.id, queued: true, route: 'canteen_tr', deviceId: dev.id, employeeId: empId });
    continue;
  }

  // Default: Attendance (AT device with FACE auth, or AT device without auth-type routing)
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

  // Fetch employee details for process_att_logs
  const emp = await tx.manageEmployee.findUnique({
    where: { id: mapping.manageEmployeeID! },
    select: {
      employeeFirstName: true,
      employeeLastName: true,
      company: { select: { companyName: true } },
      branches: { select: { branchName: true } },
      departments: { select: { departmentName: true } },
    },
  });
  const username = `${emp?.employeeFirstName || ''} ${emp?.employeeLastName || ''}`.trim();

  // ✅ This log is valid → queue for EmpAttendanceLogs insertion
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

  // ✅ Also queue for process_att_logs (used by Dashboard present & Canteen check-in)
  processAttRows.push({
    device_sn:          dev.deviceSN,
    user_id:            log.userId,
    username,
    punch_time:         log.logTime ? devicePunchToStorageDate(log.logTime) : null,
    company_name:       emp?.company?.companyName ?? null,
    branch_name:        emp?.branches?.branchName ?? null,
    department_name:    emp?.departments?.departmentName ?? null,
    device_emp_code:    log.userId,
    manage_employee_id: mapping.manageEmployeeID,
    device_id:          dev.id,
    device_name:        dev.deviceName,
    device_type:        deviceType,
    auth_type:          authType,
    raw_body:           log.rawData,
    status:             '0',
  });

  successIds.push(log.id);

  details.push({
    logId: log.id,
    queued: true,
    route: 'attendance',
    deviceId: dev.id,
    employeeId: mapping.manageEmployeeID,
    punchTimeStamp: log.logTime,
    authType,
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

// Insert attendance rows (if not dryRun)
let inserted = 0;
let processAttInserted = 0;
if (!dryRun && insertRows.length) {
  const ins = await tx.empAttendanceLogs.createMany({
    data: insertRows,
  });
  inserted = ins.count ?? 0;
}

// Insert process_att_logs rows for dashboard & canteen check-in (if not dryRun)
if (!dryRun && processAttRows.length) {
  const pIns = await tx.process_att_logs.createMany({
    data: processAttRows,
  });
  processAttInserted = pIns.count ?? 0;
}

return {
  picked: logs.length,
  preMarkedProcessed,
  inserted,
  processAttInserted,
  canteenTrInserted,
  canteenTvInserted,
  skippedNoDevice,
  skippedInactiveDevice,
  skippedNoMapping,
  details,
};

    });
  }
}
