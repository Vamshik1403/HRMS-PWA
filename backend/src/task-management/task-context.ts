import { ForbiddenException } from '@nestjs/common';

export interface TaskViewerContext {
  role: string;
  userId?: number;
  employeeId?: number;
  companyID?: number;
  serviceProviderID?: number;
}

export function parseViewer(query: Record<string, string | undefined>): TaskViewerContext {
  const role = (query.viewerRole || '').toUpperCase().replace(/\s+/g, '_');
  const employeeId = query.viewerEmployeeId
    ? Number(query.viewerEmployeeId)
    : role === 'EMPLOYEE' && query.viewerUserId
      ? Number(query.viewerUserId)
      : undefined;
  return {
    role,
    userId: query.viewerUserId ? Number(query.viewerUserId) : undefined,
    employeeId,
    companyID: query.companyID ? Number(query.companyID) : undefined,
    serviceProviderID: query.serviceProviderID ? Number(query.serviceProviderID) : undefined,
  };
}

export function canManageTaskModule(viewer: TaskViewerContext): boolean {
  return viewer.role === 'SUPERADMIN' || viewer.role === 'COMPANY_ADMIN';
}

export function assertCanManageTaskModule(viewer: TaskViewerContext) {
  if (!canManageTaskModule(viewer)) {
    throw new ForbiddenException('Task Management is only available to SuperAdmin and CompanyAdmin');
  }
}
