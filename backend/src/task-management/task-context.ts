import { ForbiddenException } from '@nestjs/common';

export interface TaskViewerContext {
  role: string;
  userId?: number;
  employeeId?: number;
  companyID?: number;
  branchesID?:number;
  serviceProviderID?: number;
  isDesktopManager?: boolean;
  isCompanyOwner?: boolean;
  canManageTasks?: boolean;
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
    isCompanyOwner: query.viewerCompanyOwner === '1',
    canManageTasks: query.viewerManageTasks === '1',
  };
}

const TASK_MANAGER_ROLES = new Set([
  'SUPERADMIN',
  'COMPANY_ADMIN',
  'ADMIN',
  'SERVICE_PROVIDER',
  'BRANCH_ADMIN',
]);

export function canManageTaskModule(viewer: TaskViewerContext): boolean {
  if (TASK_MANAGER_ROLES.has(viewer.role)) return true;
  if (viewer.role === 'EMPLOYEE' && viewer.isDesktopManager) return true;
  if (viewer.isCompanyOwner || viewer.canManageTasks) return true;
  return false;
}

export function assertCanManageTaskModule(viewer: TaskViewerContext) {
  // if (!canManageTaskModule(viewer)) {
  //   throw new ForbiddenException('Task Management is only available to SuperAdmin and CompanyAdmin');
  // }
}
