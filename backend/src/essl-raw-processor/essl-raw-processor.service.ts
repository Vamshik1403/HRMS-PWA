import { Injectable, Logger } from '@nestjs/common';
import { DeviceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { devicePunchToStorageDate } from '../common/device-punch-time';

type DeviceInfo = {
  id: number;
  deviceSN: string;
  deviceName: string | null;
  deviceType: string | null;
  authTypes: string[];
};

type EmpMapping = {
  manageEmployeeID: number;
  username: string;
  companyName: string | null;
  branchName: string | null;
  departmentName: string | null;
  deviceID: number;
  mobileAttendanceEnabled: boolean;
};

type TokenMapping = {
  manageEmployeeID: number;
  username: string;
  deviceID: number;
};

function parseAuthTypeFromRawBody(rawBody: string | null | undefined): string | null {
  if (!rawBody?.trim()) return null;
  const parts = rawBody.trim().split(/\s+/);
  if (parts.length < 5) return null;
  switch (parts[4]) {
    case '0':
    case '3':
      return 'PIN';
    case '1':
      return 'FINGER';
    case '2':
    case '4':
      return 'CARD';
    case '15':
      return 'FACE';
    default:
      return null;
  }
}

function empCodeVariants(code: string): string[] {
  const c = String(code).trim();
  const stripped = c.replace(/^0+/, '') || '0';
  return stripped === c ? [c] : [c, stripped];
}

function mappingKeys(deviceSN: string, code: string): string[] {
  return empCodeVariants(code).map((v) => `${deviceSN}:${v}`);
}

@Injectable()
export class EsslRawProcessorService {
  private readonly logger = new Logger(EsslRawProcessorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Move verified, unexported essl_raw_attlog rows into process_att_logs (and canteen tables when applicable).
   * This replaces the manual script: frontend/scripts/process-att-logs.ts
   */
  async processPending(input?: { take?: number; rawLogIds?: number[] }) {
    const take = Math.min(Math.max(input?.take ?? 500, 1), 5000);

    const where: Prisma.essl_raw_attlogWhereInput = {
      user_id: { not: null },
      NOT: { user_id: '' },
      OR: [{ export: null }, { export: 0 }],
      log_type: 'verified',
    };

    if (input?.rawLogIds?.length) {
      where.id = { in: input.rawLogIds };
    }

    const rawLogs = await this.prisma.essl_raw_attlog.findMany({
      where,
      orderBy: { id: 'asc' },
      take,
    });

    if (!rawLogs.length) {
      return {
        ok: true,
        picked: 0,
        processAttInserted: 0,
        canteenTrInserted: 0,
        canteenTvInserted: 0,
        markedExported: 0,
        skippedNoDevice: 0,
        skippedNoMapping: 0,
      };
    }

    const devices = await this.prisma.devices.findMany({
      where: { status: DeviceStatus.Active },
      select: {
        id: true,
        deviceSN: true,
        deviceName: true,
        deviceType: true,
        authTypes: true,
      },
    });

    const deviceBySn = new Map<string, DeviceInfo>();
    for (const d of devices) {
      deviceBySn.set(d.deviceSN, {
        id: d.id,
        deviceSN: d.deviceSN,
        deviceName: d.deviceName,
        deviceType: d.deviceType || 'AT',
        authTypes: d.authTypes || [],
      });
    }

    const empRows = await this.prisma.empDeviceMapping.findMany({
      where: { deviceEmpCode: { not: null } },
      include: {
        device: { select: { id: true, deviceSN: true, deviceName: true, deviceType: true } },
        manageEmployee: {
          select: {
            id: true,
            employeeFirstName: true,
            employeeLastName: true,
            mobileAttendanceEnabled: true,
            company: { select: { companyName: true } },
            branches: { select: { branchName: true } },
            departments: { select: { departmentName: true } },
          },
        },
      },
    });

    const empMap = new Map<string, EmpMapping>();
    for (const row of empRows) {
      if (!row.device?.deviceSN || !row.deviceEmpCode || !row.manageEmployee) continue;
      const username =
        `${row.manageEmployee.employeeFirstName || ''} ${row.manageEmployee.employeeLastName || ''}`.trim() ||
        `Employee ${row.deviceEmpCode}`;
      const info: EmpMapping = {
        manageEmployeeID: row.manageEmployee.id,
        username,
        companyName: row.manageEmployee.company?.companyName ?? null,
        branchName: row.manageEmployee.branches?.branchName ?? null,
        departmentName: row.manageEmployee.departments?.departmentName ?? null,
        deviceID: row.device.id,
        mobileAttendanceEnabled: !!row.manageEmployee.mobileAttendanceEnabled,
      };
      for (const key of mappingKeys(row.device.deviceSN, row.deviceEmpCode)) {
        empMap.set(key, info);
      }
    }

    const tokenRows = await this.prisma.tokenDeviceMapping.findMany({
      where: { deviceEmpCode: { not: null } },
      include: {
        device: { select: { id: true, deviceSN: true, deviceType: true } },
        manageEmployee: {
          select: { id: true, employeeFirstName: true, employeeLastName: true },
        },
      },
    });

    const tokenMap = new Map<string, TokenMapping>();
    for (const row of tokenRows) {
      if (!row.device?.deviceSN || !row.deviceEmpCode || !row.manageEmployee) continue;
      const username =
        `${row.manageEmployee.employeeFirstName || ''} ${row.manageEmployee.employeeLastName || ''}`.trim() ||
        `Employee ${row.deviceEmpCode}`;
      const info: TokenMapping = {
        manageEmployeeID: row.manageEmployee.id,
        username,
        deviceID: row.device.id,
      };
      for (const key of mappingKeys(row.device.deviceSN, row.deviceEmpCode)) {
        tokenMap.set(key, info);
      }
    }

    const canteenSetup = await this.prisma.canteen_setup.findFirst();
    const defaultTokenEnabled = canteenSetup?.default_token_enabled ?? false;

    const processAttRows: Prisma.process_att_logsCreateManyInput[] = [];
    const exportedIds: number[] = [];
    let skippedNoDevice = 0;
    let skippedNoMapping = 0;

    const resolveEmp = (deviceSN: string, userId: string) => {
      for (const key of mappingKeys(deviceSN, userId)) {
        const hit = empMap.get(key);
        if (hit) return hit;
      }
      return null;
    };

    const resolveToken = (deviceSN: string, userId: string) => {
      for (const key of mappingKeys(deviceSN, userId)) {
        const hit = tokenMap.get(key);
        if (hit) return hit;
      }
      return null;
    };

    for (const log of rawLogs) {
      const userId = (log.user_id || '').trim();
      const deviceSN = log.device_sn;
      const deviceInfo = deviceBySn.get(deviceSN);

      if (!deviceInfo || !userId) {
        skippedNoDevice++;
        continue;
      }

      const deviceType = deviceInfo.deviceType || 'AT';
      const authType = log.auth_type || parseAuthTypeFromRawBody(log.raw_body);
      const punchTime =
        devicePunchToStorageDate(log.punch_time) ??
        devicePunchToStorageDate(log.raw_body?.split(/\s+/).slice(1, 3).join(' '));

      let attendanceAuth: string | null = null;
      let tokenRegAuth: string | null = null;
      for (const at of deviceInfo.authTypes) {
        if (at.startsWith('ATT:')) attendanceAuth = at.replace('ATT:', '');
        else if (at.startsWith('TR:')) tokenRegAuth = at.replace('TR:', '');
      }
      const useTaggedRouting =
        deviceType === 'AT+TR' && !!attendanceAuth && !!tokenRegAuth && !!authType;

      if (deviceType === 'TV') {
        const tokenInfo = resolveToken(deviceSN, userId);
        if (!tokenInfo) {
          skippedNoMapping++;
          continue;
        }
        await this.prisma.canteen_tv_logs.create({
          data: {
            device_sn: deviceSN,
            user_id: userId,
            username: tokenInfo.username,
            punch_time: punchTime,
            manage_employee_id: tokenInfo.manageEmployeeID,
            device_id: tokenInfo.deviceID,
            default_token: defaultTokenEnabled,
            auth_type: authType,
          },
        });
        exportedIds.push(log.id);
        continue;
      }

      if (deviceType === 'TR' || (useTaggedRouting && authType === tokenRegAuth)) {
        const canteenEmp =
          deviceType === 'TR' ? resolveToken(deviceSN, userId) : resolveEmp(deviceSN, userId);
        if (!canteenEmp) {
          skippedNoMapping++;
          continue;
        }
        await this.prisma.canteen_tr_logs.create({
          data: {
            device_sn: deviceSN,
            user_id: userId,
            username: canteenEmp.username,
            punch_time: punchTime,
            manage_employee_id: canteenEmp.manageEmployeeID,
            device_id: canteenEmp.deviceID,
            default_token: defaultTokenEnabled,
            auth_type: authType,
          },
        });
        exportedIds.push(log.id);
        continue;
      }

      const empInfo = resolveEmp(deviceSN, userId);
      if (!empInfo) {
        skippedNoMapping++;
        this.logger.warn(
          `No EmpDeviceMapping for deviceSN=${deviceSN} deviceEmpCode=${userId} (raw log id=${log.id})`,
        );
        continue;
      }

      // Mobile-attendance employees punch only via the PWA. Mark the raw row as
      // processed (archived) but do not mirror device punches into the
      // attendance source of truth.
      if (empInfo.mobileAttendanceEnabled) {
        exportedIds.push(log.id);
        continue;
      }

      processAttRows.push({
        device_sn: deviceSN,
        user_id: userId,
        username: empInfo.username,
        punch_time: punchTime,
        company_name: empInfo.companyName,
        branch_name: empInfo.branchName,
        department_name: empInfo.departmentName,
        device_emp_code: userId,
        manage_employee_id: empInfo.manageEmployeeID,
        device_id: empInfo.deviceID,
        device_name: deviceInfo.deviceName,
        device_type: deviceType,
        auth_type: authType,
        raw_body: log.raw_body,
        status: '0',
      });
      exportedIds.push(log.id);
    }

    let processAttInserted = 0;
    if (processAttRows.length) {
      const ins = await this.prisma.process_att_logs.createMany({ data: processAttRows });
      processAttInserted = ins.count ?? processAttRows.length;
    }

    let markedExported = 0;
    if (exportedIds.length) {
      const upd = await this.prisma.essl_raw_attlog.updateMany({
        where: { id: { in: exportedIds } },
        data: { export: 1 },
      });
      markedExported = upd.count ?? exportedIds.length;
    }

    return {
      ok: true,
      picked: rawLogs.length,
      processAttInserted,
      markedExported,
      skippedNoDevice,
      skippedNoMapping,
    };
  }
}
