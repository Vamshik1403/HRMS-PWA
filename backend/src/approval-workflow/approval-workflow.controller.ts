import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { CreateApprovalWorkflowDto } from './dto/create-approval-workflow.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflow.dto';
import { UpdateWorkflowStatusDto } from './dto/update-workflow-status.dto';

@Controller('approval-workflows')
export class ApprovalWorkflowController {
  constructor(
    private readonly approvalWorkflowService:
      ApprovalWorkflowService,
  ) {}

  private parseOptionalPositiveInt(
    value: string | undefined,
    fieldName: string,
  ): number | undefined {
    if (
      value === undefined ||
      value === null ||
      value.trim() === ''
    ) {
      return undefined;
    }

    const parsedValue = Number(value);

    if (
      !Number.isInteger(parsedValue) ||
      parsedValue <= 0
    ) {
      throw new BadRequestException(
        `${fieldName} must be a positive integer`,
      );
    }

    return parsedValue;
  }

  private parseOptionalDate(
    value: string | undefined,
    fieldName: string,
  ): Date | undefined {
    if (
      value === undefined ||
      value === null ||
      value.trim() === ''
    ) {
      return undefined;
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(
        `${fieldName} must be a valid ISO date`,
      );
    }

    return parsedDate;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body()
    dto: CreateApprovalWorkflowDto,
  ) {
    return this.approvalWorkflowService.create(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @Query('companyID')
    companyID?: string,

    @Query('branchesID')
    branchesID?: string,

    @Query('companyModuleID')
    companyModuleID?: string,

    @Query(
      'workflowStatus',
      new ParseBoolPipe({
        optional: true,
      }),
    )
    workflowStatus?: boolean,

    @Query('search')
    search?: string,
  ) {
    const parsedCompanyID =
      this.parseOptionalPositiveInt(
        companyID,
        'companyID',
      );

    const parsedBranchesID =
      this.parseOptionalPositiveInt(
        branchesID,
        'branchesID',
      );

    const parsedCompanyModuleID =
      this.parseOptionalPositiveInt(
        companyModuleID,
        'companyModuleID',
      );

    return this.approvalWorkflowService.findAll({
      companyID: parsedCompanyID,
      branchesID: parsedBranchesID,
      companyModuleID:
        parsedCompanyModuleID,
      workflowStatus,
      search: search?.trim() || undefined,
    });
  }

  /*
   * Keep this route above @Get(':id').
   * Otherwise NestJS may treat "resolve" as an ID.
   */
  @Get('resolve')
  @HttpCode(HttpStatus.OK)
  resolveWorkflow(
    @Query(
      'companyID',
      ParseIntPipe,
    )
    companyID: number,

    @Query(
      'companyModuleID',
      ParseIntPipe,
    )
    companyModuleID: number,

    @Query('branchesID')
    branchesID?: string,

    @Query('effectiveAt')
    effectiveAt?: string,
  ) {
    if (companyID <= 0) {
      throw new BadRequestException(
        'companyID must be a positive integer',
      );
    }

    if (companyModuleID <= 0) {
      throw new BadRequestException(
        'companyModuleID must be a positive integer',
      );
    }

    const parsedBranchesID =
      this.parseOptionalPositiveInt(
        branchesID,
        'branchesID',
      );

    const parsedEffectiveAt =
      this.parseOptionalDate(
        effectiveAt,
        'effectiveAt',
      );

    return this.approvalWorkflowService.resolveWorkflow({
      companyID,
      companyModuleID,
      branchesID: parsedBranchesID,
      effectiveAt: parsedEffectiveAt,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    if (id <= 0) {
      throw new BadRequestException(
        'Workflow ID must be a positive integer',
      );
    }

    return this.approvalWorkflowService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: UpdateApprovalWorkflowDto,
  ) {
    if (id <= 0) {
      throw new BadRequestException(
        'Workflow ID must be a positive integer',
      );
    }

    return this.approvalWorkflowService.update(
      id,
      dto,
    );
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: UpdateWorkflowStatusDto,
  ) {
    if (id <= 0) {
      throw new BadRequestException(
        'Workflow ID must be a positive integer',
      );
    }

    return this.approvalWorkflowService.updateStatus(
      id,
      dto.workflowStatus,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    if (id <= 0) {
      throw new BadRequestException(
        'Workflow ID must be a positive integer',
      );
    }

    return this.approvalWorkflowService.remove(id);
  }
}