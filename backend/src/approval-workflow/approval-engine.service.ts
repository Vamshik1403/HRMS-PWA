import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  Prisma,
  WorkflowConditionMatchType,
} from '@prisma/client';

type TransactionClient = Prisma.TransactionClient;

interface EmployeeApprovalSubject {
  id: number;
  serviceProviderID: number | null;
  companyID: number | null;
  branchesID: number | null;
  departmentNameID: number | null;
  designationID: number | null;
}

interface ApprovalSubmissionResult {
  approvalRequired: boolean;
  approvalRequestID: number | null;
  workflowID: number | null;
  workflowName: string | null;
  currentStepNo: number | null;
  status: 'APPROVED' | 'PENDING';
}

@Injectable()
export class ApprovalEngineService {
  private readonly EMPLOYEE_ONBOARDING_MODULE_KEY =
    'EMPLOYEE_ONBOARDING_MODULE';

  async submitEmployeeOnboarding(
    tx: TransactionClient,
    employee: EmployeeApprovalSubject,
    submittedByUserID?: number | null,
  ): Promise<ApprovalSubmissionResult> {
    if (!employee.companyID) {
      throw new BadRequestException(
        'Company is required before resolving employee onboarding approval',
      );
    }

    const workflow = await this.resolveMatchingWorkflow(
      tx,
      employee,
    );


    /*
 * Direct approval applies when:
 *
 * 1. No active onboarding workflow exists.
 * 2. Active workflows exist, but none of their conditions
 *    match the employee.
 * 3. The selected workflow has no active conditions.
 *
 * Approval requests are created only when a workflow has
 * at least one active condition and that condition set matches.
 */
    if (!workflow) {
      await tx.manageEmployee.update({
        where: {
          id: employee.id,
        },

        data: {
          onboardingApprovalStatus:
            'APPROVED',
        },
      });

      return {
        approvalRequired: false,
        approvalRequestID: null,

        workflowID:null,

        workflowName:null,

        currentStepNo: null,
        status: 'APPROVED',
      };
    }

    if (!workflow.steps.length) {
      throw new BadRequestException(
        `Workflow "${workflow.workflowName}" has no approval steps`,
      );
    }

    const workflowName =
      workflow.workflowName?.trim();

    const moduleKey =
  workflow.companyModule.moduleKey
    ?.trim()
    .toUpperCase();

    if (!workflowName) {
      throw new BadRequestException(
        `Workflow ${workflow.id} does not have a valid workflow name`,
      );
    }

    if (!moduleKey) {
      throw new BadRequestException(
        `Workflow "${workflowName}" does not have a valid module key`,
      );
    }
    if (
  moduleKey !==
  this.EMPLOYEE_ONBOARDING_MODULE_KEY
) {
  throw new BadRequestException(
    `Workflow "${workflowName}" is not an Employee Onboarding workflow`,
  );
}


    const approvalRequest =
      await tx.approvalRequest.create({
        data: {
          serviceProviderID:
            employee.serviceProviderID,

          companyID:
            employee.companyID,

          branchesID:
            employee.branchesID,

          approvalWorkflowID:
            workflow.id,

          companyModuleID:
            workflow.companyModuleID,

          subjectType:
            'EMPLOYEE_ONBOARDING',

          subjectID:
            employee.id,

          subjectEmployeeID:
            employee.id,

          status:
            'PENDING',

          currentStepNo:
            1,

          workflowNameSnapshot:
            workflowName,

          moduleKeySnapshot:
            moduleKey,

          conditionMatchTypeSnapshot:
            workflow.conditionMatchType,

          allowAnySameDesignationSnapshot:
            workflow.allowAnySameDesignation,

          submittedByUserID:
            submittedByUserID ?? null,

          submittedAt:
            new Date(),
        },
      });


    for (const workflowStep of workflow.steps) {
      const isFirstStep =
        workflowStep.stepNo === 1;

      /*
       * Employee onboarding requests are approved by COMPANY_ADMIN
       * users of the employee's company when possible. Fall back to
       * workflow-step approvers when admins have no linked employee record.
       */
const eligibleApprovers =
  await this.findStepApprovers(
    tx,
    employee,
    workflowStep,
  );

if (!eligibleApprovers.length) {
  throw new BadRequestException(
    `Employee cannot be created because no active approved "${
      workflowStep.designation.designation ||
      `Designation ${workflowStep.designationID}`
    }" approver with active credentials exists in the selected company and branch for approval step ${workflowStep.stepNo}`,
  );
}

/*
 * allowAnySameDesignation = true
 * → every eligible employee receives the approval request.
 *
 * allowAnySameDesignation = false
 * → only one eligible employee receives the request until
 *   reporting-manager hierarchy is implemented.
 */
const approvers =
  workflow.allowAnySameDesignation
    ? eligibleApprovers
    : eligibleApprovers.slice(0, 1);
      const designationName =
        workflowStep.designation.designation?.trim() ||
        `Designation ${workflowStep.designationID}`;

      const requestStep =
        await tx.approvalRequestStep.create({
          data: {
            approvalRequestID:
              approvalRequest.id,

            approvalWorkflowStepID:
              workflowStep.id,

            stepNo:
              workflowStep.stepNo,

            designationID:
              workflowStep.designationID,

            stepNameSnapshot:
              workflowStep.stepName,

            designationNameSnapshot:
              designationName,

            isMandatorySnapshot:
              workflowStep.isMandatory,

            canRejectSnapshot:
              workflowStep.canReject,

            canSendBackSnapshot:
              workflowStep.canSendBack,

            approvalTimeoutSnapshot:
              workflowStep.approvalTimeout,

            status:
              isFirstStep
                ? 'PENDING'
                : 'WAITING',

            activatedAt:
              isFirstStep
                ? new Date()
                : null,
          },
        });

      await tx.approvalRequestApprover.createMany({
        data: approvers.map((approver) => ({
          approvalRequestID:
            approvalRequest.id,

          approvalRequestStepID:
            requestStep.id,

          approverEmployeeID:
            approver.id,

          designationIDSnapshot:
            workflowStep.designationID,

          designationNameSnapshot:
            designationName,

          departmentIDSnapshot:
            approver.departmentNameID,

          branchesIDSnapshot:
            approver.branchesID,

          companyIDSnapshot:
            employee.companyID!,

          status:
            isFirstStep
              ? 'PENDING'
              : 'WAITING',

          activatedAt:
            isFirstStep
              ? new Date()
              : null,
        })),
      });



      if (isFirstStep) {
        await tx.approvalRequestAction.create({
          data: {
            approvalRequestID:
              approvalRequest.id,

            approvalRequestStepID:
              requestStep.id,

            action:
              'STEP_ACTIVATED',

            fromStatus:
              'WAITING',

            toStatus:
              'PENDING',

            remark:
              'Employee onboarding approval Step 1 activated',
          },
        });
      }
    }

    await tx.approvalRequestAction.create({
      data: {
        approvalRequestID:
          approvalRequest.id,

        action:
          'SUBMITTED',

        fromStatus:
          null,

        toStatus:
          'PENDING',

        actedByUserID:
          submittedByUserID ?? null,

        remark:
          'Employee onboarding submitted for approval',
      },
    });

    await tx.manageEmployee.update({
      where: {
        id: employee.id,
      },
      data: {
        onboardingApprovalStatus:
          'PENDING',
      },
    });

    return {
      approvalRequired: true,
      approvalRequestID:
        approvalRequest.id,
      workflowID:
        workflow.id,
      workflowName,
      currentStepNo: 1,
      status:
        'PENDING',
    };
  }

  /**
   * Resolves workflows in this order:
   *
   * 1. Exact branch workflows
   * 2. Company-wide workflows
   * 3. Newest effective workflow first
   * 4. First workflow whose dynamic conditions match
   */
  private async resolveMatchingWorkflow(
    tx: TransactionClient,
    employee: EmployeeApprovalSubject,
  ) {
    const workflows =
      await tx.approvalWorkflow.findMany({
        where: {
          companyID:
            employee.companyID!,

          workflowStatus:
            true,

          effectiveFrom: {
            lte: new Date(),
          },

          companyModule: {
            moduleKey:
              this.EMPLOYEE_ONBOARDING_MODULE_KEY,

            moduleStatus:
              true,
          },

          AND: [
            {
              OR: employee.branchesID
                ? [
                  {
                    branchesID:
                      employee.branchesID,
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

            {
              OR: employee.serviceProviderID
                ? [
                  {
                    serviceProviderID:
                      employee.serviceProviderID,
                  },
                  {
                    serviceProviderID:
                      null,
                  },
                ]
                : [
                  {
                    serviceProviderID:
                      null,
                  },
                ],
            },
          ],
        },

        include: {
          companyModule: {
            select: {
              id: true,
              moduleKey: true,
              moduleName: true,
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
                },
              },
            },

            orderBy: {
              stepNo: 'asc',
            },
          },

          conditions: {
            where: {
              isActive: true,
            },

            include: {
              employees: {
                select: {
                  manageEmployeeID: true,
                },
              },
            },

            orderBy: {
              conditionNo: 'asc',
            },
          },
        },
      });

    /*
     * Prisma cannot reliably express exact branch preference
     * over null fallback together with effective date ordering.
     * Sort explicitly.
     */
    const sortedWorkflows =
      [...workflows].sort((a, b) => {
        const aBranchPriority =
  employee.branchesID != null &&
  a.branchesID != null &&
  Number(a.branchesID) ===
    Number(employee.branchesID)
    ? 0
    : 1;

const bBranchPriority =
  employee.branchesID != null &&
  b.branchesID != null &&
  Number(b.branchesID) ===
    Number(employee.branchesID)
    ? 0
    : 1;

        if (
          aBranchPriority !==
          bBranchPriority
        ) {
          return (
            aBranchPriority -
            bBranchPriority
          );
        }

        const effectiveDifference =
          b.effectiveFrom.getTime() -
          a.effectiveFrom.getTime();

        if (effectiveDifference !== 0) {
          return effectiveDifference;
        }

        return b.id - a.id;
      });

    for (const workflow of sortedWorkflows) {
      if (
        this.workflowConditionsMatch(
          workflow.conditionMatchType,
          workflow.conditions,
          employee,
        )
      ) {
        return workflow;
      }
    }

    return null;
  }

  private workflowConditionsMatch(
  matchType:
    WorkflowConditionMatchType,
  conditions: Array<any>,
  employee:
    EmployeeApprovalSubject,
): boolean {
  /*
   * No conditions means this workflow does not trigger
   * conditional employee approval.
   */
  if (!conditions.length) {
    return false;
  }

  const results =
    conditions.map(
      (condition) =>
        this.conditionMatches(
          condition,
          employee,
        ),
    );

  if (
    matchType ===
    WorkflowConditionMatchType.ANY
  ) {
    return results.some(
      (result) => result === true,
    );
  }

  return results.every(
    (result) => result === true,
  );
}

private conditionMatches(
  condition: any,
  employee:
    EmployeeApprovalSubject,
): boolean {
  switch (condition.fieldKey) {
    case 'DEPARTMENT':
      return this.compareEquality(
        employee.departmentNameID,
        condition.departmentID,
        condition.operator,
      );

    case 'DESIGNATION':
      return this.compareEquality(
        employee.designationID,
        condition.designationID,
        condition.operator,
      );

    case 'EMPLOYEE': {
      const selectedEmployeeIDs =
        Array.isArray(
          condition.employees,
        )
          ? condition.employees
              .map(
                (item: {
                  manageEmployeeID:
                    number;
                }) =>
                  Number(
                    item.manageEmployeeID,
                  ),
              )
              .filter(
                (id: number) =>
                  Number.isInteger(id) &&
                  id > 0,
              )
          : [];

      const included =
        selectedEmployeeIDs.includes(
          Number(employee.id),
        );

      if (
        condition.operator ===
        'IN'
      ) {
        return included;
      }

      if (
        condition.operator ===
        'NOT_IN'
      ) {
        return !included;
      }

      return false;
    }

    default:
      /*
       * Employee Onboarding supports only these fields:
       * DEPARTMENT, DESIGNATION and EMPLOYEE.
       */
      return false;
  }
}

  private compareEquality(
  actualValue:
    number | null,
  expectedValue:
    number | null,
  operator:
    string,
): boolean {
  /*
   * A missing employee value must not accidentally satisfy
   * either EQUALS or NOT_EQUALS.
   */
  if (
    actualValue == null ||
    expectedValue == null
  ) {
    return false;
  }

  const equal =
    Number(actualValue) ===
    Number(expectedValue);

  switch (operator) {
    case 'EQUALS':
      return equal;

    case 'NOT_EQUALS':
      return !equal;

    default:
      return false;
  }
}

  
  private async findStepApprovers(
  tx: TransactionClient,
  employee: EmployeeApprovalSubject,
  workflowStep: {
    designationID: number;

    designation: {
      departmentID: number | null;
      branchesID: number | null;
    };
  },
) {
  if (!employee.companyID) {
    return [];
  }

  /*
   * A workflow with branchesID = null applies to employees
   * from every branch, but approvers are resolved from the
   * newly created employee's branch.
   *
   * This prevents a Technical Head from another branch from
   * approving an employee unintentionally.
   */
  const approverBranchID =
    employee.branchesID ??
    workflowStep.designation.branchesID ??
    null;

  return tx.manageEmployee.findMany({
    where: {
      companyID:
        employee.companyID,

      /*
       * Never allow the newly created pending employee
       * to approve themselves.
       */
      id: {
        not: employee.id,
      },

      ...(approverBranchID != null
        ? {
            branchesID:
              approverBranchID,
          }
        : {}),

      /*
       * Resolve designation using either the direct current
       * field or employee designation history.
       */
      OR: [
        {
          designationID:
            workflowStep.designationID,
        },

        {
          empDesignation: {
            some: {
              designationID:
                workflowStep.designationID,
            },
          },
        },
      ],

      lifecycleStatus:
        'ACTIVE',

      onboardingApprovalStatus:
        'APPROVED',

      isDeleted:
        false,

      employeeCredentials: {
        is: {
          isActive:
            true,
        },
      },
    },

    select: {
      id: true,
      companyID: true,
      branchesID: true,
      departmentNameID: true,
      designationID: true,
    },

    orderBy: {
      id: 'asc',
    },
  });
}
}