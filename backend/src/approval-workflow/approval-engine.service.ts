import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  ApprovalApproverStatus,
  ApprovalRequestStatus,
  ApprovalStepStatus,
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

interface AttendanceRegularisationApprovalSubject {
  id: number;
  serviceProviderID: number | null;
  companyID: number | null;
  branchesID: number | null;
  manageEmployeeID: number;
  departmentID: number | null;
  designationID: number | null;
  requestedStatus: string | null;
  regularisationDays: number;
}

interface ApprovalSubmissionResult {
  approvalRequired: boolean;
  approvalRequestID: number | null;
  workflowID: number | null;
  workflowName: string | null;
  currentStepNo: number | null;
  status: 'APPROVED' | 'PENDING';
}

interface WorkflowSubject {
  serviceProviderID: number | null;
  companyID: number;
  branchesID: number | null;
  employeeID: number;
  departmentID: number | null;
  designationID: number | null;
  requestedStatus?: string | null;
  regularisationDays?: number;
}

interface ResolvedApprover {
  id: number;
  companyID: number | null;
  branchesID: number | null;
  departmentNameID: number | null;
  designationID: number | null;
  designationName: string;
}

@Injectable()
export class ApprovalEngineService {
  private readonly EMPLOYEE_ONBOARDING_MODULE_KEY =
    'EMPLOYEE_ONBOARDING_MODULE';

  private readonly ATTENDANCE_MODULE_KEY =
    'ATTENDANCE_MODULE';

  /*
   * ============================================================
   * EMPLOYEE ONBOARDING
   * ============================================================
   */
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

    const subject: WorkflowSubject = {
      serviceProviderID:
        employee.serviceProviderID,

      companyID:
        employee.companyID,

      branchesID:
        employee.branchesID,

      employeeID:
        employee.id,

      departmentID:
        employee.departmentNameID,

      designationID:
        employee.designationID,
    };

    const workflow =
      await this.resolveMatchingWorkflow(
        tx,
        this.EMPLOYEE_ONBOARDING_MODULE_KEY,
        subject,
        new Date(),
      );

    /*
     * No matching conditional workflow = direct approval.
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
        workflowID: null,
        workflowName: null,
        currentStepNo: null,
        status: 'APPROVED',
      };
    }

    if (!workflow.steps.length) {
      throw new BadRequestException(
        `Workflow "${workflow.workflowName}" has no approval steps`,
      );
    }

    const result =
      await this.createApprovalRequest(
        tx,
        workflow,
        subject,
        {
          subjectType:
            'EMPLOYEE_ONBOARDING',

          subjectID:
            employee.id,

          subjectEmployeeID:
            employee.id,

          submittedByUserID:
            submittedByUserID ?? null,

          approverResolver:
            async (
              workflowStep: any,
            ) =>
              this.findOnboardingApprovers(
                tx,
                subject,
                workflowStep,
              ),
        },
      );

    await tx.manageEmployee.update({
      where: {
        id: employee.id,
      },

      data: {
        onboardingApprovalStatus:
          'PENDING',
      },
    });

    return result;
  }

  /*
   * ============================================================
   * ATTENDANCE REGULARISATION
   * ============================================================
   *
   * Called by EmpAttendanceRegulariseService.create().
   *
   * Workflow:
   * ATTENDANCE_MODULE
   * -> same company
   * -> exact branch first, company-wide fallback
   * -> effectiveFrom <= submission time
   * -> evaluate conditions
   * -> no match = direct Approved
   * -> match = ApprovalRequest + Steps + Approvers
   */
  async submitAttendanceRegularisation(
    tx: TransactionClient,
    regularisation:
      AttendanceRegularisationApprovalSubject,
    submittedByUserID?: number | null,
  ): Promise<ApprovalSubmissionResult> {
    if (!regularisation.companyID) {
      throw new BadRequestException(
        'Company is required before resolving attendance regularisation approval',
      );
    }

    if (
      !Number.isInteger(
        regularisation.manageEmployeeID,
      ) ||
      regularisation.manageEmployeeID <= 0
    ) {
      throw new BadRequestException(
        'A valid employee is required before resolving attendance regularisation approval',
      );
    }

    const subject: WorkflowSubject = {
      serviceProviderID:
        regularisation.serviceProviderID,

      companyID:
        regularisation.companyID,

      branchesID:
        regularisation.branchesID,

      employeeID:
        regularisation.manageEmployeeID,

      departmentID:
        regularisation.departmentID,

      designationID:
        regularisation.designationID,

      requestedStatus:
        regularisation.requestedStatus,

      regularisationDays:
        regularisation.regularisationDays,
    };

    const workflow =
      await this.resolveMatchingWorkflow(
        tx,
        this.ATTENDANCE_MODULE_KEY,
        subject,
        new Date(),
      );

    if (!workflow) {
      return {
        approvalRequired: false,
        approvalRequestID: null,
        workflowID: null,
        workflowName: null,
        currentStepNo: null,
        status: 'APPROVED',
      };
    }

    if (!workflow.steps.length) {
      throw new BadRequestException(
        `Workflow "${workflow.workflowName}" has no approval steps`,
      );
    }

    return this.createApprovalRequest(
      tx,
      workflow,
      subject,
      {
        subjectType:
          'ATTENDANCE_REGULARISATION',

        subjectID:
          regularisation.id,

        subjectEmployeeID:
          regularisation.manageEmployeeID,

        submittedByUserID:
          submittedByUserID ?? null,

        approverResolver:
          async (
            workflowStep: any,
          ) =>
            this.findAttendanceApprovers(
              tx,
              subject,
              workflowStep,
            ),
      },
    );
  }

  /*
   * ============================================================
   * WORKFLOW RESOLUTION
   * ============================================================
   */
  private async resolveMatchingWorkflow(
    tx: TransactionClient,
    moduleKey: string,
    subject: WorkflowSubject,
    effectiveAt: Date,
  ) {
    const workflows =
      await tx.approvalWorkflow.findMany({
        where: {
          companyID:
            subject.companyID,

          workflowStatus:
            true,

          effectiveFrom: {
            lte:
              effectiveAt,
          },

          companyModule: {
            moduleKey,
            moduleStatus:
              true,
          },

          AND: [
            {
              OR:
                subject.branchesID != null
                  ? [
                      {
                        branchesID:
                          subject.branchesID,
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
              OR:
                subject.serviceProviderID != null
                  ? [
                      {
                        serviceProviderID:
                          subject.serviceProviderID,
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
              stepNo:
                'asc',
            },
          },

          conditions: {
            where: {
              isActive:
                true,
            },

            include: {
              employees: {
                select: {
                  manageEmployeeID:
                    true,
                },
              },
            },

            orderBy: {
              conditionNo:
                'asc',
            },
          },
        },
      });

    /*
     * Exact branch workflow gets priority.
     * Company-wide branchesID=null is fallback.
     */
    const sortedWorkflows =
      [...workflows].sort(
        (a, b) => {
          const aExact =
            subject.branchesID != null &&
            a.branchesID != null &&
            Number(
              a.branchesID,
            ) ===
              Number(
                subject.branchesID,
              );

          const bExact =
            subject.branchesID != null &&
            b.branchesID != null &&
            Number(
              b.branchesID,
            ) ===
              Number(
                subject.branchesID,
              );

          if (aExact !== bExact) {
            return aExact
              ? -1
              : 1;
          }

          const effectiveDifference =
            b.effectiveFrom.getTime() -
            a.effectiveFrom.getTime();

          if (
            effectiveDifference !==
            0
          ) {
            return effectiveDifference;
          }

          return b.id - a.id;
        },
      );

    for (const workflow of sortedWorkflows) {
      if (
        this.workflowConditionsMatch(
          workflow.conditionMatchType,
          workflow.conditions,
          subject,
        )
      ) {
        return workflow;
      }
    }

    return null;
  }

  /*
   * No active conditions means the workflow does not trigger
   * conditional approval.
   */
  private workflowConditionsMatch(
    matchType:
      WorkflowConditionMatchType,
    conditions:
      Array<any>,
    subject:
      WorkflowSubject,
  ): boolean {
    if (!conditions.length) {
      return false;
    }

    const results =
      conditions.map(
        (condition) =>
          this.conditionMatches(
            condition,
            subject,
          ),
      );

    if (
      matchType ===
      WorkflowConditionMatchType.ANY
    ) {
      return results.some(
        Boolean,
      );
    }

    return results.every(
      Boolean,
    );
  }

  private conditionMatches(
    condition: any,
    subject:
      WorkflowSubject,
  ): boolean {
    switch (
      condition.fieldKey
    ) {
      case 'BRANCH':
        return this.compareEquality(
          subject.branchesID,
          condition.branchesID,
          condition.operator,
        );

      case 'DEPARTMENT':
        return this.compareEquality(
          subject.departmentID,
          condition.departmentID,
          condition.operator,
        );

      case 'DESIGNATION':
        return this.compareEquality(
          subject.designationID,
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
                  (
                    id: number,
                  ) =>
                    Number.isInteger(
                      id,
                    ) &&
                    id > 0,
                )
            : [];

        const included =
          selectedEmployeeIDs.includes(
            subject.employeeID,
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

      case 'REGULARISATION_TYPE': {
        const actual =
          this.normalizeTextValue(
            subject.requestedStatus,
          );

        if (
          condition.operator ===
          'IN' ||
          condition.operator ===
          'NOT_IN'
        ) {
          const values =
            String(
              condition.textValue ??
              '',
            )
              .split(',')
              .map(
                (value) =>
                  this.normalizeTextValue(
                    value,
                  ),
              )
              .filter(
                Boolean,
              );

          const included =
            values.includes(
              actual,
            );

          return condition.operator ===
            'IN'
            ? included
            : !included;
        }

        const expected =
          this.normalizeTextValue(
            condition.textValue,
          );

        if (
          condition.operator ===
          'EQUALS'
        ) {
          return (
            actual ===
            expected
          );
        }

        if (
          condition.operator ===
          'NOT_EQUALS'
        ) {
          return (
            actual !==
            expected
          );
        }

        return false;
      }

      case 'REGULARISATION_DAYS':
        return this.compareNumber(
          Number(
            subject.regularisationDays ??
            0,
          ),
          condition,
        );

      /*
       * These belong to other modules and do not participate
       * in Attendance/Onboarding workflow matching here.
       */
      default:
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
    if (
      actualValue == null ||
      expectedValue == null
    ) {
      return false;
    }

    const equal =
      Number(
        actualValue,
      ) ===
      Number(
        expectedValue,
      );

    if (
      operator ===
      'EQUALS'
    ) {
      return equal;
    }

    if (
      operator ===
      'NOT_EQUALS'
    ) {
      return !equal;
    }

    return false;
  }

  private compareNumber(
    actual:
      number,
    condition:
      any,
  ): boolean {
    const first =
      Number(
        condition.numberValue,
      );

    if (
      !Number.isFinite(
        first,
      )
    ) {
      return false;
    }

    switch (
      condition.operator
    ) {
      case 'EQUALS':
        return (
          actual === first
        );

      case 'NOT_EQUALS':
        return (
          actual !== first
        );

      case 'GREATER_THAN':
        return (
          actual > first
        );

      case 'GREATER_THAN_OR_EQUAL':
        return (
          actual >= first
        );

      case 'LESS_THAN':
        return (
          actual < first
        );

      case 'LESS_THAN_OR_EQUAL':
        return (
          actual <= first
        );

      case 'BETWEEN': {
        const second =
          Number(
            condition.numberValueTo,
          );

        return (
          Number.isFinite(
            second,
          ) &&
          actual >= first &&
          actual <= second
        );
      }

      default:
        return false;
    }
  }

  private normalizeTextValue(
    value:
      unknown,
  ): string {
    return String(
      value ??
      '',
    )
      .trim()
      .toUpperCase()
      .replace(
        /[^A-Z0-9]+/g,
        '_',
      )
      .replace(
        /^_+|_+$/g,
        '',
      );
  }

  /*
   * ============================================================
   * REQUEST / STEP / APPROVER CREATION
   * ============================================================
   */
  private async createApprovalRequest(
    tx: TransactionClient,
    workflow: any,
    subject:
      WorkflowSubject,
    options: {
      subjectType:
        string;

      subjectID:
        number;

      subjectEmployeeID:
        number;

      submittedByUserID:
        number | null;

      approverResolver:
        (
          workflowStep:
            any,
        ) =>
          Promise<
            ResolvedApprover[]
          >;
    },
  ): Promise<ApprovalSubmissionResult> {
    const workflowName =
      workflow.workflowName
        ?.trim();

    const moduleKey =
      workflow.companyModule
        ?.moduleKey
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

    const now =
      new Date();

    const approvalRequest =
      await tx.approvalRequest.create({
        data: {
          serviceProviderID:
            subject.serviceProviderID,

          companyID:
            subject.companyID,

          branchesID:
            subject.branchesID,

          approvalWorkflowID:
            workflow.id,

          companyModuleID:
            workflow.companyModuleID,

          subjectType:
            options.subjectType,

          subjectID:
            options.subjectID,

          subjectEmployeeID:
            options.subjectEmployeeID,

         status:
  ApprovalRequestStatus.PENDING,

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
            options.submittedByUserID,

          submittedAt:
            now,
        },
      });

    for (
      const workflowStep
      of workflow.steps
    ) {
      const approvers =
        await options.approverResolver(
          workflowStep,
        );

      if (
        !approvers.length
      ) {
        throw new BadRequestException(
          `No active approver was found for workflow step ${workflowStep.stepNo} "${
            workflowStep.stepName ??
            ''
          }"`,
        );
      }

      const anyMode =
        workflow
          .allowAnySameDesignation ===
        true;

      const isFirstStep =
        workflowStep.stepNo ===
        1;

      /*
       * Any mode:
       * every workflow step is actionable immediately.
       *
       * Sequential mode:
       * only Step 1 is active.
       */
      const stepIsActive =
        anyMode ||
        isFirstStep;

      /*
       * ApprovalRequestStep.designationID is required in your
       * current schema. REPORTING_MANAGER workflow steps may have
       * designationID=null, so snapshot the actual linked manager's
       * designation.
       */
      const snapshotDesignationID =
        workflowStep.designationID ??
        approvers[0]
          ?.designationID;

      if (
        snapshotDesignationID ==
        null
      ) {
        throw new BadRequestException(
          `Approver for workflow step ${workflowStep.stepNo} does not have a designation`,
        );
      }

      const designationName =
        workflowStep
          .designation
          ?.designation
          ?.trim() ||
        approvers[0]
          ?.designationName
          ?.trim() ||
        `Designation ${snapshotDesignationID}`;

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
              snapshotDesignationID,

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
  stepIsActive
    ? ApprovalStepStatus.PENDING
    : ApprovalStepStatus.WAITING,

            activatedAt:
              stepIsActive
                ? now
                : null,
          },
        });

      /*
       * IMPORTANT:
       *
       * allowAnySameDesignation=true:
       *   all eligible employees are PENDING immediately.
       *
       * false:
       *   Step 1 employee[0] = PENDING
       *   Step 1 employee[1..] = WAITING
       *   all later-step employees = WAITING
       *
       * Do NOT slice eligible approvers. ApprovalRequestService
       * needs the WAITING approver rows to activate Mayur -> Amit.
       */
     const approverRows:
  Prisma.ApprovalRequestApproverCreateManyInput[] =
  approvers.map(
    (
      approver,
      index,
    ) => {
      const approverActive =
        anyMode ||
        (
          isFirstStep &&
          index === 0
        );

      const approverDesignationID =
        approver.designationID ??
        snapshotDesignationID;

      if (
        approverDesignationID ==
        null
      ) {
        throw new BadRequestException(
          `Approver employee ${approver.id} does not have a designation`,
        );
      }

      const designationNameSnapshot =
        approver.designationName?.trim() ||
        designationName;

      if (
        !designationNameSnapshot
      ) {
        throw new BadRequestException(
          `Approver employee ${approver.id} does not have a valid designation name`,
        );
      }

      return {
        approvalRequestID:
          approvalRequest.id,

        approvalRequestStepID:
          requestStep.id,

        approverEmployeeID:
          approver.id,

        designationIDSnapshot:
          approverDesignationID,

        designationNameSnapshot,

        departmentIDSnapshot:
          approver.departmentNameID,

        branchesIDSnapshot:
          approver.branchesID,

        companyIDSnapshot:
          subject.companyID,

        status:
          approverActive
            ? ApprovalApproverStatus.PENDING
            : ApprovalApproverStatus.WAITING,

        activatedAt:
          approverActive
            ? now
            : null,
      };
    },
  );

await tx.approvalRequestApprover.createMany({
  data:
    approverRows,
});
      if (
        stepIsActive
      ) {
        await tx
          .approvalRequestAction
          .create({
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
                anyMode
                  ? `Approval step ${workflowStep.stepNo} activated in any-approver mode`
                  : `Approval step ${workflowStep.stepNo} activated`,
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
          options.submittedByUserID,

        remark:
          `${workflowName} submitted for approval`,
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
      status: 'PENDING',
    };
  }

  /*
   * ============================================================
   * ATTENDANCE APPROVER RESOLUTION
   * ============================================================
   */
  private async findAttendanceApprovers(
    tx: TransactionClient,
    subject:
      WorkflowSubject,
    workflowStep:
      any,
  ): Promise<ResolvedApprover[]> {
    const approverType =
      String(
        workflowStep.approverType ??
        'DESIGNATION',
      )
        .trim()
        .toUpperCase();

    if (
      approverType ===
      'REPORTING_MANAGER'
    ) {
      return this.findReportingManagerApprovers(
        tx,
        subject,
        workflowStep,
      );
    }

    if (
      approverType ===
      'DESIGNATION'
    ) {
      return this.findDesignationApprovers(
        tx,
        subject,
        workflowStep,
      );
    }

    throw new BadRequestException(
      `Unsupported approver type "${workflowStep.approverType}" at workflow step ${workflowStep.stepNo}`,
    );
  }

  /*
   * REPORTING_MANAGER
   *
   * EmployeeLink:
   * employeeId       = request employee
   * linkedEmployeeId = actual manager
   *
   * This is exactly the source behind:
   * GET /manage-emp/{employeeId}/linked-employees
   */
  private async findReportingManagerApprovers(
    tx: TransactionClient,
    subject:
      WorkflowSubject,
    workflowStep:
      any,
  ): Promise<ResolvedApprover[]> {
    const links =
      await tx.employeeLink.findMany({
        where: {
          employeeId:
            subject.employeeID,
        },

        select: {
          linkedEmployeeId:
            true,
        },

        orderBy: {
          id:
            'asc',
        },
      });

    const managerIDs =
      Array.from(
        new Set(
          links
            .map(
              (link) =>
                Number(
                  link.linkedEmployeeId,
                ),
            )
            .filter(
              (id) =>
                Number.isInteger(
                  id,
                ) &&
                id > 0 &&
                id !==
                  subject.employeeID,
            ),
        ),
      );

    if (
      !managerIDs.length
    ) {
      return [];
    }

    const managers =
      await tx.manageEmployee.findMany({
        where: {
          id: {
            in:
              managerIDs,
          },

          companyID:
            subject.companyID,

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

          /*
           * Manager gets priority only when the actual EmployeeLink
           * exists. If workflow also specifies a designation,
           * that linked manager must match it.
           */
          ...(workflowStep.designationID !=
          null
            ? {
                OR: [
                  {
                    designationID:
                      workflowStep
                        .designationID,
                  },

                  {
                    empDesignation: {
                      some: {
                        designationID:
                          workflowStep
                            .designationID,
                      },
                    },
                  },
                ],
              }
            : {}),
        },

        select: {
          id: true,
          companyID: true,
          branchesID: true,
          departmentNameID: true,
          designationID: true,

          designations: {
            select: {
              designation:
                true,
            },
          },
        },

        orderBy: {
          id:
            'asc',
        },
      });

    return managers
      .filter(
        (manager) =>
          manager
            .designationID !=
          null,
      )
      .map(
        (manager) => ({
          id:
            manager.id,

          companyID:
            manager.companyID,

          branchesID:
            manager.branchesID,

          departmentNameID:
            manager.departmentNameID,

          designationID:
            manager.designationID,

          designationName:
            manager
              .designations
              ?.designation
              ?.trim() ||
            workflowStep
              .designation
              ?.designation
              ?.trim() ||
            `Designation ${manager.designationID}`,
        }),
      );
  }

  /*
   * DESIGNATION
   *
   * Manager mapping is irrelevant.
   *
   * All active, approved employees in the workflow company
   * with step.designationID are candidates.
   */
  private async findDesignationApprovers(
    tx: TransactionClient,
    subject:
      WorkflowSubject,
    workflowStep:
      any,
  ): Promise<ResolvedApprover[]> {
    const designationID =
      workflowStep.designationID;

    if (
      designationID ==
      null
    ) {
      throw new BadRequestException(
        `Designation is required for DESIGNATION approver at step ${workflowStep.stepNo}`,
      );
    }

    const employees =
      await tx.manageEmployee.findMany({
        where: {
          companyID:
            subject.companyID,

          id: {
            not:
              subject.employeeID,
          },

          OR: [
            {
              designationID,
            },

            {
              empDesignation: {
                some: {
                  designationID,
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

          designations: {
            select: {
              designation:
                true,
            },
          },
        },

        orderBy: {
          id:
            'asc',
        },
      });

    return employees
      .map(
        (employee) => {
          /*
           * Usually designationID is directly populated.
           * If your application uses EmpDesignation only,
           * the engine still matched the employee through OR above.
           * Snapshot uses the workflow designation ID.
           */
          const resolvedDesignationID =
            employee.designationID ??
            designationID;

          return {
            id:
              employee.id,

            companyID:
              employee.companyID,

            branchesID:
              employee.branchesID,

            departmentNameID:
              employee.departmentNameID,

            designationID:
              resolvedDesignationID,

            designationName:
              employee
                .designations
                ?.designation
                ?.trim() ||
              workflowStep
                .designation
                ?.designation
                ?.trim() ||
              `Designation ${designationID}`,
          };
        },
      );
  }

  /*
   * ============================================================
   * ONBOARDING APPROVER RESOLUTION
   * ============================================================
   *
   * Keep your existing behavior:
   * 1. COMPANY_ADMIN-linked employees first when available.
   * 2. Otherwise use workflow step REPORTING_MANAGER/DESIGNATION.
   */
  private async findOnboardingApprovers(
    tx: TransactionClient,
    subject:
      WorkflowSubject,
    workflowStep:
      any,
  ): Promise<ResolvedApprover[]> {
    const companyAdminUsers =
      await tx.user.findMany({
        where: {
          role:
            'COMPANY_ADMIN',

          isActive:
            true,

          OR: [
            {
              companyID:
                subject.companyID,
            },

            {
              userCompanies: {
                some: {
                  companyID:
                    subject.companyID,
                },
              },
            },
          ],
        },

        select: {
          username:
            true,
        },
      });

    const usernames =
      companyAdminUsers
        .map(
          (user) =>
            user.username
              ?.trim(),
        )
        .filter(
          (
            username,
          ): username is string =>
            Boolean(
              username,
            ),
        );

    if (
      usernames.length
    ) {
      const admins =
        await tx.manageEmployee.findMany({
          where: {
            companyID:
              subject.companyID,

            id: {
              not:
                subject.employeeID,
            },

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

                username: {
                  in:
                    usernames,
                },
              },
            },
          },

          select: {
            id: true,
            companyID: true,
            branchesID: true,
            departmentNameID: true,
            designationID: true,

            designations: {
              select: {
                designation:
                  true,
              },
            },
          },

          orderBy: {
            id:
              'asc',
          },
        });

      const resolvedAdmins =
        admins
          .filter(
            (employee) =>
              employee
                .designationID !=
              null,
          )
          .map(
            (employee) => ({
              id:
                employee.id,

              companyID:
                employee.companyID,

              branchesID:
                employee.branchesID,

              departmentNameID:
                employee.departmentNameID,

              designationID:
                employee.designationID,

              designationName:
                employee
                  .designations
                  ?.designation
                  ?.trim() ||
                `Designation ${employee.designationID}`,
            }),
          );

      if (
        resolvedAdmins.length
      ) {
        return resolvedAdmins;
      }
    }

    const approverType =
      String(
        workflowStep.approverType ??
        'DESIGNATION',
      )
        .trim()
        .toUpperCase();

    if (
      approverType ===
      'REPORTING_MANAGER'
    ) {
      return this.findReportingManagerApprovers(
        tx,
        subject,
        workflowStep,
      );
    }

    return this.findDesignationApprovers(
      tx,
      subject,
      workflowStep,
    );
  }
}
