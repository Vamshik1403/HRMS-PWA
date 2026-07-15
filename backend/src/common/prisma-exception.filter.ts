import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

function fkConstraintMessage(meta: Record<string, unknown> | undefined): string {
  const field = String(meta?.field_name ?? meta?.constraint ?? '').toLowerCase();
  if (field.includes('branch')) {
    return 'Cannot delete this branch because it is linked to other records (employees, departments, policies, etc.). Remove or reassign those links first.';
  }
  if (field.includes('leavepolicy') || field.includes('leave_policy')) {
    return 'Cannot delete this leave policy because it is assigned to employees or related records. Reassign those employees first.';
  }
  if (field.includes('attendancepolicy') || field.includes('attendance_policy')) {
    return 'Cannot delete this attendance policy because it is linked to employees or other records.';
  }
  if (field.includes('department')) {
    return 'Cannot delete this department because it is linked to other records.';
  }
  if (field.includes('designation')) {
    return 'Cannot delete this designation because it is linked to other records.';
  }
  if (field.includes('company')) {
    return 'Cannot delete this company because it is linked to other records.';
  }
  if (field.includes('employee') || field.includes('manageemployee')) {
    return 'Cannot delete this employee because related records still exist.';
  }
  return 'Cannot delete this record because it is linked to other data. Remove or reassign those links first.';
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let message = 'Database operation failed';
    let status = HttpStatus.BAD_REQUEST;

    switch (exception.code) {
      case 'P2003':
        message = fkConstraintMessage(exception.meta as Record<string, unknown>);
        break;
      case 'P2014':
        message =
          'Cannot complete this action because required related records exist.';
        break;
      case 'P2002':
        message = 'A record with this information already exists.';
        status = HttpStatus.CONFLICT;
        break;
      case 'P2025':
        message = 'Record not found.';
        status = HttpStatus.NOT_FOUND;
        break;
      default:
        message = exception.message || message;
        break;
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: status === HttpStatus.CONFLICT ? 'Conflict' : 'Bad Request',
    });
  }
}
