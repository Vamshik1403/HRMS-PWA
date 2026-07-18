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
    if (
      !workflow ||
      workflow.conditions.length === 0
    ) {
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

        workflowID:
          workflow?.id ?? null,

        workflowName:
          workflow?.workflowName ?? null,

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
      workflow.companyModule.moduleKey?.trim();

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
      const approvers = await this.findOnboardingApprovers(
        tx,
        employee,
        workflowStep,
      );

      if (!approvers.length) {
        throw new BadRequestException(
          `No active approver was found for step ${workflowStep.stepNo} "${workflowStep.stepName || workflowStep.designation.designation}"`,
        );
      }

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
          employee.branchesID &&
          a.branchesID ===
            employee.branchesID
            ? 0
            : 1;

        const bBranchPriority =
          employee.branchesID &&
          b.branchesID ===
            employee.branchesID
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
    matchType: WorkflowConditionMatchType,
    conditions: Array<any>,
    employee: EmployeeApprovalSubject,
  ): boolean {
        /*
     * A workflow without conditions does not require approval.
     * It is handled as direct approval by submitEmployeeOnboarding().
     */
    if (!conditions.length) {
      return false;
    }

    const results =
      conditions.map((condition) =>
        this.conditionMatches(
          condition,
          employee,
        ),
      );

    if (matchType === 'ANY') {
      return results.some(Boolean);
    }

    return results.every(Boolean);
  }

  private conditionMatches(
    condition: any,
    employee: EmployeeApprovalSubject,
  ): boolean {
    switch (condition.fieldKey) {
      case 'DEPARTMENT': {
        return this.compareEquality(
          employee.departmentNameID,
          condition.departmentID,
          condition.operator,
        );
      }

      case 'DESIGNATION': {
        return this.compareEquality(
          employee.designationID,
          condition.designationID,
          condition.operator,
        );
      }

      case 'EMPLOYEE': {
        const selectedEmployeeIDs =
          condition.employees.map(
            (item: {
              manageEmployeeID: number;
            }) =>
              Number(
                item.manageEmployeeID,
              ),
          );

        const included =
          selectedEmployeeIDs.includes(
            employee.id,
          );

        if (
          condition.operator === 'IN'
        ) {
          return included;
        }

        if (
          condition.operator === 'NOT_IN'
        ) {
          return !included;
        }

        return false;
      }

      default:
        /*
         * EMPLOYEE_ONBOARDING_MODULE currently supports only:
         * DEPARTMENT, DESIGNATION and EMPLOYEE.
         */
        return false;
    }
  }

  private compareEquality(
    actualValue: number | null,
    expectedValue: number | null,
    operator: string,
  ): boolean {
    const equal =
      actualValue != null &&
      expectedValue != null &&
      Number(actualValue) ===
        Number(expectedValue);

    if (operator === 'EQUALS') {
      return equal;
    }

    if (operator === 'NOT_EQUALS') {
      return !equal;
    }

    return false;
  }

  /**
   * Finds employees who can approve one specific step.
   *
   * Scope:
   * - same company
   * - step designation
   * - request branch
   * - designation department, when defined
   * - active lifecycle
   * - not deleted
   * - active login credentials
   */
  private async findOnboardingApprovers(
    tx: TransactionClient,
    employee: EmployeeApprovalSubject,
    workflowStep: {
      designationID: number;
      designation: {
        departmentID: number | null;
        branchesID: number | null;
        designation: string | null;
      };
    },
  ) {
    const companyAdminUsers = await tx.user.findMany({
      where: {
        role: 'COMPANY_ADMIN',
        isActive: true,
        OR: [
          { companyID: employee.companyID },
          {
            userCompanies: {
              some: { companyID: employee.companyID! },
            },
          },
        ],
      },
      select: { username: true },
    });

    const adminUsernames = companyAdminUsers
      .map((user) => user.username?.trim())
      .filter((username): username is string => !!username);

    if (adminUsernames.length) {
      const linkedApprovers = await tx.manageEmployee.findMany({
        where: {
          companyID: employee.companyID,
          id: { not: employee.id },
          lifecycleStatus: 'ACTIVE',
          onboardingApprovalStatus: 'APPROVED',
          isDeleted: false,
          employeeCredentials: {
            is: {
              isActive: true,
              username: { in: adminUsernames },
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
        orderBy: { id: 'asc' },
      });

      if (linkedApprovers.length) {
        return linkedApprovers;
      }
    }

    return this.findStepApprovers(tx, employee, workflowStep);
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
    const stepBranchID =
      workflowStep.designation
        .branchesID ??
      employee.branchesID;

    return tx.manageEmployee.findMany({
      where: {
        companyID:
          employee.companyID,

        designationID:
          workflowStep.designationID,

        ...(stepBranchID
          ? {
              branchesID:
                stepBranchID,
            }
          : {}),

        ...(workflowStep.designation
          .departmentID
          ? {
              departmentNameID:
                workflowStep.designation
                  .departmentID,
            }
          : {}),

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