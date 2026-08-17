import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { ApprovalRequestService } from './approval-request.service';
import { ApproveApprovalRequestDto } from './dto/approve-approval-request.dto';
import { RejectApprovalRequestDto } from './dto/reject-approval-request.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('approval-requests')
export class ApprovalRequestController {
  constructor(
    private readonly approvalRequestService:
      ApprovalRequestService,

    private readonly prisma:
      PrismaService,
  ) {}

  /**
   * Actionable approvals only.
   * A record disappears from this endpoint after this employee acts.
   */
  @Get('my-pending')
  @HttpCode(HttpStatus.OK)
  async getMyPendingApprovals(
    @Req() request: Request,
  ) {
    const actor =
      await this.resolveActor(request);

    return this.approvalRequestService
      .getMyPendingApprovals(actor);
  }

  @Get('my-pending/count')
  @HttpCode(HttpStatus.OK)
  async getMyPendingCount(
    @Req() request: Request,
  ) {
    const actor =
      await this.resolveActor(request);

    return this.approvalRequestService
      .getMyPendingCount(actor);
  }

  /**
   * Persistent assignment list.
   *
   * Once an approval request was assigned to an employee, this endpoint
   * keeps returning it after APPROVED / REJECTED / SKIPPED / CANCELLED.
   *
   * Frontends should use:
   * - my-assigned => persistent table/history visibility
   * - my-pending  => Approve/Reject buttons
   */
  @Get('my-assigned')
  @HttpCode(HttpStatus.OK)
  async getMyAssignedApprovals(
    @Req() request: Request,
  ) {
    const actor =
      await this.resolveActor(request);

    return this.approvalRequestService
      .getMyAssignedApprovals(actor);
  }

  @Get('my-history')
  @HttpCode(HttpStatus.OK)
  async getMyHistory(
    @Req() request: Request,
  ) {
    const actor =
      await this.resolveActor(request);

    return this.approvalRequestService
      .getMyHistory(actor);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseIntPipe)
    id: number,

    @Req()
    request: Request,
  ) {
    this.validateRequestID(id);

    const actor =
      await this.resolveActor(request);

    return this.approvalRequestService
      .findOneForApprover(
        id,
        actor,
      );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: ApproveApprovalRequestDto,

    @Req()
    request: Request,
  ) {
    this.validateRequestID(id);

    const actor =
      await this.resolveActor(request);

    return this.approvalRequestService.approve(
      id,
      actor,
      dto,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: RejectApprovalRequestDto,

    @Req()
    request: Request,
  ) {
    this.validateRequestID(id);

    const actor =
      await this.resolveActor(request);

    return this.approvalRequestService.reject(
      id,
      actor,
      dto,
    );
  }

  private validateRequestID(
    id: number,
  ) {
    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      throw new BadRequestException(
        'Approval request ID must be a positive integer',
      );
    }
  }

  private async resolveActor(
    request: Request,
  ) {
    const authenticatedUser =
      (request as Request & {
        user?: {
          id?: number | string;
          userId?: number | string;
          sub?: number | string;
          username?: string;
          role?: string;
        };
      }).user;

    if (!authenticatedUser) {
      throw new UnauthorizedException(
        'Authenticated user was not found',
      );
    }

    const userIDValue =
      authenticatedUser.id ??
      authenticatedUser.userId ??
      authenticatedUser.sub ??
      null;

    const userID =
      userIDValue != null &&
      Number.isInteger(
        Number(userIDValue),
      ) &&
      Number(userIDValue) > 0
        ? Number(userIDValue)
        : null;

    let username =
      authenticatedUser.username
        ?.trim() || null;

    if (
      !username &&
      userID
    ) {
      const userRecord =
        await this.prisma.user.findUnique({
          where: {
            id: userID,
          },

          select: {
            username: true,
          },
        });

      username =
        userRecord?.username?.trim() ||
        null;
    }

    if (!username) {
      throw new UnauthorizedException(
        'Authenticated username was not found',
      );
    }

    const credentials =
      await this.prisma.employeeCredentials.findFirst({
        where: {
          username,
          isActive: true,
        },

        select: {
          employeeID: true,
        },
      });

    if (!credentials) {
      throw new ForbiddenException(
        'The logged-in user is not linked to active employee credentials',
      );
    }

    const employee =
      await this.prisma.manageEmployee.findUnique({
        where: {
          id: credentials.employeeID,
        },

        select: {
          id: true,
          companyID: true,
          branchesID: true,
          lifecycleStatus: true,
          onboardingApprovalStatus: true,
        },
      });

    if (!employee) {
      throw new ForbiddenException(
        'The employee linked to this user was not found',
      );
    }

    if (
      employee.lifecycleStatus !==
      'ACTIVE'
    ) {
      throw new ForbiddenException(
        'The employee account is not active',
      );
    }

    if (
      employee.onboardingApprovalStatus !==
      'APPROVED'
    ) {
      throw new ForbiddenException(
        'The logged-in employee is not approved to perform workflow actions',
      );
    }

    return {
      userID,
      employeeID: employee.id,
      companyID:
        employee.companyID ?? null,
      branchesID:
        employee.branchesID ?? null,
      username,
    };
  }
}