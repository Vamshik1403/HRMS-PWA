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
    return this.prisma.approvalRequestApprover.findMany({
      where: {
        approverEmployeeID: actor.employeeID,
        status: ApprovalApproverStatus.PENDING,

        approvalRequest: {
          status: ApprovalRequestStatus.PENDING,
        },

        approvalRequestStep: {
          status: ApprovalStepStatus.PENDING,
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
        {
          activatedAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    });
  }

  /**
   * Pending approval count for sidebar/dashboard badges.
   */
  async getMyPendingCount(
    actor: ApprovalRequestActor,
  ) {
    const count =
      await this.prisma.approvalRequestApprover.count({
        where: {
          approverEmployeeID: actor.employeeID,
          status: ApprovalApproverStatus.PENDING,

          approvalRequest: {
            status: ApprovalRequestStatus.PENDING,
          },

          approvalRequestStep: {
            status: ApprovalStepStatus.PENDING,
          },
        },
      });

    return {
      count,
    };
  }

  /**
   * Approval actions performed by the logged-in employee.
   */
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

    const canAct =
      assignment.status ===
        ApprovalApproverStatus.PENDING &&
      assignment.approvalRequest.status ===
        ApprovalRequestStatus.PENDING &&
      assignment.approvalRequestStep.status ===
        ApprovalStepStatus.PENDING &&
      assignment.approvalRequest.currentStepNo ===
        assignment.approvalRequestStep.stepNo;

    return {
      ...assignment.approvalRequest,

      currentAssignment: {
        id: assignment.id,
        status: assignment.status,
        activatedAt: assignment.activatedAt,
        actedAt: assignment.actedAt,
        comment: assignment.comment,
      },

      assignedStep:
        assignment.approvalRequestStep,

      permissions: {
        canApprove: canAct,

        canReject:
          canAct &&
          assignment.approvalRequestStep
            .canRejectSnapshot,

        canSendBack:
          canAct &&
          assignment.approvalRequestStep
            .canSendBackSnapshot,
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
          const context =
            await this.getActiveAssignment(
              tx,
              requestID,
              actor,
            );

          const {
            request,
            currentStep,
            assignment,
          } = context;

          const now = new Date();
          const remark =
            dto.remark?.trim() || null;

          /*
           * Atomic update prevents the same employee from
           * approving the same assignment twice.
           */
          const assignmentUpdate =
            await tx.approvalRequestApprover.updateMany({
              where: {
                id: assignment.id,
                status:
                  ApprovalApproverStatus.PENDING,
              },

              data: {
                status:
                  ApprovalApproverStatus.APPROVED,

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

              approvalRequestStepID:
                currentStep.id,

              approvalRequestApproverID:
                assignment.id,

              action:
                ApprovalActionType.APPROVED,

              actedByEmployeeID:
                actor.employeeID,

              actedByUserID:
                actor.userID,

              fromStatus:
                ApprovalApproverStatus.PENDING,

              toStatus:
                ApprovalApproverStatus.APPROVED,

              remark,
            },
          });

          /*
           * The engine already controls whether one or all
           * employees are assigned.
           *
           * Once one active assignment approves, the current
           * workflow step is complete.
           */
          await tx.approvalRequestApprover.updateMany({
            where: {
              approvalRequestStepID:
                currentStep.id,

              id: {
                not: assignment.id,
              },

              status:
                ApprovalApproverStatus.PENDING,
            },

            data: {
              status:
                ApprovalApproverStatus.SKIPPED,

              actedAt: now,

              comment:
                'Approval completed by another eligible approver',
            },
          });

          const stepUpdate =
            await tx.approvalRequestStep.updateMany({
              where: {
                id: currentStep.id,
                status:
                  ApprovalStepStatus.PENDING,
              },

              data: {
                status:
                  ApprovalStepStatus.APPROVED,

                completedAt: now,
              },
            });

          if (stepUpdate.count !== 1) {
            throw new ConflictException(
              'The current approval step has already been processed',
            );
          }

          await tx.approvalRequestAction.create({
            data: {
              approvalRequestID: request.id,

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
                remark ||
                `Approval step ${currentStep.stepNo} completed`,
            },
          });

          const nextStep =
            await tx.approvalRequestStep.findFirst({
              where: {
                approvalRequestID: request.id,

                stepNo: {
                  gt: currentStep.stepNo,
                },

                status:
                  ApprovalStepStatus.WAITING,
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

              status:
                ApprovalRequestStatus.PENDING,

              completed: false,

              currentStepNo:
                nextStep.stepNo,

              message:
                'Approval completed and the next approval step was activated',
            };
          }

          await this.completeApprovalRequest(
            tx,
            request.id,
            request.subjectEmployeeID,
            currentStep.id,
            assignment.id,
            actor,
            remark,
            now,
          );

          return {
            success: true,

            requestID: request.id,

            status:
              ApprovalRequestStatus.APPROVED,

            completed: true,

            currentStepNo: null,

            message:
              'Approval request completed successfully',
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
          const context =
            await this.getActiveAssignment(
              tx,
              requestID,
              actor,
            );

          const {
            request,
            currentStep,
            assignment,
          } = context;

          if (
            !currentStep.canRejectSnapshot
          ) {
            throw new BadRequestException(
              'Rejection is not allowed for this approval step',
            );
          }

          const now = new Date();

          const assignmentUpdate =
            await tx.approvalRequestApprover.updateMany({
              where: {
                id: assignment.id,

                status:
                  ApprovalApproverStatus.PENDING,
              },

              data: {
                status:
                  ApprovalApproverStatus.REJECTED,

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
              approvalRequestStepID:
                currentStep.id,

              id: {
                not: assignment.id,
              },

              status:
                ApprovalApproverStatus.PENDING,
            },

            data: {
              status:
                ApprovalApproverStatus.SKIPPED,

              actedAt: now,

              comment:
                'Request was rejected by another approver',
            },
          });

          const stepUpdate =
            await tx.approvalRequestStep.updateMany({
              where: {
                id: currentStep.id,

                status:
                  ApprovalStepStatus.PENDING,
              },

              data: {
                status:
                  ApprovalStepStatus.REJECTED,

                rejectedAt: now,
                completedAt: now,
              },
            });

          if (stepUpdate.count !== 1) {
            throw new ConflictException(
              'The current approval step has already been processed',
            );
          }

          /*
           * Cancel all future workflow steps.
           */
          const futureSteps =
            await tx.approvalRequestStep.findMany({
              where: {
                approvalRequestID: request.id,

                stepNo: {
                  gt: currentStep.stepNo,
                },

                status: {
                  in: [
                    ApprovalStepStatus.WAITING,
                    ApprovalStepStatus.PENDING,
                  ],
                },
              },

              select: {
                id: true,
              },
            });

          const futureStepIDs =
            futureSteps.map(
              (step) => step.id,
            );

          if (futureStepIDs.length > 0) {
            await tx.approvalRequestStep.updateMany({
              where: {
                id: {
                  in: futureStepIDs,
                },
              },

              data: {
                status:
                  ApprovalStepStatus.CANCELLED,

                completedAt: now,
              },
            });

            await tx.approvalRequestApprover.updateMany({
              where: {
                approvalRequestStepID: {
                  in: futureStepIDs,
                },

                status: {
                  in: [
                    ApprovalApproverStatus.WAITING,
                    ApprovalApproverStatus.PENDING,
                  ],
                },
              },

              data: {
                status:
                  ApprovalApproverStatus.CANCELLED,

                actedAt: now,

                comment:
                  'Approval request was rejected',
              },
            });
          }

          const requestUpdate =
            await tx.approvalRequest.updateMany({
              where: {
                id: request.id,

                status:
                  ApprovalRequestStatus.PENDING,
              },

              data: {
                status:
                  ApprovalRequestStatus.REJECTED,

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

              approvalRequestStepID:
                currentStep.id,

              approvalRequestApproverID:
                assignment.id,

              action:
                ApprovalActionType.REJECTED,

              actedByEmployeeID:
                actor.employeeID,

              actedByUserID:
                actor.userID,

              fromStatus:
                ApprovalRequestStatus.PENDING,

              toStatus:
                ApprovalRequestStatus.REJECTED,

              remark,
            },
          });

          if (request.subjectEmployeeID) {
            await tx.manageEmployee.update({
              where: {
                id: request.subjectEmployeeID,
              },

              data: {
                onboardingApprovalStatus:
                  'REJECTED',
              },
            });

            /*
             * A rejected employee should not be able to log in.
             */
            await tx.employeeCredentials.updateMany({
              where: {
                employeeID:
                  request.subjectEmployeeID,
              },

              data: {
                isActive: false,
              },
            });
          }

          return {
            success: true,

            requestID: request.id,

            status:
              ApprovalRequestStatus.REJECTED,

            completed: true,

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

          subjectEmployeeID: true,

          status: true,
          currentStepNo: true,

          allowAnySameDesignationSnapshot:
            true,
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

    if (request.currentStepNo == null) {
      throw new BadRequestException(
        'Approval request has no active step',
      );
    }

    const currentStep =
      await tx.approvalRequestStep.findFirst({
        where: {
          approvalRequestID: request.id,

          stepNo: request.currentStepNo,

          status:
            ApprovalStepStatus.PENDING,
        },
      });

    if (!currentStep) {
      throw new BadRequestException(
        'The current approval step is not active',
      );
    }

    const assignment =
      await tx.approvalRequestApprover.findFirst({
        where: {
          approvalRequestID: request.id,

          approvalRequestStepID:
            currentStep.id,

          approverEmployeeID:
            actor.employeeID,

          status:
            ApprovalApproverStatus.PENDING,
        },
      });

    if (!assignment) {
      throw new ForbiddenException(
        'The logged-in employee is not an active approver for this request',
      );
    }

    /*
     * Prevent accidental self-approval even if an invalid
     * assignment was inserted.
     */
    if (
      request.subjectEmployeeID ===
      actor.employeeID
    ) {
      throw new ForbiddenException(
        'Employees cannot approve their own request',
      );
    }

    /*
     * Additional organisation safety check.
     */
    if (
      actor.companyID != null &&
      Number(request.companyID) !==
        Number(actor.companyID)
    ) {
      throw new ForbiddenException(
        'Approval request belongs to a different company',
      );
    }

    if (
      request.branchesID != null &&
      actor.branchesID != null &&
      Number(request.branchesID) !==
        Number(actor.branchesID)
    ) {
      throw new ForbiddenException(
        'Approval request belongs to a different branch',
      );
    }

    return {
      request,
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

    if (waitingApproverCount === 0) {
      throw new BadRequestException(
        `No approver is assigned to approval step ${nextStepNo}`,
      );
    }

    const stepUpdate =
      await tx.approvalRequestStep.updateMany({
        where: {
          id: nextStepID,

          status:
            ApprovalStepStatus.WAITING,
        },

        data: {
          status:
            ApprovalStepStatus.PENDING,

          activatedAt: now,
        },
      });

    if (stepUpdate.count !== 1) {
      throw new ConflictException(
        'The next approval step could not be activated',
      );
    }

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

        activatedAt: now,
      },
    });

    await tx.approvalRequest.update({
      where: {
        id: requestID,
      },

      data: {
        currentStepNo: nextStepNo,
      },
    });

    await tx.approvalRequestAction.create({
      data: {
        approvalRequestID: requestID,

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
          `Approval step ${nextStepNo} activated`,
      },
    });
  }

  private async completeApprovalRequest(
    tx: TransactionClient,
    requestID: number,
    subjectEmployeeID: number | null,
    currentStepID: number,
    assignmentID: number,
    actor: ApprovalRequestActor,
    remark: string | null,
    now: Date,
  ) {
    const requestUpdate =
      await tx.approvalRequest.updateMany({
        where: {
          id: requestID,

          status:
            ApprovalRequestStatus.PENDING,
        },

        data: {
          status:
            ApprovalRequestStatus.APPROVED,

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

    if (subjectEmployeeID) {
      await tx.manageEmployee.update({
        where: {
          id: subjectEmployeeID,
        },

        data: {
          onboardingApprovalStatus:
            'APPROVED',
        },
      });

      await tx.employeeCredentials.updateMany({
        where: {
          employeeID: subjectEmployeeID,
        },

        data: {
          isActive: true,
        },
      });
    }

    await tx.approvalRequestAction.create({
      data: {
        approvalRequestID: requestID,

        approvalRequestStepID:
          currentStepID,

        approvalRequestApproverID:
          assignmentID,

        action:
          ApprovalActionType.REQUEST_COMPLETED,

        actedByEmployeeID:
          actor.employeeID,

        actedByUserID:
          actor.userID,

        fromStatus:
          ApprovalRequestStatus.PENDING,

        toStatus:
          ApprovalRequestStatus.APPROVED,

        remark:
          remark ||
          'All approval steps completed successfully',
      },
    });
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