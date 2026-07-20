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
} from '@nestjs/common';

import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';
import { ApprovalRequestService } from './approval-request.service';
import { ApproveApprovalRequestDto } from './dto/approve-approval-request.dto';
import { RejectApprovalRequestDto } from './dto/reject-approval-request.dto';

@Controller('approval-requests')
export class ApprovalRequestController {
  constructor(
    private readonly approvalRequestService:
      ApprovalRequestService,

    private readonly prisma: PrismaService,
  ) {}

  /**
   * This route must remain above @Get(':id').
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

  /**
   * This route must remain above @Get(':id').
   */
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
   * This route must remain above @Get(':id').
   */
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

  /**
   * Resolves the authenticated User account to its
   * linked ManageEmployee record.
   *
   * The JWT authentication guard should already populate
   * request.user.
   */
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

    /*
     * When the JWT contains only the User ID,
     * load the username from User.
     */
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

    /*
     * Avoid relying on the EmployeeCredentials relation name.
     * First find employeeID from credentials, then load employee.
     */
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

    /*
     * Approvers should normally already be approved employees.
     */
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