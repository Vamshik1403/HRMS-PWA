import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ApprovalActionType,
  ApprovalApproverStatus,
  ApprovalRequestStatus,
  ApprovalRequirement,
  ApprovalStepStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ApproveApprovalRequestDto } from './dto/approve-approval-request.dto';
import { RejectApprovalRequestDto } from './dto/reject-approval-request.dto';

type TransactionClient = Prisma.TransactionClient;

export interface ApprovalRequestActor {
  userID: number | null;
  employeeID: number;

  companyID: number | null;
  branchesID: number | null;

  username: string | null;
}

type RuntimeApprovalRequest = {
  id: number;
  companyID: number;
  branchesID: number | null;
  subjectType: string;
  subjectID: number;
  subjectEmployeeID: number | null;
  status: ApprovalRequestStatus;
  currentStepNo: number | null;
  allowAnySameDesignationSnapshot: boolean;
};

@Injectable()
export class ApprovalRequestService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Returns only currently active approval assignments
   * belonging to the logged-in employee.
   */
  async getMyPendingApprovals(
    actor: ApprovalRequestActor,
  ) {
    const rows =
      await this.prisma.approvalRequestApprover.findMany({
        where: {
          approverEmployeeID: actor.employeeID,

          status: {
            in: [
              ApprovalApproverStatus.PENDING,
              ApprovalApproverStatus.WAITING,
            ],
          },

          approvalRequest: {
            status: ApprovalRequestStatus.PENDING,
          },

          approvalRequestStep: {
            status: {
              in: [
                ApprovalStepStatus.PENDING,
                ApprovalStepStatus.WAITING,
              ],
            },
          },
        },

        select: {
          id: true,
          approvalRequestID: true,
          approvalRequestStepID: true,
          approverEmployeeID: true,

          status: true,
          activatedAt: true,
          actedAt: true,
          comment: true,

          designationIDSnapshot: true,
          designationNameSnapshot: true,
          departmentIDSnapshot: true,
          branchesIDSnapshot: true,
          companyIDSnapshot: true,

          approvalRequest: {
            select: {
              id: true,
              serviceProviderID: true,
              companyID: true,
              branchesID: true,
              approvalWorkflowID: true,
              companyModuleID: true,
              subjectType: true,
              subjectID: true,
              subjectEmployeeID: true,
              status: true,
              currentStepNo: true,
              workflowNameSnapshot: true,
              moduleKeySnapshot: true,
              conditionMatchTypeSnapshot: true,
              allowAnySameDesignationSnapshot: true,
              submittedByUserID: true,
              submittedAt: true,
              createdAt: true,
              updatedAt: true,

              subjectEmployee: {
                select: {
                  id: true,
                  employeeID: true,
                  employeeFirstName: true,
                  employeeLastName: true,
                  serviceProviderID: true,
                  companyID: true,
                  branchesID: true,
                  departmentNameID: true,
                  designationID: true,
                  onboardingApprovalStatus: true,
                  lifecycleStatus: true,
                },
              },

              companyModule: {
                select: {
                  id: true,
                  moduleKey: true,
                  moduleName: true,
                },
              },
            },
          },

          approvalRequestStep: {
            select: {
              id: true,
              approvalRequirementSnapshot:true,
              stepNo: true,
              designationID: true,
              stepNameSnapshot: true,
              designationNameSnapshot: true,
              isMandatorySnapshot: true,
              canRejectSnapshot: true,
              canSendBackSnapshot: true,
              approvalTimeoutSnapshot: true,
              status: true,
              activatedAt: true,
            },
          },
        },

        orderBy: [
          { activatedAt: 'asc' },
          { id: 'asc' },
        ],
      });

    return rows.filter((row) => {
      const request = row.approvalRequest;
      const step = row.approvalRequestStep;

      if (
        request.allowAnySameDesignationSnapshot === true
      ) {
        return (
          request.status === ApprovalRequestStatus.PENDING &&
          (row.status === ApprovalApproverStatus.PENDING ||
            row.status === ApprovalApproverStatus.WAITING) &&
          (step.status === ApprovalStepStatus.PENDING ||
            step.status === ApprovalStepStatus.WAITING)
        );
      }

      return (
        request.status === ApprovalRequestStatus.PENDING &&
        request.currentStepNo === step.stepNo &&
        step.status === ApprovalStepStatus.PENDING &&
        row.status === ApprovalApproverStatus.PENDING
      );
    });
  }

  /**
   * Persistent approval inbox/history.
   *
   * Unlike /my-pending, this endpoint NEVER drops an assignment merely
   * because the employee already acted or the request reached a final state.
   *
   * Use this endpoint for table visibility/history.
   * Use /my-pending only for actionable Approve/Reject buttons.
   */
  async getMyAssignedApprovals(
    actor: ApprovalRequestActor,
  ) {
    return this.prisma.approvalRequestApprover.findMany({
      where: {
        approverEmployeeID: actor.employeeID,
      },

      select: {
        id: true,
        approvalRequestID: true,
        approvalRequestStepID: true,
        approverEmployeeID: true,

        status: true,
        activatedAt: true,
        actedAt: true,
        comment: true,

        designationIDSnapshot: true,
        designationNameSnapshot: true,
        departmentIDSnapshot: true,
        branchesIDSnapshot: true,
        companyIDSnapshot: true,

        approvalRequest: {
          select: {
            id: true,

            serviceProviderID: true,
            companyID: true,
            branchesID: true,

            approvalWorkflowID: true,
            companyModuleID: true,

            subjectType: true,
            subjectID: true,
            subjectEmployeeID: true,

            status: true,
            currentStepNo: true,

            workflowNameSnapshot: true,
            moduleKeySnapshot: true,
            conditionMatchTypeSnapshot: true,
            allowAnySameDesignationSnapshot: true,

            submittedByUserID: true,
            submittedAt: true,
            completedAt: true,
            rejectedAt: true,
            cancelledAt: true,
            finalRemark: true,

            createdAt: true,
            updatedAt: true,

            subjectEmployee: {
              select: {
                id: true,
                employeeID: true,
                employeeFirstName: true,
                employeeLastName: true,

                serviceProviderID: true,
                companyID: true,
                branchesID: true,

                departmentNameID: true,
                designationID: true,

                onboardingApprovalStatus: true,
                lifecycleStatus: true,
              },
            },

            companyModule: {
              select: {
                id: true,
                moduleKey: true,
                moduleName: true,
              },
            },
          },
        },

        approvalRequestStep: {
          select: {
            id: true,
            stepNo: true,
            designationID: true,
 approvalRequirementSnapshot:true,
            stepNameSnapshot: true,
            designationNameSnapshot: true,

            isMandatorySnapshot: true,
            canRejectSnapshot: true,
            canSendBackSnapshot: true,
            approvalTimeoutSnapshot: true,

            status: true,
            activatedAt: true,
            completedAt: true,
            rejectedAt: true,
            sentBackAt: true,
          },
        },
      },

      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
    });
  }

  async getMyPendingCount(
    actor: ApprovalRequestActor,
  ) {
    const rows = await this.getMyPendingApprovals(actor);

    return {
      count: rows.length,
    };
  }

  async getMyHistory(
    actor: ApprovalRequestActor,
  ) {
    return this.prisma.approvalRequestAction.findMany({
      where: {
        actedByEmployeeID: actor.employeeID,

        action: {
          in: [
            ApprovalActionType.APPROVED,
            ApprovalActionType.REJECTED,
            ApprovalActionType.SENT_BACK,
          ],
        },
      },

      select: {
        id: true,
        approvalRequestID: true,
        approvalRequestStepID: true,
        approvalRequestApproverID: true,

        action: true,
        fromStatus: true,
        toStatus: true,
        remark: true,
        createdAt: true,

        approvalRequest: {
          select: {
            id: true,
            companyID: true,
            branchesID: true,

            subjectType: true,
            subjectID: true,
            subjectEmployeeID: true,

            status: true,
            currentStepNo: true,

            workflowNameSnapshot: true,
            moduleKeySnapshot: true,

            submittedAt: true,
            completedAt: true,
            rejectedAt: true,

            subjectEmployee: {
              select: {
                id: true,
                employeeID: true,
                employeeFirstName: true,
                employeeLastName: true,
              },
            },
          },
        },

        approvalRequestStep: {
          select: {
            id: true,
             approvalRequirementSnapshot:true,
            stepNo: true,
            stepNameSnapshot: true,
            designationNameSnapshot: true,
            status: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Returns complete request details only when the logged-in
   * employee is assigned to that approval request.
   */
  async findOneForApprover(
    requestID: number,
    actor: ApprovalRequestActor,
  ) {
    const assignment =
      await this.prisma.approvalRequestApprover.findFirst({
        where: {
          approvalRequestID: requestID,
          approverEmployeeID: actor.employeeID,
        },

        select: {
          id: true,
          status: true,
          activatedAt: true,
          actedAt: true,
          comment: true,

          approvalRequestStep: {
            select: {
              id: true,
              stepNo: true,
              designationID: true,
 approvalRequirementSnapshot:true,
              stepNameSnapshot: true,
              designationNameSnapshot: true,

              isMandatorySnapshot: true,
              canRejectSnapshot: true,
              canSendBackSnapshot: true,

              status: true,
              activatedAt: true,
              completedAt: true,
              rejectedAt: true,
            },
          },

          approvalRequest: {
            select: {
              id: true,

              serviceProviderID: true,
              companyID: true,
              branchesID: true,

              approvalWorkflowID: true,
              companyModuleID: true,

              subjectType: true,
              subjectID: true,
              subjectEmployeeID: true,

              status: true,
              currentStepNo: true,

              workflowNameSnapshot: true,
              moduleKeySnapshot: true,
              conditionMatchTypeSnapshot: true,
              allowAnySameDesignationSnapshot: true,

              submittedByUserID: true,
              submittedAt: true,

              completedAt: true,
              rejectedAt: true,
              cancelledAt: true,

              finalRemark: true,

              createdAt: true,
              updatedAt: true,

              companyModule: {
                select: {
                  id: true,
                  moduleKey: true,
                  moduleName: true,
                },
              },

              subjectEmployee: {
                select: {
                  id: true,
                  employeeID: true,
                  employeeFirstName: true,
                  employeeLastName: true,

                  companyID: true,
                  branchesID: true,
                  departmentNameID: true,
                  designationID: true,

                  onboardingApprovalStatus: true,
                  lifecycleStatus: true,
                },
              },

              steps: {
                orderBy: {
                  stepNo: 'asc',
                },

                select: {
                  id: true,
                  stepNo: true,
                  designationID: true,

                  stepNameSnapshot: true,
                  designationNameSnapshot: true,

                  isMandatorySnapshot: true,
                  canRejectSnapshot: true,
                  canSendBackSnapshot: true,

                  status: true,
                  activatedAt: true,
                  completedAt: true,
                  rejectedAt: true,

                  approvers: {
                    select: {
                      id: true,
                      approverEmployeeID: true,
                      designationNameSnapshot: true,
                      status: true,
                      activatedAt: true,
                      actedAt: true,
                      comment: true,

                      approverEmployee: {
                        select: {
                          id: true,
                          employeeID: true,
                          employeeFirstName: true,
                          employeeLastName: true,
                        },
                      },
                    },
                  },
                },
              },

              actions: {
                orderBy: {
                  createdAt: 'asc',
                },

                select: {
                  id: true,
                  approvalRequestStepID: true,
                  approvalRequestApproverID: true,

                  action: true,
                  actedByEmployeeID: true,
                  actedByUserID: true,

                  fromStatus: true,
                  toStatus: true,
                  remark: true,
                  createdAt: true,

                  actedByEmployee: {
                    select: {
                      id: true,
                      employeeID: true,
                      employeeFirstName: true,
                      employeeLastName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!assignment) {
      throw new ForbiddenException(
        'This approval request is not assigned to the logged-in employee',
      );
    }

    const request =
      assignment.approvalRequest;

    const step =
      assignment.approvalRequestStep;

    const anyApproverMode =
      request.allowAnySameDesignationSnapshot === true;

    const canAct =
      request.status === ApprovalRequestStatus.PENDING &&
      (
        anyApproverMode
          ? (
              (
                [
                  ApprovalApproverStatus.PENDING,
                  ApprovalApproverStatus.WAITING,
                ] as ApprovalApproverStatus[]
              ).includes(assignment.status) &&
              (
                [
                  ApprovalStepStatus.PENDING,
                  ApprovalStepStatus.WAITING,
                ] as ApprovalStepStatus[]
              ).includes(step.status)
            )
          : (
              assignment.status ===
                ApprovalApproverStatus.PENDING &&
              step.status ===
                ApprovalStepStatus.PENDING &&
              request.currentStepNo ===
                step.stepNo
            )
      );

    return {
      ...request,

      currentAssignment: {
        id: assignment.id,
        status: assignment.status,
        activatedAt: assignment.activatedAt,
        actedAt: assignment.actedAt,
        comment: assignment.comment,
      },

      assignedStep:
        step,

      permissions: {
        canApprove: canAct,

        canReject:
          canAct &&
          step.canRejectSnapshot,

        canSendBack:
          canAct &&
          step.canSendBackSnapshot,
      },
    };
  }

  async approve(
    requestID: number,
    actor: ApprovalRequestActor,
    dto: ApproveApprovalRequestDto,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const {
            request,
            currentStep,
            assignment,
          } = await this.getActiveAssignment(
            tx,
            requestID,
            actor,
          );

          const now = new Date();
          const remark = dto.remark?.trim() || null;

          const assignmentUpdate =
            await tx.approvalRequestApprover.updateMany({
              where: {
                id: assignment.id,

                status: {
                  in: [
                    ApprovalApproverStatus.PENDING,
                    ApprovalApproverStatus.WAITING,
                  ],
                },
              },

              data: {
                status: ApprovalApproverStatus.APPROVED,
                actedAt: now,
                comment: remark,
              },
            });

          if (assignmentUpdate.count !== 1) {
            throw new ConflictException(
              'This approval assignment has already been processed',
            );
          }

          await tx.approvalRequestAction.create({
            data: {
              approvalRequestID: request.id,
              approvalRequestStepID: currentStep.id,
              approvalRequestApproverID: assignment.id,
              action: ApprovalActionType.APPROVED,
              actedByEmployeeID: actor.employeeID,
              actedByUserID: actor.userID,
              fromStatus: assignment.status,
              toStatus: ApprovalApproverStatus.APPROVED,
              remark,
            },
          });

        /*
 * ==========================================================
 * PER-STEP APPROVAL REQUIREMENT
 * ==========================================================
 */

const requirement =
  currentStep.approvalRequirementSnapshot ??
  ApprovalRequirement.ANY;

/*
 * ANY
 *
 * First approval completes THIS STEP.
 */
if (
  requirement ===
  ApprovalRequirement.ANY
) {
  /*
   * Remaining peers in this step no longer need to act.
   */
  await tx.approvalRequestApprover.updateMany({
    where: {
      approvalRequestStepID:
        currentStep.id,

      id: {
        not:
          assignment.id,
      },

      status:
        ApprovalApproverStatus.PENDING,
    },

    data: {
      status:
        ApprovalApproverStatus.SKIPPED,

      actedAt:
        now,

      comment:
        'Step completed by another eligible approver',
    },
  });
}

/*
 * ALL
 *
 * Every assigned employee in this step must approve.
 */
if (
  requirement ===
  ApprovalRequirement.ALL
) {
  const remainingApprovers =
    await tx.approvalRequestApprover.count({
      where: {
        approvalRequestStepID:
          currentStep.id,

        status:
          ApprovalApproverStatus.PENDING,
      },
    });

  if (
    remainingApprovers > 0
  ) {
    return {
      success:
        true,

      requestID:
        request.id,

      status:
        ApprovalRequestStatus.PENDING,

      completed:
        false,

      currentStepNo:
        currentStep.stepNo,

      message:
        `Approval recorded. Waiting for ${remainingApprovers} remaining approver(s) in this step.`,
    };
  }
}

/*
 * ANY reached here:
 * one approver approved.
 *
 * ALL reached here:
 * everybody approved.
 *
 * Therefore the step is now complete.
 */
const stepUpdate =
  await tx.approvalRequestStep.updateMany({
    where: {
      id:
        currentStep.id,

      status:
        ApprovalStepStatus.PENDING,
    },

    data: {
      status:
        ApprovalStepStatus.APPROVED,

      completedAt:
        now,
    },
  });

if (
  stepUpdate.count !== 1
) {
  throw new ConflictException(
    'The current approval step has already been processed',
  );
}

await tx.approvalRequestAction.create({
  data: {
    approvalRequestID:
      request.id,

    approvalRequestStepID:
      currentStep.id,

    approvalRequestApproverID:
      assignment.id,

    action:
      ApprovalActionType.STEP_COMPLETED,

    actedByEmployeeID:
      actor.employeeID,

    actedByUserID:
      actor.userID,

    fromStatus:
      ApprovalStepStatus.PENDING,

    toStatus:
      ApprovalStepStatus.APPROVED,

    remark:
      requirement ===
      ApprovalRequirement.ANY
        ? `Step ${currentStep.stepNo} completed by one eligible approver`
        : `All approvers completed step ${currentStep.stepNo}`,
  },
});

          const nextStep =
            await tx.approvalRequestStep.findFirst({
              where: {
                approvalRequestID: request.id,

                stepNo: {
                  gt: currentStep.stepNo,
                },

                status: ApprovalStepStatus.WAITING,
              },

              orderBy: {
                stepNo: 'asc',
              },
            });

          if (nextStep) {
            await this.activateNextStep(
              tx,
              request.id,
              nextStep.id,
              nextStep.stepNo,
              actor,
              now,
            );

            return {
              success: true,
              requestID: request.id,
              status: ApprovalRequestStatus.PENDING,
              completed: false,
              currentStepNo: nextStep.stepNo,
              message:
                `Step ${currentStep.stepNo} completed. Step ${nextStep.stepNo} activated.`,
            };
          }

          await this.completeApprovalRequest(
            tx,
            request,
            currentStep.id,
            assignment.id,
            actor,
            remark,
            now,
          );

          return {
            success: true,
            requestID: request.id,
            status: ApprovalRequestStatus.APPROVED,
            completed: true,
            currentStepNo: null,
            message:
              'All required approvals completed successfully',
          };
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      this.handleTransactionError(error);
    }
  }

  async reject(
    requestID: number,
    actor: ApprovalRequestActor,
    dto: RejectApprovalRequestDto,
  ) {
    const remark = dto.remark.trim();

    if (!remark) {
      throw new BadRequestException(
        'Rejection reason is required',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const {
            request,
            currentStep,
            assignment,
          } = await this.getActiveAssignment(
            tx,
            requestID,
            actor,
          );

          if (!currentStep.canRejectSnapshot) {
            throw new BadRequestException(
              'Rejection is not allowed for this approval step',
            );
          }

          const now = new Date();

          const assignmentUpdate =
            await tx.approvalRequestApprover.updateMany({
              where: {
                id: assignment.id,

                status: {
                  in: [
                    ApprovalApproverStatus.PENDING,
                    ApprovalApproverStatus.WAITING,
                  ],
                },
              },

              data: {
                status: ApprovalApproverStatus.REJECTED,
                actedAt: now,
                comment: remark,
              },
            });

          if (assignmentUpdate.count !== 1) {
            throw new ConflictException(
              'This approval assignment has already been processed',
            );
          }

          await tx.approvalRequestApprover.updateMany({
            where: {
              approvalRequestID: request.id,
              id: { not: assignment.id },

              status: {
                in: [
                  ApprovalApproverStatus.PENDING,
                  ApprovalApproverStatus.WAITING,
                ],
              },
            },

            data: {
              status: ApprovalApproverStatus.CANCELLED,
              actedAt: now,
              comment:
                'Approval request was rejected',
            },
          });

          await tx.approvalRequestStep.update({
            where: {
              id: currentStep.id,
            },

            data: {
              status: ApprovalStepStatus.REJECTED,
              rejectedAt: now,
              completedAt: now,
            },
          });

          await tx.approvalRequestStep.updateMany({
            where: {
              approvalRequestID: request.id,
              id: { not: currentStep.id },

              status: {
                in: [
                  ApprovalStepStatus.PENDING,
                  ApprovalStepStatus.WAITING,
                ],
              },
            },

            data: {
              status: ApprovalStepStatus.CANCELLED,
              completedAt: now,
            },
          });

          const requestUpdate =
            await tx.approvalRequest.updateMany({
              where: {
                id: request.id,
                status: ApprovalRequestStatus.PENDING,
              },

              data: {
                status: ApprovalRequestStatus.REJECTED,
                currentStepNo: null,
                rejectedAt: now,
                completedAt: now,
                finalRemark: remark,
              },
            });

          if (requestUpdate.count !== 1) {
            throw new ConflictException(
              'The approval request has already been processed',
            );
          }

          await tx.approvalRequestAction.create({
            data: {
              approvalRequestID: request.id,
              approvalRequestStepID: currentStep.id,
              approvalRequestApproverID: assignment.id,
              action: ApprovalActionType.REJECTED,
              actedByEmployeeID: actor.employeeID,
              actedByUserID: actor.userID,
              fromStatus: ApprovalRequestStatus.PENDING,
              toStatus: ApprovalRequestStatus.REJECTED,
              remark,
            },
          });

          await this.applySubjectOutcome(
            tx,
            request,
            'REJECTED',
          );

          return {
            success: true,
            requestID: request.id,
            status: ApprovalRequestStatus.REJECTED,
            completed: true,
            currentStepNo: null,
            message:
              'Approval request rejected successfully',
          };
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      this.handleTransactionError(error);
    }
  }

  private async getActiveAssignment(
    tx: TransactionClient,
    requestID: number,
    actor: ApprovalRequestActor,
  ) {
    const request =
      await tx.approvalRequest.findUnique({
        where: {
          id: requestID,
        },

        select: {
          id: true,
          companyID: true,
          branchesID: true,
          subjectType: true,
          subjectID: true,
          subjectEmployeeID: true,
          status: true,
          currentStepNo: true,
          allowAnySameDesignationSnapshot: true,
        },
      });

    if (!request) {
      throw new NotFoundException(
        'Approval request not found',
      );
    }

    if (
      request.status !==
      ApprovalRequestStatus.PENDING
    ) {
      throw new BadRequestException(
        `Approval request is already ${request.status}`,
      );
    }

    const anyApproverMode =
      request.allowAnySameDesignationSnapshot === true;

    let currentStep:
      | Awaited<
          ReturnType<
            typeof tx.approvalRequestStep.findFirst
          >
        >
      | null = null;

    let assignment:
      | Awaited<
          ReturnType<
            typeof tx.approvalRequestApprover.findFirst
          >
        >
      | null = null;

    if (anyApproverMode) {
      assignment =
        await tx.approvalRequestApprover.findFirst({
          where: {
            approvalRequestID: request.id,
            approverEmployeeID: actor.employeeID,

            status: {
              in: [
                ApprovalApproverStatus.PENDING,
                ApprovalApproverStatus.WAITING,
              ],
            },

            approvalRequestStep: {
              status: {
                in: [
                  ApprovalStepStatus.PENDING,
                  ApprovalStepStatus.WAITING,
                ],
              },
            },
          },

          orderBy: {
            id: 'asc',
          },
        });

      if (!assignment) {
        throw new ForbiddenException(
          'The logged-in employee is not an eligible approver for this request',
        );
      }

      currentStep =
        await tx.approvalRequestStep.findUnique({
          where: {
            id: assignment.approvalRequestStepID,
          },
        });
    } else {
      if (request.currentStepNo == null) {
        throw new BadRequestException(
          'Approval request has no active step',
        );
      }

      currentStep =
        await tx.approvalRequestStep.findFirst({
          where: {
            approvalRequestID: request.id,
            stepNo: request.currentStepNo,
            status: ApprovalStepStatus.PENDING,
          },
        });

      if (!currentStep) {
        throw new BadRequestException(
          'The current approval step is not active',
        );
      }

      assignment =
        await tx.approvalRequestApprover.findFirst({
          where: {
            approvalRequestID: request.id,
            approvalRequestStepID: currentStep.id,
            approverEmployeeID: actor.employeeID,
            status: ApprovalApproverStatus.PENDING,
          },
        });

      if (!assignment) {
        throw new ForbiddenException(
          'The logged-in employee is not the active approver for this request',
        );
      }
    }

    if (!assignment || !currentStep) {
      throw new ForbiddenException(
        'No active approval assignment was found',
      );
    }

    if (
      request.subjectEmployeeID != null &&
      Number(request.subjectEmployeeID) ===
        Number(actor.employeeID)
    ) {
      throw new ForbiddenException(
        'Employees cannot approve their own request',
      );
    }

    if (
      actor.companyID != null &&
      Number(request.companyID) !==
        Number(actor.companyID)
    ) {
      throw new ForbiddenException(
        'Approval request belongs to a different company',
      );
    }

    return {
      request:
        request as RuntimeApprovalRequest,

      currentStep,
      assignment,
    };
  }

 private async activateNextStep(
  tx: TransactionClient,
  requestID: number,
  nextStepID: number,
  nextStepNo: number,
  actor: ApprovalRequestActor,
  now: Date,
) {
  const waitingApproverCount =
    await tx.approvalRequestApprover.count({
      where: {
        approvalRequestStepID:
          nextStepID,

        status:
          ApprovalApproverStatus.WAITING,
      },
    });

  if (
    waitingApproverCount === 0
  ) {
    throw new BadRequestException(
      `No approver is assigned to approval step ${nextStepNo}`,
    );
  }

  const stepUpdate =
    await tx.approvalRequestStep.updateMany({
      where: {
        id:
          nextStepID,

        status:
          ApprovalStepStatus.WAITING,
      },

      data: {
        status:
          ApprovalStepStatus.PENDING,

        activatedAt:
          now,
      },
    });

  if (
    stepUpdate.count !== 1
  ) {
    throw new ConflictException(
      'The next approval step could not be activated',
    );
  }

  /*
   * Activate EVERY eligible approver
   * belonging to the step.
   */
  await tx.approvalRequestApprover.updateMany({
    where: {
      approvalRequestStepID:
        nextStepID,

      status:
        ApprovalApproverStatus.WAITING,
    },

    data: {
      status:
        ApprovalApproverStatus.PENDING,

      activatedAt:
        now,
    },
  });

  await tx.approvalRequest.update({
    where: {
      id:
        requestID,
    },

    data: {
      currentStepNo:
        nextStepNo,
    },
  });

  await tx.approvalRequestAction.create({
    data: {
      approvalRequestID:
        requestID,

      approvalRequestStepID:
        nextStepID,

      action:
        ApprovalActionType.STEP_ACTIVATED,

      actedByEmployeeID:
        actor.employeeID,

      actedByUserID:
        actor.userID,

      fromStatus:
        ApprovalStepStatus.WAITING,

      toStatus:
        ApprovalStepStatus.PENDING,

      remark:
        `Approval step ${nextStepNo} activated for ${waitingApproverCount} eligible approver(s)`,
    },
  });
}

  private async completeApprovalRequest(
    tx: TransactionClient,
    request: RuntimeApprovalRequest,
    currentStepID: number,
    assignmentID: number,
    actor: ApprovalRequestActor,
    remark: string | null,
    now: Date,
  ) {
    const requestUpdate =
      await tx.approvalRequest.updateMany({
        where: {
          id: request.id,
          status: ApprovalRequestStatus.PENDING,
        },

        data: {
          status: ApprovalRequestStatus.APPROVED,
          currentStepNo: null,
          completedAt: now,
          finalRemark:
            remark ||
            'Approval request completed successfully',
        },
      });

    if (requestUpdate.count !== 1) {
      throw new ConflictException(
        'The approval request has already been processed',
      );
    }

    await this.applySubjectOutcome(
      tx,
      request,
      'APPROVED',
    );

    await tx.approvalRequestAction.create({
      data: {
        approvalRequestID: request.id,
        approvalRequestStepID: currentStepID,
        approvalRequestApproverID: assignmentID,
        action: ApprovalActionType.REQUEST_COMPLETED,
        actedByEmployeeID: actor.employeeID,
        actedByUserID: actor.userID,
        fromStatus: ApprovalRequestStatus.PENDING,
        toStatus: ApprovalRequestStatus.APPROVED,
        remark:
          remark ||
          'All required approvals completed successfully',
      },
    });
  }

  private async applySubjectOutcome(
    tx: TransactionClient,
    request: {
      subjectType: string;
      subjectID: number;
      subjectEmployeeID: number | null;
    },
    outcome:
      | 'APPROVED'
      | 'REJECTED',
  ) {
    const subjectType =
      String(request.subjectType ?? '')
        .trim()
        .toUpperCase();

    if (
      subjectType ===
      'EMPLOYEE_ONBOARDING'
    ) {
      if (!request.subjectEmployeeID) {
        throw new BadRequestException(
          'Employee onboarding request has no subject employee',
        );
      }

      await tx.manageEmployee.update({
        where: {
          id: request.subjectEmployeeID,
        },

        data: {
          onboardingApprovalStatus: outcome,
        },
      });

      await tx.employeeCredentials.updateMany({
        where: {
          employeeID: request.subjectEmployeeID,
        },

        data: {
          isActive:
            outcome === 'APPROVED',
        },
      });

      return;
    }

    if (
      [
        'ATTENDANCE_REGULARISATION',
        'ATTENDANCE_REGULARIZATION',
        'ATTENDANCE_REGULARISE',
      ].includes(subjectType)
    ) {
      await tx.empAttendanceRegularise.update({
        where: {
          id: request.subjectID,
        },

        data: {
          status:
            outcome === 'APPROVED'
              ? 'Approved'
              : 'Rejected',
        },
      });

      return;
    }

    throw new BadRequestException(
      `Unsupported approval subject type "${request.subjectType}"`,
    );
  }

  private handleTransactionError(
    error: unknown,
  ): never {
    if (
      error instanceof
        BadRequestException ||
      error instanceof
        ForbiddenException ||
      error instanceof
        NotFoundException ||
      error instanceof
        ConflictException
    ) {
      throw error;
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw new ConflictException(
        'The approval request was updated by another user. Refresh and try again.',
      );
    }

    throw error;
  }
}
