import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalRequirement,
  Prisma,
  WorkflowApproverType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApprovalWorkflowDto } from './dto/create-approval-workflow.dto';
import { UpdateApprovalWorkflowDto } from './dto/update-approval-workflow.dto';
import { WORKFLOW_CONDITION_CONFIG, CONDITION_OPERATOR_CONFIG } from './workflow-condition.config';

@Injectable()
export class ApprovalWorkflowService {
  constructor(private readonly prisma: PrismaService) { }

  private validateSteps(
    steps: Array<{
  stepNo: number;
  designationID?: number | null;
  approverType?: string | null;
  approvalRequirement?: string | null;
}>,
  ) {
    if (!steps?.length) {
      throw new BadRequestException(
        'At least one approval workflow step is required',
      );
    }

    const stepNumbers = steps.map((step) => Number(step.stepNo));

    const uniqueStepNumbers = new Set(stepNumbers);

    if (uniqueStepNumbers.size !== stepNumbers.length) {
      throw new BadRequestException(
        'Duplicate step numbers are not allowed',
      );
    }

    const sortedStepNumbers = [...stepNumbers].sort((a, b) => a - b);

    sortedStepNumbers.forEach((stepNo, index) => {
      const expectedStepNo = index + 1;

      if (stepNo !== expectedStepNo) {
        throw new BadRequestException(
          `Workflow steps must be sequential. Expected step ${expectedStepNo}, received step ${stepNo}`,
        );
      }
    });

    for (const step of steps) {
  const approverType =
    String(
      step.approverType ??
      'DESIGNATION',
    ).toUpperCase();

  if (
    ![
      'DESIGNATION',
      'REPORTING_MANAGER',
    ].includes(approverType)
  ) {
    throw new BadRequestException(
      `Invalid approver type for step ${step.stepNo}`,
    );
  }

  const approvalRequirement =
    String(
      step.approvalRequirement ??
      'ANY',
    ).toUpperCase();

  if (
    ![
      'ANY',
      'ALL',
    ].includes(approvalRequirement)
  ) {
    throw new BadRequestException(
      `Invalid approval requirement for step ${step.stepNo}`,
    );
  }

  if (
    approverType ===
    'DESIGNATION'
  ) {
    if (
      !Number.isInteger(
        step.designationID,
      ) ||
      !step.designationID ||
      step.designationID <= 0
    ) {
      throw new BadRequestException(
        `Invalid designation for step ${step.stepNo}`,
      );
    }
  }
}

  }

  private async validateReferences(params: {
    companyID: number;
    branchesID?: number | null;
    companyModuleID: number;
    steps: Array<{
      stepNo: number;
      designationID?: number | null;
      approverType?: string | null;
      approvalRequirement?: string | null;
    }>;
  }) {
    const {
      companyID,
      branchesID,
      companyModuleID,
      steps,
    } = params;

    const company = await this.prisma.company.findUnique({
      where: { id: companyID },
      select: {
        id: true,
        serviceProviderID: true,
      },
    });

    if (!company) {
      throw new BadRequestException(
        `Company with ID ${companyID} was not found`,
      );
    }

    if (branchesID) {
      const branch = await this.prisma.branches.findFirst({
        where: {
          id: branchesID,
          companyID,
        },
        select: {
          id: true,
        },
      });

      if (!branch) {
        throw new BadRequestException(
          'Selected branch does not belong to the selected company',
        );
      }
    }

    const companyModule =
      await this.prisma.companyModules.findUnique({
        where: {
          id: companyModuleID,
        },
      });

    if (!companyModule) {
      throw new BadRequestException(
        `Company module with ID ${companyModuleID} was not found`,
      );
    }

    if (companyModule.moduleStatus === false) {
      throw new BadRequestException(
        `The selected module "${companyModule.moduleName}" is inactive`,
      );
    }

    const designationIDs = [
      ...new Set(
        steps
          .map((step) => step.designationID)
          .filter((id): id is number => Number.isInteger(id) && Number(id) > 0)
          .map((id) => Number(id)),
      ),
    ];

    if (designationIDs.length) {
    const designations =
      await this.prisma.designations.findMany({
        where: {
          id: {
            in: designationIDs,
          },
        },
        select: {
          id: true,
          branchesID: true,
        },
      });

    if (designations.length !== designationIDs.length) {
      const existingIDs = new Set(
        designations.map((designation) => designation.id),
      );

      const missingIDs = designationIDs.filter(
        (id) => !existingIDs.has(id),
      );

      throw new BadRequestException(
        `Invalid designation IDs: ${missingIDs.join(', ')}`,
      );
    }

    /*
     * When the workflow is branch-specific, every selected designation
     * should normally belong to that branch.
     */
    if (branchesID) {
      const invalidDesignations = designations.filter(
        (designation) =>
          designation.branchesID != null &&
          Number(designation.branchesID) !== Number(branchesID),
      );

      if (invalidDesignations.length) {
        throw new BadRequestException(
          `One or more approval designations do not belong to branch ${branchesID}`,
        );
      }
    }
    } // end if (designationIDs.length)

    return {
      company,
      companyModule,
    };
  }


  private async validateConditionalWorkflowRequirement(
    params: {
      companyModuleID: number;
      workflowStatus: boolean;
      conditions: any[];
    },
  ) {
    const module =
      await this.prisma.companyModules.findUnique({
        where: {
          id: params.companyModuleID,
        },

        select: {
          moduleKey: true,
          moduleName: true,
        },
      });

    if (!module) {
      throw new BadRequestException(
        'Selected company module was not found',
      );
    }

    const moduleKey =
      module.moduleKey
        ?.trim()
        .toUpperCase();

    /*
     * Employee onboarding approval is conditional.
     * Without a condition, employee creation should
     * remain direct approval.
     */
    if (
      moduleKey ===
      'EMPLOYEE_ONBOARDING_MODULE' &&
      params.workflowStatus &&
      params.conditions.length === 0
    ) {
      throw new BadRequestException(
        'Employee Onboarding workflow requires at least one condition. Employees not matching any condition will be approved automatically.',
      );
    }
  }

  async create(dto: CreateApprovalWorkflowDto) {
    this.validateSteps(dto.steps);

    await this.validateReferences({
      companyID: dto.companyID,
      branchesID: dto.branchesID,
      companyModuleID: dto.companyModuleID,
      steps: dto.steps,
    });

    await this.validateConditions({
      companyID: dto.companyID,
      branchesID: dto.branchesID,
      companyModuleID: dto.companyModuleID,
      conditions: dto.conditions,
    });



    const workflowName = dto.workflowName.trim();

    const duplicate =
      await this.prisma.approvalWorkflow.findFirst({
        where: {
          companyID: dto.companyID,
          branchesID: dto.branchesID ?? null,
          companyModuleID: dto.companyModuleID,
          workflowName: {
            equals: workflowName,
            mode: 'insensitive',
          },
        },
      });

    if (duplicate) {
      throw new ConflictException(
        'A workflow with this name already exists for the selected company, branch and module',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.approvalWorkflow.create({
        data: {
          serviceProviderID:
            dto.serviceProviderID ?? null,

          companyID: dto.companyID,
          branchesID: dto.branchesID ?? null,
          companyModuleID: dto.companyModuleID,

          workflowName,

          workflowDescription:
            dto.workflowDescription?.trim() || null,

          effectiveFrom:
            new Date(dto.effectiveFrom),

          conditionMatchType:
            dto.conditionMatchType ?? 'ALL',

          allowAnySameDesignation:
            dto.allowAnySameDesignation ?? false,

          workflowStatus:
            dto.workflowStatus ?? true,

          createdByUserID:
            dto.createdByUserID ?? null,

          steps: {
            create: [...dto.steps]
              .sort((a, b) => a.stepNo - b.stepNo)
              .map((step) => ({
                stepNo: step.stepNo,
                approverType:
                  String(step.approverType ?? WorkflowApproverType.DESIGNATION)
                    .trim()
                    .toUpperCase() as WorkflowApproverType,
                approvalRequirement:
                  String(step.approvalRequirement ?? ApprovalRequirement.ANY)
                    .trim()
                    .toUpperCase() as ApprovalRequirement,
                designationID:
                  String(step.approverType ?? WorkflowApproverType.DESIGNATION)
                    .trim()
                    .toUpperCase() === WorkflowApproverType.REPORTING_MANAGER
                    ? null
                    : step.designationID ?? null,
                stepName:
                  step.stepName?.trim() || null,
                isMandatory:
                  step.isMandatory ?? true,
                canReject:
                  step.canReject ?? true,
                canSendBack:
                  step.canSendBack ?? false,
                approvalTimeout:
                  step.approvalTimeout ?? null,
              })),
          },

          ...(dto.conditions?.length && {
            conditions: {
              create: [...dto.conditions]
                .sort(
                  (a, b) =>
                    a.conditionNo - b.conditionNo,
                )
                .map((condition) => ({
                  conditionNo:
                    condition.conditionNo,

                  fieldKey:
                    condition.fieldKey,

                  operator:
                    condition.operator,

                  valueType:
                    condition.valueType,

                  departmentID:
                    condition.departmentID ?? null,

                  designationID:
                    condition.designationID ?? null,

                  branchesID:
                    condition.branchesID ?? null,

                  numberValue:
                    condition.numberValue ?? null,

                  numberValueTo:
                    condition.numberValueTo ?? null,

                  textValue:
                    condition.textValue?.trim() ||
                    null,

                  booleanValue:
                    condition.booleanValue ?? null,

                  dateValue:
                    condition.dateValue
                      ? new Date(
                        condition.dateValue,
                      )
                      : null,

                  dateValueTo:
                    condition.dateValueTo
                      ? new Date(
                        condition.dateValueTo,
                      )
                      : null,

                  ...(condition.employeeIDs?.length && {
                    employees: {
                      create:
                        condition.employeeIDs.map(
                          (manageEmployeeID) => ({
                            manageEmployeeID,
                          }),
                        ),
                    },
                  }),
                })),
            },
          }),
        },

        include: this.workflowInclude(),
      });
    });
  }


  private validateConditionValueType(
    condition: any,
  ) {
    const expectedValueTypes:
      Record<string, string> = {
      BRANCH: 'BRANCH',
      DEPARTMENT: 'DEPARTMENT',
      DESIGNATION: 'DESIGNATION',
      EMPLOYEE: 'EMPLOYEE_LIST',

      TOTAL_AMOUNT: 'NUMBER',
      SALARY_AMOUNT: 'NUMBER',
      LEAVE_DAYS: 'NUMBER',
      REGULARISATION_DAYS:
        'NUMBER',

      LEAVE_TYPE: 'TEXT',
      EXIT_TYPE: 'TEXT',
      REGULARISATION_TYPE:
        'TEXT',
      REQUEST_TEXT: 'TEXT',
    };

    const expectedValueType =
      expectedValueTypes[
      condition.fieldKey
      ];

    if (!expectedValueType) {
      throw new BadRequestException(
        `Unsupported condition field ${condition.fieldKey}`,
      );
    }

    if (
      condition.valueType !==
      expectedValueType
    ) {
      throw new BadRequestException(
        `Condition ${condition.conditionNo} must use valueType ${expectedValueType} for field ${condition.fieldKey}`,
      );
    }
  }

  private validateConditionPayloadShape(
    condition: any,
  ) {
    const hasBranch =
      condition.branchesID != null;

    const hasDepartment =
      condition.departmentID != null;

    const hasDesignation =
      condition.designationID != null;

    const hasEmployees =
      Array.isArray(condition.employeeIDs) &&
      condition.employeeIDs.length > 0;

    const hasNumber =
      condition.numberValue != null;

    const hasNumberTo =
      condition.numberValueTo != null;

    const hasText =
      typeof condition.textValue ===
      'string' &&
      condition.textValue.trim() !== '';

    switch (condition.fieldKey) {
      case 'BRANCH':
        if (
          !hasBranch ||
          hasDepartment ||
          hasDesignation ||
          hasEmployees ||
          hasNumber ||
          hasNumberTo ||
          hasText
        ) {
          throw new BadRequestException(
            `Condition ${condition.conditionNo} contains invalid values for BRANCH`,
          );
        }
        break;

      case 'DEPARTMENT':
        if (
          !hasDepartment ||
          hasDesignation ||
          hasEmployees ||
          hasNumber ||
          hasNumberTo ||
          hasText
        ) {
          throw new BadRequestException(
            `Condition ${condition.conditionNo} contains invalid values for DEPARTMENT`,
          );
        }
        break;

      case 'DESIGNATION':
        if (
          !hasDesignation ||
          hasDepartment ||
          hasEmployees ||
          hasNumber ||
          hasNumberTo ||
          hasText
        ) {
          throw new BadRequestException(
            `Condition ${condition.conditionNo} contains invalid values for DESIGNATION`,
          );
        }
        break;

      case 'EMPLOYEE':
        if (
          !hasEmployees ||
          hasDepartment ||
          hasDesignation ||
          hasNumber ||
          hasNumberTo ||
          hasText
        ) {
          throw new BadRequestException(
            `Condition ${condition.conditionNo} contains invalid values for EMPLOYEE`,
          );
        }
        break;

      case 'TOTAL_AMOUNT':
      case 'SALARY_AMOUNT':
      case 'LEAVE_DAYS':
      case 'REGULARISATION_DAYS':
        if (
          !hasNumber ||
          hasDepartment ||
          hasDesignation ||
          hasEmployees ||
          hasText
        ) {
          throw new BadRequestException(
            `Condition ${condition.conditionNo} contains invalid numeric values`,
          );
        }

        if (
          condition.operator !==
          'BETWEEN' &&
          hasNumberTo
        ) {
          throw new BadRequestException(
            `Second value is only allowed with BETWEEN for condition ${condition.conditionNo}`,
          );
        }
        break;

      case 'LEAVE_TYPE':
      case 'EXIT_TYPE':
      case 'REGULARISATION_TYPE':
      case 'REQUEST_TEXT':
        if (
          !hasText ||
          hasDepartment ||
          hasDesignation ||
          hasEmployees ||
          hasNumber ||
          hasNumberTo
        ) {
          throw new BadRequestException(
            `Condition ${condition.conditionNo} contains invalid text values`,
          );
        }
        break;
    }
  }

  private async validateConditions(params: {
    companyID: number;
    branchesID?: number | null;
    companyModuleID: number;
    conditions?: any[];
  }) {
    const {
      companyID,
      branchesID,
      companyModuleID,
      conditions = [],
    } = params;

    if (!conditions.length) {
      return;
    }

    const conditionNumbers = conditions.map(
      (condition) => Number(condition.conditionNo),
    );

    if (
      new Set(conditionNumbers).size !==
      conditionNumbers.length
    ) {
      throw new BadRequestException(
        'Duplicate condition numbers are not allowed',
      );
    }

    const sortedNumbers = [...conditionNumbers].sort(
      (a, b) => a - b,
    );

    sortedNumbers.forEach((conditionNo, index) => {
      if (conditionNo !== index + 1) {
        throw new BadRequestException(
          'Workflow condition numbers must be sequential',
        );
      }
    });

    const module =
      await this.prisma.companyModules.findUnique({
        where: {
          id: companyModuleID,
        },
        select: {
          id: true,
          moduleKey: true,
          moduleName: true,
          moduleStatus: true,
        },
      });

    if (!module) {
      throw new BadRequestException(
        'Selected workflow module was not found',
      );
    }

    if (module.moduleStatus === false) {
      throw new BadRequestException(
        `Module "${module.moduleName}" is inactive`,
      );
    }

    const moduleKey =
      (module.moduleKey as string | null | undefined)?.trim().toUpperCase();

    if (!moduleKey) {
      throw new BadRequestException(
        `Module "${module.moduleName}" does not have a moduleKey. Please configure the module before adding workflow conditions.`,
      );
    }

    const moduleConfig =
      WORKFLOW_CONDITION_CONFIG[
      moduleKey as keyof typeof WORKFLOW_CONDITION_CONFIG
      ];

    if (!moduleConfig) {
      throw new BadRequestException(
        `No workflow condition configuration exists for module key "${moduleKey}"`,
      );
    }

    for (const condition of conditions) {
      if (
        !moduleConfig.fields.includes(
          condition.fieldKey as never,
        )
      ) {
        throw new BadRequestException(
          `Condition field ${condition.fieldKey} is not supported for ${module.moduleName}`,
        );
      }

      const allowedOperators =
        CONDITION_OPERATOR_CONFIG[
        condition.fieldKey as keyof typeof CONDITION_OPERATOR_CONFIG
        ];

      if (
        !allowedOperators?.includes(
          condition.operator as never,
        )
      ) {
        throw new BadRequestException(
          `Operator ${condition.operator} is not allowed for ${condition.fieldKey}`,
        );
      }

      this.validateConditionValueType(
        condition,
      );

      this.validateConditionPayloadShape(
        condition,
      );

      await this.validateConditionValue({
        companyID,
        branchesID,
        condition,
      });
    }
  }

  async findAll(filters?: {
    companyID?: number;
    branchesID?: number;
    companyModuleID?: number;
    workflowStatus?: boolean;
    search?: string;
  }) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        ...(filters?.companyID && {
          companyID: filters.companyID,
        }),

        ...(filters?.branchesID && {
          branchesID: filters.branchesID,
        }),

        ...(filters?.companyModuleID && {
          companyModuleID:
            filters.companyModuleID,
        }),

        ...(typeof filters?.workflowStatus ===
          'boolean' && {
          workflowStatus:
            filters.workflowStatus,
        }),

        ...(filters?.search?.trim() && {
          OR: [
            {
              workflowName: {
                contains: filters.search.trim(),
                mode: 'insensitive',
              },
            },
            {
              workflowDescription: {
                contains: filters.search.trim(),
                mode: 'insensitive',
              },
            },
            {
              companyModule: {
                moduleName: {
                  contains: filters.search.trim(),
                  mode: 'insensitive',
                },
              },
            },
          ],
        }),
      },

      include: this.workflowInclude(),

      orderBy: [
        {
          workflowStatus: 'desc',
        },
        {
          effectiveFrom: 'desc',
        },
        {
          workflowName: 'asc',
        },
      ],
    });
  }


  private async validateConditionValue(params: {
    companyID: number;
    branchesID?: number | null;
    condition: any;
  }) {
    const {
      companyID,
      branchesID,
      condition,
    } = params;

    switch (condition.fieldKey) {
      case 'BRANCH': {
        if (!condition.branchesID) {
          throw new BadRequestException(
            `Branch is required for condition ${condition.conditionNo}`,
          );
        }

        const branch = await this.prisma.branches.findFirst({
          where: {
            id: condition.branchesID,
            companyID,
          },
          select: { id: true },
        });

        if (!branch) {
          throw new BadRequestException(
            'Selected branch does not belong to the workflow company',
          );
        }

        break;
      }

      case 'DEPARTMENT': {
        if (!condition.departmentID) {
          throw new BadRequestException(
            `Department is required for condition ${condition.conditionNo}`,
          );
        }

        const department =
          await this.prisma.departments.findFirst({
            where: {
              id: condition.departmentID,
              companyID,
            },
            select: {
              id: true,
            },
          });

        if (!department) {
          throw new BadRequestException(
            'Selected department does not belong to the workflow scope',
          );
        }

        break;
      }

      case 'DESIGNATION': {
        if (!condition.designationID) {
          throw new BadRequestException(
            `Designation is required for condition ${condition.conditionNo}`,
          );
        }

        const designation =
          await this.prisma.designations.findFirst({
            where: {
              id: condition.designationID,
              companyID,
              ...(branchesID
                ? { branchesID }
                : {}),
            },
            select: {
              id: true,
            },
          });

        if (!designation) {
          throw new BadRequestException(
            'Selected designation does not belong to the workflow scope',
          );
        }

        break;
      }

      case 'EMPLOYEE': {
        const employeeIDs: number[] =
          Array.isArray(
            condition.employeeIDs,
          )
            ? condition.employeeIDs.map(
              (id: unknown) => Number(id),
            )
            : [];

        if (!employeeIDs.length) {
          throw new BadRequestException(
            `At least one employee is required for condition ${condition.conditionNo}`,
          );
        }

        const invalidEmployeeIDs =
          employeeIDs.filter(
            (id) =>
              !Number.isInteger(id) ||
              id <= 0,
          );

        if (invalidEmployeeIDs.length) {
          throw new BadRequestException(
            `Invalid employee IDs in condition ${condition.conditionNo}`,
          );
        }

        const uniqueEmployeeIDs: number[] = [
          ...new Set<number>(employeeIDs),
        ];

        if (
          uniqueEmployeeIDs.length !==
          employeeIDs.length
        ) {
          throw new BadRequestException(
            `Duplicate employees are not allowed in condition ${condition.conditionNo}`,
          );
        }

        const employees =
          await this.prisma.manageEmployee.findMany({
            where: {
              id: {
                in: uniqueEmployeeIDs,
              },

              companyID,

              ...(branchesID
                ? {
                  branchesID,
                }
                : {}),
            },

            select: {
              id: true,
            },
          });

        if (
          employees.length !==
          uniqueEmployeeIDs.length
        ) {
          throw new BadRequestException(
            'One or more selected employees do not belong to the workflow company or branch',
          );
        }

        break;
      }
      case 'TOTAL_AMOUNT':
      case 'SALARY_AMOUNT':
      case 'LEAVE_DAYS':
      case 'REGULARISATION_DAYS': {
        if (
          condition.numberValue ===
          undefined ||
          condition.numberValue === null
        ) {
          throw new BadRequestException(
            `Numeric value is required for condition ${condition.conditionNo}`,
          );
        }

        const numberValue = Number(
          condition.numberValue,
        );

        if (!Number.isFinite(numberValue)) {
          throw new BadRequestException(
            `Invalid numeric value for condition ${condition.conditionNo}`,
          );
        }

        if (numberValue < 0) {
          throw new BadRequestException(
            `Numeric value cannot be negative for condition ${condition.conditionNo}`,
          );
        }

        if (
          condition.operator ===
          'BETWEEN'
        ) {
          if (
            condition.numberValueTo ===
            undefined ||
            condition.numberValueTo === null
          ) {
            throw new BadRequestException(
              `Second numeric value is required for BETWEEN condition ${condition.conditionNo}`,
            );
          }

          const numberValueTo = Number(
            condition.numberValueTo,
          );

          if (
            !Number.isFinite(
              numberValueTo,
            )
          ) {
            throw new BadRequestException(
              `Invalid upper numeric value for condition ${condition.conditionNo}`,
            );
          }

          if (numberValueTo < numberValue) {
            throw new BadRequestException(
              `Upper value must be greater than or equal to lower value for condition ${condition.conditionNo}`,
            );
          }
        }

        break;
      }

      case 'LEAVE_TYPE':
      case 'EXIT_TYPE':
      case 'REGULARISATION_TYPE':
      case 'REQUEST_TEXT': {
        if (!condition.textValue?.trim()) {
          throw new BadRequestException(
            `Text value is required for condition ${condition.conditionNo}`,
          );
        }

        break;
      }
    }
  }

  async findOne(id: number) {
    const workflow =
      await this.prisma.approvalWorkflow.findUnique({
        where: { id },
        include: this.workflowInclude(),
      });

    if (!workflow) {
      throw new NotFoundException(
        `Approval workflow with ID ${id} was not found`,
      );
    }

    return workflow;
  }

  async update(
    id: number,
    dto: UpdateApprovalWorkflowDto,
  ) {
    const existing = await this.findOne(id);

    const normalizedExistingSteps =
      (existing.steps as any[])
        .map((step: any) => ({
          stepNo:
            Number(step.stepNo),

          approverType:
            String(
              step.approverType ??
              WorkflowApproverType.DESIGNATION,
            )
              .trim()
              .toUpperCase(),

          approvalRequirement:
            String(
              step.approvalRequirement ??
              ApprovalRequirement.ANY,
            )
              .trim()
              .toUpperCase(),

          designationID:
            step.designationID != null
              ? Number(step.designationID)
              : null,

          stepName:
            step.stepName?.trim() ||
            null,

          isMandatory:
            step.isMandatory !== false,

          canReject:
            step.canReject !== false,

          canSendBack:
            step.canSendBack === true,

          approvalTimeout:
            step.approvalTimeout != null
              ? Number(step.approvalTimeout)
              : null,
        }))
        .sort(
          (a, b) =>
            a.stepNo - b.stepNo,
        );

    const normalizedSubmittedSteps =
      dto.steps === undefined
        ? normalizedExistingSteps
        : dto.steps
          .map((step) => {
            const approverType =
              String(
                step.approverType ??
                WorkflowApproverType.DESIGNATION,
              )
                .trim()
                .toUpperCase();

            return {
              stepNo:
                Number(step.stepNo),

              approverType,

              approvalRequirement:
                String(
                  step.approvalRequirement ??
                  ApprovalRequirement.ANY,
                )
                  .trim()
                  .toUpperCase(),

              designationID:
                approverType ===
                WorkflowApproverType.REPORTING_MANAGER
                  ? null
                  : step.designationID != null
                    ? Number(step.designationID)
                    : null,

              stepName:
                step.stepName?.trim() ||
                null,

              isMandatory:
                step.isMandatory !== false,

              canReject:
                step.canReject !== false,

              canSendBack:
                step.canSendBack === true,

              approvalTimeout:
                step.approvalTimeout != null
                  ? Number(step.approvalTimeout)
                  : null,
            };
          })
          .sort(
            (a, b) =>
              a.stepNo - b.stepNo,
          );

    const normalizeCondition = (
      condition: any,
    ) => ({
      conditionNo:
        Number(
          condition.conditionNo,
        ),

      fieldKey:
        condition.fieldKey,

      operator:
        condition.operator,

      valueType:
        condition.valueType,

      branchesID:
        condition.branchesID != null
          ? Number(condition.branchesID)
          : null,

      departmentID:
        condition.departmentID != null
          ? Number(
            condition.departmentID,
          )
          : null,

      designationID:
        condition.designationID != null
          ? Number(
            condition.designationID,
          )
          : null,

      employeeIDs:
        [
          ...(condition.employeeIDs ??
            condition.employees?.map(
              (item: any) =>
                item.manageEmployeeID,
            ) ??
            []),
        ]
          .map(Number)
          .sort((a, b) => a - b),

      numberValue:
        condition.numberValue != null
          ? Number(
            condition.numberValue,
          )
          : null,

      numberValueTo:
        condition.numberValueTo != null
          ? Number(
            condition.numberValueTo,
          )
          : null,

      textValue:
        condition.textValue?.trim() ||
        null,

      booleanValue:
        condition.booleanValue ??
        null,

      dateValue:
        condition.dateValue
          ? new Date(
            condition.dateValue,
          ).toISOString()
          : null,

      dateValueTo:
        condition.dateValueTo
          ? new Date(
            condition.dateValueTo,
          ).toISOString()
          : null,
    });

    const normalizedExistingConditions =
      existing.conditions
        .map(normalizeCondition)
        .sort(
          (a, b) =>
            a.conditionNo -
            b.conditionNo,
        );

    const normalizedSubmittedConditions =
      dto.conditions === undefined
        ? normalizedExistingConditions
        : dto.conditions
          .map(normalizeCondition)
          .sort(
            (a, b) =>
              a.conditionNo -
              b.conditionNo,
          );

    const stepsChanged =
      JSON.stringify(
        normalizedExistingSteps,
      ) !==
      JSON.stringify(
        normalizedSubmittedSteps,
      );

    const conditionsChanged =
      JSON.stringify(
        normalizedExistingConditions,
      ) !==
      JSON.stringify(
        normalizedSubmittedConditions,
      );

    const scopeChanged =
      (
        dto.companyID !== undefined &&
        Number(dto.companyID) !==
        Number(existing.companyID)
      ) ||
      (
        dto.branchesID !== undefined &&
        Number(
          dto.branchesID ?? 0,
        ) !==
        Number(
          existing.branchesID ?? 0,
        )
      ) ||
      (
        dto.companyModuleID !==
        undefined &&
        Number(dto.companyModuleID) !==
        Number(
          existing.companyModuleID,
        )
      ) ||
      (
        dto.serviceProviderID !==
        undefined &&
        Number(
          dto.serviceProviderID ?? 0,
        ) !==
        Number(
          existing.serviceProviderID ??
          0,
        )
      );

    const structuralChangeRequested =
      stepsChanged ||
      conditionsChanged ||
      scopeChanged;

    if (structuralChangeRequested) {
      const pendingRequestCount =
        await this.prisma
          .approvalRequest
          .count({
            where: {
              approvalWorkflowID:
                id,

              status:
                'PENDING',
            },
          });

      if (pendingRequestCount > 0) {
        throw new ConflictException(
          `Workflow cannot be structurally changed because ${pendingRequestCount} approval request(s) are pending`,
        );
      }
    }


    const finalCompanyID =
      dto.companyID ?? existing.companyID;

    const finalBranchesID =
      dto.branchesID !== undefined
        ? dto.branchesID
        : existing.branchesID;

    const finalCompanyModuleID =
      dto.companyModuleID !== undefined
        ? dto.companyModuleID
        : existing.companyModuleID!;

    const finalSteps =
      dto.steps ??
      existing.steps.map((step) => ({
        stepNo:
          step.stepNo,

        approverType:
          step.approverType,

        approvalRequirement:
          step.approvalRequirement,

        designationID:
          step.designationID,

        stepName:
          step.stepName ?? undefined,

        isMandatory:
          step.isMandatory,

        canReject:
          step.canReject,

        canSendBack:
          step.canSendBack,

        approvalTimeout:
          step.approvalTimeout ?? undefined,
      }));

    const finalConditions =
      dto.conditions !== undefined
        ? dto.conditions
        : existing.conditions.map(
          (condition) => ({
            conditionNo:
              condition.conditionNo,

            fieldKey:
              condition.fieldKey,

            operator:
              condition.operator,

            valueType:
              condition.valueType,

            branchesID:
              condition.branchesID ??
              undefined,

            departmentID:
              condition.departmentID ??
              undefined,

            designationID:
              condition.designationID ??
              undefined,

            employeeIDs:
              condition.employeeIDs ??
              undefined,

            numberValue:
              condition.numberValue != null
                ? Number(
                  condition.numberValue,
                )
                : undefined,

            numberValueTo:
              condition.numberValueTo != null
                ? Number(
                  condition.numberValueTo,
                )
                : undefined,

            textValue:
              condition.textValue ??
              undefined,

            booleanValue:
              condition.booleanValue ??
              undefined,

            dateValue:
              condition.dateValue
                ? new Date(
                  condition.dateValue,
                ).toISOString()
                : undefined,

            dateValueTo:
              condition.dateValueTo
                ? new Date(
                  condition.dateValueTo,
                ).toISOString()
                : undefined,
          }),
        );


    this.validateSteps(finalSteps);

    await this.validateReferences({
      companyID: finalCompanyID,
      branchesID: finalBranchesID,
      companyModuleID:
        finalCompanyModuleID,
      steps: finalSteps,
    });

    await this.validateConditions({
      companyID: finalCompanyID,
      branchesID: finalBranchesID,
      companyModuleID:
        finalCompanyModuleID,
      conditions: finalConditions,
    });

    await this.validateConditionalWorkflowRequirement({
      companyModuleID:
        finalCompanyModuleID,

      workflowStatus:
        dto.workflowStatus ??
        existing.workflowStatus,

      conditions:
        finalConditions,
    });


    const finalWorkflowName =
      dto.workflowName?.trim() ??
      existing.workflowName;

    const duplicate =
      await this.prisma.approvalWorkflow.findFirst({
        where: {
          id: {
            not: id,
          },
          companyID:
            finalCompanyID,
          branchesID:
            finalBranchesID ?? null,
          companyModuleID:
            finalCompanyModuleID,
          workflowName: {
            equals: finalWorkflowName,
            mode: 'insensitive',
          },
        },
      });

    if (duplicate) {
      throw new ConflictException(
        'Another workflow with this name already exists for the selected company, branch and module',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      /*
       * Recreate steps to ensure step numbers stay clean and sequential.
       */
      if (
        dto.steps !== undefined &&
        stepsChanged
      ) {
        await tx.approvalWorkflowStep.deleteMany({
          where: {
            approvalWorkflowID:
              id,
          },
        });
      }

      if (
        dto.conditions !== undefined &&
        conditionsChanged
      ) {
        await tx.approvalWorkflowCondition.deleteMany({
          where: {
            approvalWorkflowID:
              id,
          },
        });
      }

      return tx.approvalWorkflow.update({
        where: { id },

        data: {
          ...(dto.serviceProviderID !== undefined && {
            serviceProviderID:
              dto.serviceProviderID ?? null,
          }),

          ...(dto.companyID !== undefined && {
            companyID: dto.companyID,
          }),

          ...(dto.branchesID !== undefined && {
            branchesID:
              dto.branchesID ?? null,
          }),

          ...(dto.companyModuleID !== undefined && {
            companyModuleID:
              dto.companyModuleID,
          }),

          ...(dto.workflowName !== undefined && {
            workflowName:
              dto.workflowName.trim(),
          }),

          ...(dto.workflowDescription !== undefined && {
            workflowDescription:
              dto.workflowDescription?.trim() ||
              null,
          }),

          ...(dto.effectiveFrom !== undefined && {
            effectiveFrom:
              new Date(dto.effectiveFrom),
          }),

          ...(dto.conditionMatchType !== undefined && {
            conditionMatchType:
              dto.conditionMatchType,
          }),



          ...(dto.allowAnySameDesignation !==
            undefined && {
            allowAnySameDesignation:
              dto.allowAnySameDesignation,
          }),

          ...(dto.workflowStatus !== undefined && {
            workflowStatus:
              dto.workflowStatus,
          }),

          ...(dto.createdByUserID !== undefined && {
            updatedByUserID:
              dto.createdByUserID ?? null,
          }),

          ...(dto.conditions !== undefined &&
            conditionsChanged && {
            conditions: {
              create: [...dto.conditions]
                .sort(
                  (a, b) =>
                    a.conditionNo - b.conditionNo,
                )
                .map((condition) => ({
                  conditionNo:
                    condition.conditionNo,

                  fieldKey:
                    condition.fieldKey,

                  operator:
                    condition.operator,

                  valueType:
                    condition.valueType,

                  departmentID:
                    condition.departmentID ?? null,

                  designationID:
                    condition.designationID ?? null,

                  branchesID:
                    condition.branchesID ?? null,

                  numberValue:
                    condition.numberValue ?? null,

                  numberValueTo:
                    condition.numberValueTo ?? null,

                  textValue:
                    condition.textValue?.trim() ||
                    null,

                  booleanValue:
                    condition.booleanValue ?? null,

                  dateValue:
                    condition.dateValue
                      ? new Date(
                        condition.dateValue,
                      )
                      : null,

                  dateValueTo:
                    condition.dateValueTo
                      ? new Date(
                        condition.dateValueTo,
                      )
                      : null,

                  ...(condition.employeeIDs?.length && {
                    employees: {
                      create:
                        condition.employeeIDs.map(
                          (manageEmployeeID) => ({
                            manageEmployeeID:
                              Number(manageEmployeeID),
                          }),
                        )
                    },
                  }),
                })),
            },
          }),

          ...(dto.steps !== undefined &&
            stepsChanged && {
            steps: {
              create: [...dto.steps]
                .sort(
                  (a, b) =>
                    a.stepNo - b.stepNo,
                )
                .map((step) => ({
                  stepNo:
                    step.stepNo,

                  approverType:
                    String(
                      step.approverType ??
                      WorkflowApproverType.DESIGNATION,
                    )
                      .trim()
                      .toUpperCase() as WorkflowApproverType,

                  approvalRequirement:
                    String(
                      step.approvalRequirement ??
                      ApprovalRequirement.ANY,
                    )
                      .trim()
                      .toUpperCase() as ApprovalRequirement,

                  designationID:
                    String(
                      step.approverType ??
                      WorkflowApproverType.DESIGNATION,
                    )
                      .trim()
                      .toUpperCase() ===
                    WorkflowApproverType.REPORTING_MANAGER
                      ? null
                      : step.designationID ?? null,

                  stepName:
                    step.stepName?.trim() ||
                    null,
                  isMandatory:
                    step.isMandatory ??
                    true,
                  canReject:
                    step.canReject ??
                    true,
                  canSendBack:
                    step.canSendBack ??
                    false,
                  approvalTimeout:
                    step.approvalTimeout ??
                    null,
                })),
            },
          }),
        },



        include: this.workflowInclude(),
      });
    });
  }



  async updateStatus(
    id: number,
    workflowStatus: boolean,
  ) {
    await this.findOne(id);

    return this.prisma.approvalWorkflow.update({
      where: { id },
      data: {
        workflowStatus,
      },
      include: this.workflowInclude(),
    });
  }

  async remove(id: number) {
    const workflow =
      await this.findOne(id);

    const requestCount =
      await this.prisma.approvalRequest.count({
        where: {
          approvalWorkflowID: id,
        },
      });

    if (requestCount > 0) {
      throw new ConflictException(
        `Workflow cannot be deleted because it has ${requestCount} approval request record(s). Deactivate the workflow instead.`,
      );
    }

    await this.prisma.approvalWorkflow.delete({
      where: {
        id,
      },
    });

    return {
      message:
        'Approval workflow deleted successfully',
      data: workflow,
    };
  }

  /**
  * Returns active candidate workflows for the supplied scope.
  *
  * Exact branch workflows are returned before company-wide
  * workflows. The approval engine must then evaluate each
  * workflow's conditions and use the first matching workflow.
  */
  async resolveWorkflow(params: {
    companyID: number;
    branchesID?: number | null;
    companyModuleID: number;
    effectiveAt?: Date;
  }) {
    const effectiveAt =
      params.effectiveAt ?? new Date();

    const workflows =
      await this.prisma.approvalWorkflow.findMany({
        where: {
          companyID:
            params.companyID,

          companyModuleID:
            params.companyModuleID,

          workflowStatus:
            true,

          effectiveFrom: {
            lte: effectiveAt,
          },

          OR:
            params.branchesID != null
              ? [
                {
                  branchesID:
                    params.branchesID,
                },
                {
                  branchesID:
                    null,
                },
              ]
              : [
                {
                  branchesID:
                    null,
                },
              ],
        },

        include:
          this.workflowInclude(),

        orderBy: [
          {
            effectiveFrom:
              'desc',
          },
          {
            id:
              'desc',
          },
        ],
      });

    if (!workflows.length) {
      return [];
    }

    return workflows.sort(
      (left, right) => {
        const leftExactBranch =
          params.branchesID != null &&
          left.branchesID != null &&
          Number(left.branchesID) ===
          Number(params.branchesID);

        const rightExactBranch =
          params.branchesID != null &&
          right.branchesID != null &&
          Number(right.branchesID) ===
          Number(params.branchesID);

        if (
          leftExactBranch !==
          rightExactBranch
        ) {
          return leftExactBranch
            ? -1
            : 1;
        }

        const effectiveDifference =
          new Date(
            right.effectiveFrom,
          ).getTime() -
          new Date(
            left.effectiveFrom,
          ).getTime();

        if (effectiveDifference !== 0) {
          return effectiveDifference;
        }

        return right.id - left.id;
      },
    );
  }


  private workflowInclude(): Prisma.ApprovalWorkflowInclude {
    return {
      company: {
        select: {
          id: true,
          companyName: true,
        },
      },

      branches: {
        select: {
          id: true,
          branchName: true,
          companyID: true,
        },
      },

      companyModule: {
        select: {
          id: true,
          moduleKey: true,
          moduleName: true,
          moduleDescription: true,
          moduleStatus: true,
        },
      },

    steps: {
  include: {
    designation: {
      select: {
        id: true,
        designation: true,
        companyID: true,
        branchesID: true,
        departmentID: true,
        isManager: true,

        branches: {
          select: {
            id: true,
            branchName: true,
            companyID: true,
          },
        },

        department: {
          select: {
            id: true,
            departmentName: true,
          },
        },
      },
    },
  },

  orderBy: {
    stepNo: 'asc' as const,
  },
},

      conditions: {
        include: {
          department: {
            select: {
              id: true,
              departmentName: true,
              companyID: true,
              branchesID: true,
            },
          },

          designation: {
            select: {
              id: true,
              designation: true,
              companyID: true,
              branchesID: true,
              departmentID: true,
              isManager: true,
            },
          },

          branches: {
            select: {
              id: true,
              branchName: true,
              companyID: true,
            },
          },

          employees: {
            include: {
              employee: {
                select: {
                  id: true,
                  employeeID: true,
                  employeeFirstName: true,
                  employeeLastName: true,
                  companyID: true,
                  branchesID: true,
                },
              },
            },

            orderBy: {
              id: 'asc' as const,
            },
          },
        },

        orderBy: {
          conditionNo: 'asc' as const,
        },
      },
    };
  }
}
