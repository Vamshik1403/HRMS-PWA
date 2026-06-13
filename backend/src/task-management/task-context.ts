import { ForbiddenException } from '@nestjs/common';

export interface TaskViewerContext {
  role: string;
  userId?: number;
  employeeId?: number;
  companyID?: number;
  serviceProviderID?: number;
  isDesktopManager?: boolean;
}

export function parseViewer(query: Record<string, string | undefined>): TaskViewerContext {
  const role = (query.viewerRole || '').toUpperCase().replace(/\s+/g, '_');
  let employeeId = query.viewerEmployeeId ? Number(query.viewerEmployeeId) : undefined;
  if (!employeeId && role === 'EMPLOYEE' && query.viewerUserId) {
    employeeId = Number(query.viewerUserId);
  }
  return {
    role,
    userId: query.viewerUserId ? Number(query.viewerUserId) : undefined,
    employeeId: employeeId && !Number.isNaN(employeeId) ? employeeId : undefined,
    companyID: query.companyID ? Number(query.companyID) : undefined,
    serviceProviderID: query.serviceProviderID ? Number(query.serviceProviderID) : undefined,
    isDesktopManager: query.viewerDesktopManager === '1',
  };
}

export function canManageTaskModule(viewer: TaskViewerContext): boolean {
  if (viewer.role === 'SUPERADMIN' || viewer.role === 'COMPANY_ADMIN') return true;
  if (viewer.role === 'EMPLOYEE' && viewer.isDesktopManager) return true;
  return false;
}

export function assertCanManageTaskModule(viewer: TaskViewerContext) {
  if (!canManageTaskModule(viewer)) {
    throw new ForbiddenException('Task Management is only available to SuperAdmin and CompanyAdmin');
  }
}
