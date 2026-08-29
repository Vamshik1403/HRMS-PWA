import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateManageEmployeeDto } from './dto/create-manage-employee.dto';
import { UpdateManageEmployeeDto } from './dto/update-manage-employee.dto';
import { JoiningFormService } from './joining-form.service';
import * as bcrypt from 'bcrypt';
import { ApprovalEngineService } from '../approval-workflow/approval-engine.service';

@Injectable()
export class ManageEmployeeService {
  private readonly SALT_ROUNDS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly joiningFormService: JoiningFormService,
    private readonly auditLog: AuditLogService,
    private readonly approvalEngine: ApprovalEngineService,
  ) { }

  private employeeDisplayName(emp: {
    employeeFirstName?: string | null;
    employeeLastName?: string | null;
    employeeID?: string | null;
  }) {
    const name = `${emp.employeeFirstName || ''} ${emp.employeeLastName || ''}`.trim();
    return name || emp.employeeID || 'Employee';
  }

  private normalizeEmployeeDocument(doc: any, employee: any) {
    const documentName = doc.documentName ?? doc.name;
    const documentCategory = doc.documentCategory ?? doc.category;

    if (!documentName || !documentCategory || !doc.fileUrl) {
      return null;
    }

    return {
      employeeID: employee.id,
      serviceProviderID: employee.serviceProviderID ?? null,
      companyID: employee.companyID ?? null,
      branchesID: employee.branchesID ?? null,

      documentName,
      documentCategory,
      description: doc.description ?? null,

      issuedDate: doc.issuedDate ? new Date(doc.issuedDate) : null,
      expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null,

      fileName: doc.fileName ?? null,
      fileUrl: doc.fileUrl ?? null,
      fileType: doc.fileType ?? doc.fileMimeType ?? null,
      fileSize: doc.fileSize != null ? Number(doc.fileSize) : null,
    };
  }

  private toEmployeeDocumentResponse(doc: any) {
    return {
      id: doc.id,
      _localId: String(doc.id),
      name: doc.documentName,
      category: doc.documentCategory,
      description: doc.description ?? "",
      issuedDate: doc.issuedDate
        ? doc.issuedDate.toISOString().slice(0, 10)
        : "",
      expiryDate: doc.expiryDate
        ? doc.expiryDate.toISOString().slice(0, 10)
        : "",
      fileUrl: doc.fileUrl ?? "",
      fileName: doc.fileName ?? "",
      fileMimeType: doc.fileType ?? "",
      fileSize: doc.fileSize ?? 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  // Helper method to hash password
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  // Helper method to verify password
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  private normalizeEmail(value?: string | null): string {
    return String(value || '').trim().toLowerCase();
  }

  private digitsOnly(value?: string | null): string {
    return String(value || '').replace(/\D/g, '');
  }

  private employeeLoginUsername(
    personalEmail?: string | null,
    businessEmail?: string | null,
  ): string {
    return this.normalizeEmail(personalEmail) || this.normalizeEmail(businessEmail);
  }

  private employeeInitialPassword(personalPhoneNo?: string | null): string {
    return this.digitsOnly(personalPhoneNo) || String(personalPhoneNo || '').trim();
  }

  /**
   * Employee ID prefix from the company name: first word of the company
   * name, up to 3 characters (e.g. "Electrohelps Pvt Ltd" -> "Ele",
   * "3s Infocom" -> "3s" since the first word is only 2 characters long).
   */
  private employeeIdPrefixFromCompanyName(companyName?: string | null): string {
    const firstWord = (companyName || '').trim().split(/\s+/)[0] || 'EMP';
    return firstWord.slice(0, 3);
  }

  /**
   * Auto-generates the next sequential employee code for a company, e.g.
   * Ele001, Ele002, ... based on the company name prefix.
   */
  private async generateNextEmployeeCode(
    tx: any,
    companyID: number,
  ): Promise<string> {
    const company = await tx.company.findUnique({
      where: { id: companyID },
      select: { companyName: true },
    });
    const prefix = this.employeeIdPrefixFromCompanyName(company?.companyName);

    const existing = await tx.manageEmployee.findMany({
      where: {
        companyID,
        employeeID: { startsWith: prefix },
      },
      select: { employeeID: true },
    });

    let maxSeq = 0;
    for (const row of existing) {
      const match = String(row.employeeID || '').slice(prefix.length).match(/^\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }

    const nextSeq = maxSeq + 1;
    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  // CREATE employee with nested rows AND credentials with hashed password
  async create(dto: CreateManageEmployeeDto, req?: Request) {
    const {
      serviceProviderID,
      companyID,
      branchesID,
      contractorID,
      departmentNameID,
      designationID,
      employmentType,
      typeOfEmployee,
      employmentStatus,
      probationPeriod,
      workShiftID,
      attendancePolicyID,
      leavePolicyID,
      salaryPayGradeType,
      monthlyPayGradeID,
      hourlyPayGradeID,
      edu = [],
      exp = [],
      devices = [],
      tokenDevices = [],
      bankDetails = [],
      employeeDocuments = [],
      empDesignations = [],
      empBranches = [],
      empDepartments = [],
      empEmploymentTypes = [],
      empEmploymentStatuses = [],
      empWorkShifts = [],
      empAttendancePolicies = [],
      empFactualWorkShifts = [],
      empFactualAttendancePolicies = [],
      empLeavePolicies = [],
      empContractors = [],
      promotion,
      ...scalars
    } = dto;

    const created = await this.prisma.$transaction(async (tx) => {
      // Auto-generate the employee ID from the company name prefix when not
      // already supplied. The field is read-only/locked on the frontend, so
      // this is the source of truth for employee codes.
      if (!scalars.employeeID && companyID) {
        scalars.employeeID = await this.generateNextEmployeeCode(tx, companyID);
      }

      // Check for duplicate employeeID within the same company
      if (scalars.employeeID && companyID) {
        const existing = await tx.manageEmployee.findFirst({
          where: { employeeID: scalars.employeeID, companyID },
        });
        if (existing) {
          throw new Error(`Employee ID "${scalars.employeeID}" already exists in this company`);
        }
      }

      // Create the employee
      const resolvedDepartmentID =
        departmentNameID ??
        empDepartments
          .filter((item) => item.departmentNameID != null)
          .at(-1)?.departmentNameID ??
        null;

      const employee = await tx.manageEmployee.create({
        data: {
          ...scalars,

          // Basic position scalars
          ...(employmentType !== undefined ? { employmentType } : {}),
          ...(typeOfEmployee !== undefined ? { typeOfEmployee } : {}),
          ...(employmentStatus !== undefined ? { employmentStatus } : {}),
          ...(probationPeriod !== undefined ? { probationPeriod } : {}),
          ...(salaryPayGradeType !== undefined ? { salaryPayGradeType } : {}),

          // Basic position fields (direct field assignments)
          ...(resolvedDepartmentID != null ? { departmentNameID: resolvedDepartmentID } : {}),
          ...(designationID != null ? { designationID } : {}),
          ...(workShiftID != null ? { workShiftID } : {}),
          ...(attendancePolicyID != null ? { attendancePolicyID } : {}),
          ...(leavePolicyID != null ? { leavePolicyID } : {}),
          ...(monthlyPayGradeID != null ? { monthlyPayGradeID } : {}),
          ...(hourlyPayGradeID != null ? { hourlyPayGradeID } : {}),
          ...(scalars.shiftEligibility !== undefined ? { shiftEligibility: scalars.shiftEligibility } : {}),
          ...(scalars.nightShiftEligibility !== undefined ? { nightShiftEligibility: scalars.nightShiftEligibility } : {}),
          ...(scalars.maxHoursPerDay !== undefined ? { maxHoursPerDay: scalars.maxHoursPerDay } : {}),
          ...(scalars.weeklyOffPattern !== undefined ? { weeklyOffPattern: scalars.weeklyOffPattern } : {}),
          ...(scalars.noticePeriodDaysForResignation !== undefined ? { noticePeriodDaysForResignation: scalars.noticePeriodDaysForResignation } : {}),
          ...(scalars.noticePeriodDaysForTermination !== undefined ? { noticePeriodDaysForTermination: scalars.noticePeriodDaysForTermination } : {}),
          ...(scalars.allowCreateTaskOnMobile !== undefined
            ? { allowCreateTaskOnMobile: !!scalars.allowCreateTaskOnMobile }
            : {}),
          ...(scalars.pwaShowLeaveBalance !== undefined
            ? { pwaShowLeaveBalance: !!scalars.pwaShowLeaveBalance }
            : {}),
          ...(scalars.pwaShowLoanAdvances !== undefined
            ? { pwaShowLoanAdvances: !!scalars.pwaShowLoanAdvances }
            : {}),

          // Foreign key fields
          serviceProviderID: serviceProviderID ?? undefined,
          companyID: companyID ?? undefined,
          branchesID: branchesID ?? undefined,
          contractorID: contractorID ?? undefined,

          // nested creates
          empEduQualification: {
            create: edu.map((e) => ({
              instituteType: e.instituteType ?? null,
              instituteName: e.instituteName ?? null,
              degree: e.degree ?? null,
              pasingYear: e.pasingYear ?? null,
              marks: e.marks ?? null,
              gpaCgpa: e.gpaCgpa ?? null,
              class: e.class ?? null,
            })),
          },

          empProfExprience: {
            create: exp.map((x) => ({
              orgName: x.orgName ?? null,
              designation: x.designation ?? null,
              fromDate: x.fromDate ?? null,
              toDate: x.toDate ?? null,
              responsibility: x.responsibility ?? null,
              skill: x.skill ?? null,
            })),
          },

          empDeviceMapping: {
            create: devices.map((d) => ({
              deviceID: d.deviceID,
              deviceEmpCode: d.deviceEmpCode ?? null,
              authType: d.authType ?? null,
            })),
          },

          tokenDeviceMapping: {
            create: tokenDevices.map((d) => ({
              deviceID: d.deviceID,
              deviceEmpCode: d.deviceEmpCode ?? null,
              authType: d.authType ?? null,
            })),
          },

          employeeBankDetails: {
            create: bankDetails.map((b) => ({
              bankName: b.bankName ?? null,
              bankBranchName: b.bankBranchName ?? null,
              accNumber: b.accNumber ?? null,
              ifscCode: b.ifscCode ?? null,
              upi: b.upi ?? null,
            })),
          },

          employeeDocuments: {
            create: employeeDocuments
              .map((doc: any) =>
                this.normalizeEmployeeDocument(doc, {
                  id: 0,
                  serviceProviderID,
                  companyID,
                  branchesID,
                }),
              )
              .filter(Boolean)
              .map((doc: any) => ({
                serviceProviderID: doc.serviceProviderID,
                companyID: doc.companyID,
                branchesID: doc.branchesID,
                documentName: doc.documentName,
                documentCategory: doc.documentCategory,
                description: doc.description,
                issuedDate: doc.issuedDate,
                expiryDate: doc.expiryDate,
                fileName: doc.fileName,
                fileUrl: doc.fileUrl,
                fileType: doc.fileType,
                fileSize: doc.fileSize,
              })),
          },

          empDesignation: {
            create: empDesignations
              .filter((d) => d.designationID != null)
              .map((d) => ({
                designationID: d.designationID!,
                effectFrom: d.effectFrom ?? null,
              })),
          },

          empBranch: {
            create: empBranches
              .filter((b) => b.branchesID != null)
              .map((b) => ({ branchesID: b.branchesID!, effectFrom: b.effectFrom ?? null })),
          },

          empDepartment: {
            create: empDepartments
              .filter((d) => d.departmentNameID != null)
              .map((d) => ({ departmentNameID: d.departmentNameID!, effectFrom: d.effectFrom ?? null })),
          },

          empEmploymentType: {
            create: empEmploymentTypes
              .filter((t) => t.employmentType)
              .map((t) => ({ employmentType: t.employmentType!, effectFrom: t.effectFrom ?? null })),
          },

          empEmploymentStatus: {
            create: empEmploymentStatuses
              .filter((s) => s.employmentStatus)
              .map((s) => ({
                employmentStatus: s.employmentStatus!,
                probationPeriod: s.probationPeriod ?? null,
                effectFrom: s.effectFrom ?? null,
              })),
          },

          empWorkShift: {
            create: empWorkShifts
              .filter((w) => w.workShiftID != null)
              .map((w) => ({ workShiftID: w.workShiftID!, effectFrom: w.effectFrom ?? null })),
          },

          empAttendancePolicy: {
            create: empAttendancePolicies
              .filter((a) => a.attendancePolicyID != null)
              .map((a) => ({ attendancePolicyID: a.attendancePolicyID!, effectFrom: a.effectFrom ?? null })),
          },

          empFactualWorkShift: {
            create: empFactualWorkShifts
              .filter((w) => w.factualWorkShiftID != null)
              .map((w) => ({ factualWorkShiftID: w.factualWorkShiftID!, effectFrom: w.effectFrom ?? null })),
          },

          empFactualAttendancePolicy: {
            create: empFactualAttendancePolicies
              .filter((a) => a.factualAttendancePolicyID != null)
              .map((a) => ({ factualAttendancePolicyID: a.factualAttendancePolicyID!, effectFrom: a.effectFrom ?? null })),
          },

          empLeavePolicy: {
            create: empLeavePolicies
              .filter((l) => l.leavePolicyID != null)
              .map((l) => ({ leavePolicyID: l.leavePolicyID!, effectFrom: l.effectFrom ?? null })),
          },

          empContractor: {
            create: empContractors
              .filter((c) => c.contractorID != null)
              .map((c) => ({ contractorID: c.contractorID!, effectFrom: c.effectFrom ?? null })),
          },


        } as any,

      });

      /*
       * Resolve employee onboarding approval inside the same database
       * transaction. If workflow resolution or approver assignment fails,
       * employee creation is rolled back completely.
       */
      const requestUser = (req as any)?.user ?? null;

      const submittedByUserID =
        requestUser?.id != null
          ? Number(requestUser.id)
          : requestUser?.userId != null
            ? Number(requestUser.userId)
            : requestUser?.sub != null
              ? Number(requestUser.sub)
              : null;

      const effectiveDepartmentID =
        employee.departmentNameID ??
        empDepartments
          .filter(
            (item) =>
              item.departmentNameID != null,
          )
          .at(-1)
          ?.departmentNameID ??
        null;

      const effectiveDesignationID =
        employee.designationID ??
        empDesignations
          .filter(
            (item) =>
              item.designationID != null,
          )
          .at(-1)
          ?.designationID ??
        null;

      const effectiveBranchID =
        employee.branchesID ??
        empBranches
          .filter(
            (item) =>
              item.branchesID != null,
          )
          .at(-1)
          ?.branchesID ??
        null;

      const onboardingApproval =
        await this.approvalEngine.submitEmployeeOnboarding(
          tx,
          {
            id: employee.id,

            serviceProviderID:
              employee.serviceProviderID,

            companyID:
              employee.companyID,

            branchesID:
              effectiveBranchID,

            departmentNameID:
              effectiveDepartmentID,

            designationID:
              effectiveDesignationID,
          },

          Number.isInteger(
            submittedByUserID,
          )
            ? submittedByUserID
            : null,
        );

      let plainInitialPassword: string | null = null;

      const loginUsername = this.employeeLoginUsername(
        scalars.personalEmail,
        scalars.businessEmail,
      );
      const initialPassword = this.employeeInitialPassword(scalars.personalPhoneNo);

      if ((scalars.personalPhoneNo || scalars.personalEmail || scalars.businessEmail) &&
          (!loginUsername || !initialPassword)) {
        throw new BadRequestException(
          'Employee email and mobile number are required to create login credentials',
        );
      }

      if (loginUsername && initialPassword) {
        const existingCred = await tx.employeeCredentials.findUnique({
          where: { employeeID: employee.id },
        });

        if (!existingCred) {
          const taken = await tx.employeeCredentials.findFirst({
            where: { username: loginUsername },
          });
          if (taken) {
            throw new BadRequestException(
              'An employee login already exists for this email address',
            );
          }

          plainInitialPassword = initialPassword;
          const hashedPassword = await this.hashPassword(plainInitialPassword);

          await tx.employeeCredentials.create({
            data: {
              employeeID: employee.id,
              username: loginUsername,
              password: hashedPassword,
              mustChangePassword: true,

              /*
               * The employee must not be able to log in until all mandatory
               * onboarding approval steps are completed.
               */
              isActive: !onboardingApproval.approvalRequired,

              serviceProviderID: serviceProviderID ?? undefined,
              companyID: companyID ?? undefined,
              branchesID: branchesID ?? undefined,
            },
          });
        }
      }

      // Return the employee with all relations including credentials
      const employeeWithRelations = await tx.manageEmployee.findUnique({
        where: { id: employee.id },
        include: {
          serviceProvider: true,
          company: true,
          branches: true,
          contractors: true,
          employeeCredentials: {
            select: {
              id: true,
              username: true,
              isActive: true,
              mustChangePassword: true,
              createdAt: true,
              updatedAt: true,
            }
          },
          empEduQualification: true,
          empProfExprience: true,
          employeeBankDetails: true,
          employeeDocuments: {
            orderBy: { createdAt: 'desc' },
          },
          empDesignation: { include: { designation: true } },
          empDeviceMapping: { include: { device: true } },
          tokenDeviceMapping: { include: { device: true } },
          empBranch: { include: { branch: true } },
          empDepartment: { include: { department: true } },
          empEmploymentType: true,
          empEmploymentStatus: true,
          empWorkShift: { include: { workShift: true } },
          empAttendancePolicy: { include: { attendancePolicy: true } },
          empFactualWorkShift: { include: { factualWorkShift: true } },
          empFactualAttendancePolicy: { include: { factualAttendancePolicy: true } },
          empLeavePolicy: { include: { leavePolicy: true } },
          empContractor: { include: { contractor: true } },
          salaryCycle: true,
          empPromotion: {
            orderBy: { id: 'desc' },
            include: {
              departments: true,
              designations: true,
              workShift: true,
              attendancePolicy: true,
              leavePolicy: true,
              hourlyPayGrade: true,
              monthlyPayGrade: true,
            },
          },
        },
      });

      return {
        ...employeeWithRelations,
        initialPassword: plainInitialPassword,

        approval: {
          required: onboardingApproval.approvalRequired,
          requestID: onboardingApproval.approvalRequestID,
          workflowID: onboardingApproval.workflowID,
          workflowName: onboardingApproval.workflowName,
          currentStepNo: onboardingApproval.currentStepNo,
          status: onboardingApproval.status,
          credentialsActive: !onboardingApproval.approvalRequired,
        },
      };
    });

    await this.auditLog.logFromRequest(req, {
      action: 'CREATE',
      module: 'EMPLOYEE',
      entityId: created?.id,
      entityName: created ? this.employeeDisplayName(created) : undefined,
      newData: created
        ? {
          employeeID: created.employeeID,
          employeeFirstName: created.employeeFirstName,
          employeeLastName: created.employeeLastName,
        }
        : undefined,
    });

    return created;
  }


  // Fix getAllCredentials - use the same approach as test query
  async getAllCredentials() {
    try {

      const credentials = await this.prisma.employeeCredentials.findMany({
        include: {
          employee: {
            select: {
              id: true,
              employeeFirstName: true,
              employeeLastName: true,
              employeeID: true,
              personalPhoneNo: true,
              businessEmail: true,
            }
          },
          serviceProvider: {
            select: {
              id: true,
              companyName: true,
            }
          },
          company: {
            select: {
              id: true,
              companyName: true,
            }
          },
          branches: {
            select: {
              id: true,
              branchName: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });


      // Return the data directly without wrapping in another object
      return credentials;

    } catch (error) {
      console.error('❌ Error in getAllCredentials:', error);
      throw new Error(`Failed to fetch credentials: ${(error as Error).message}`);
    }
  }

  // Fix getEmployeeCredentials - use the same approach as test query
  async getEmployeeCredentials(employeeID: number) {
    try {

      const credentials = await this.prisma.employeeCredentials.findUnique({
        where: { employeeID },
        include: {
          employee: {
            select: {
              id: true,
              employeeFirstName: true,
              employeeLastName: true,
              employeeID: true,
              personalPhoneNo: true,
              businessEmail: true,
            }
          },
          serviceProvider: {
            select: {
              id: true,
              companyName: true,
            }
          },
          company: {
            select: {
              id: true,
              companyName: true,
            }
          },
          branches: {
            select: {
              id: true,
              branchName: true,
            }
          }
        }
      });

      if (!credentials) {
        return {
          message: 'No credentials found for this employee',
          employeeID
        };
      }

      // Return the data directly without wrapping in another object
      return credentials;

    } catch (error) {
      console.error('❌ Error in getEmployeeCredentials:', error);
      throw new Error(`Failed to fetch employee credentials: ${(error as Error).message}`);
    }
  }

  // Fix getCredentialsByUsername
  async getCredentialsByUsername(username: string) {
    const row = await this.prisma.employeeCredentials.findFirst({
      where: {
        isActive: true,
        OR: [
          { username: { equals: username, mode: 'insensitive' } },
          { employee: { employeeID: { equals: username, mode: 'insensitive' } } },
        ],
        employee: {
          onboardingApprovalStatus: 'APPROVED',
          lifecycleStatus: 'ACTIVE',
          isDeleted: false,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeFirstName: true,
            employeeLastName: true,
            employeeID: true,
            personalPhoneNo: true,
            businessEmail: true,
            companyID: true,
            pwaShowLeaveBalance: true,
            pwaShowLoanAdvances: true,
            allowCreateTaskOnMobile: true,
          }
        },
        serviceProvider: {
          select: {
            id: true,
            companyName: true,
          }
        },
        company: {
          select: {
            id: true,
            companyName: true,
          }
        },
        branches: {
          select: {
            id: true,
            branchName: true,
          }
        }
      }
    });
    // Return explicit null (JSON `null`) instead of an empty Nest/Express body.
    return row ?? null;
  }


  async workflowSearch(params: {
    companyID: number;
    branchesID?: number;
    search?: string;
  }) {
    if (
      !Number.isInteger(params.companyID) ||
      params.companyID <= 0
    ) {
      throw new BadRequestException(
        'companyID must be a positive integer',
      );
    }

    if (
      params.branchesID !== undefined &&
      (!Number.isInteger(
        params.branchesID,
      ) ||
        params.branchesID <= 0)
    ) {
      throw new BadRequestException(
        'branchesID must be a positive integer',
      );
    }

    const search =
      params.search?.trim();

    return this.prisma.manageEmployee.findMany({
      where: {
        companyID:
          params.companyID,

        lifecycleStatus:
          'ACTIVE',

        onboardingApprovalStatus:
          'APPROVED',

        isDeleted:
          false,

        ...(params.branchesID
          ? {
            branchesID:
              params.branchesID,
          }
          : {}),

        ...(search
          ? {
            OR: [
              {
                employeeFirstName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                employeeLastName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                employeeID: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
          : {}),
      },

      select: {
        id: true,
        serviceProviderID: true,
        companyID: true,
        branchesID: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeeID: true,
      },

      orderBy: [
        {
          employeeFirstName: 'asc',
        },
        {
          employeeLastName: 'asc',
        },
      ],

      take: 20,
    });
  }

  async searchCredentials(filters: {
    username?: string;
    isActive?: boolean;
    serviceProviderID?: number;
    companyID?: number;
    branchesID?: number;
  }) {
    return this.prisma.employeeCredentials.findMany({
      where: {
        ...(filters.username && {
          username: { contains: filters.username, mode: 'insensitive' }
        }),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters.serviceProviderID && { serviceProviderID: filters.serviceProviderID }),
        ...(filters.companyID && { companyID: filters.companyID }),
        ...(filters.branchesID && { branchesID: filters.branchesID }),
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeFirstName: true,
            employeeLastName: true,
            employeeID: true,
            personalPhoneNo: true,
            businessEmail: true,
          }
        },
        serviceProvider: {
          select: {
            id: true,
            companyName: true,
          }
        },
        company: {
          select: {
            id: true,
            companyName: true,
          }
        },
        branches: {
          select: {
            id: true,
            branchName: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Reset password to new random password
  async resetPassword(employeeID: number) {
    const employee =
      await this.prisma.manageEmployee.findUnique({
        where: {
          id: employeeID,
        },

        select: {
          onboardingApprovalStatus: true,
          lifecycleStatus: true,
          isDeleted: true,
          personalPhoneNo: true,
          personalEmail: true,
          businessEmail: true,
        },
      });

    if (!employee) {
      throw new NotFoundException(
        `Employee ${employeeID} not found`,
      );
    }

    if (
      employee.onboardingApprovalStatus !==
      'APPROVED'
    ) {
      throw new BadRequestException(
        'Password cannot be reset before onboarding approval is completed',
      );
    }

    const credentials =
      await this.prisma.employeeCredentials.findUnique({
        where: {
          employeeID,
        },
      });

    if (!credentials) {
      throw new Error('Employee credentials not found');
    }

    const plainPassword = this.employeeInitialPassword(employee.personalPhoneNo);
    if (!plainPassword) {
      throw new BadRequestException(
        'Employee mobile number is required to reset password',
      );
    }
    const hashedPassword = await this.hashPassword(plainPassword);
    const loginUsername = this.employeeLoginUsername(
      employee.personalEmail,
      employee.businessEmail,
    );

    const updated = await this.prisma.employeeCredentials.update({
      where: { employeeID },
      data: {
        ...(loginUsername ? { username: loginUsername } : {}),
        password: hashedPassword,
        mustChangePassword: true,
        passwordChangedAt: null,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...updated,
      initialPassword: plainPassword,
    };
  }

  // Method to update credentials separately with password hashing
  async updateCredentials(
    employeeID: number,
    data: {
      username?: string;
      password?: string;
      isActive?: boolean;
    },
  ) {
    const employee =
      await this.prisma.manageEmployee.findUnique({
        where: {
          id: employeeID,
        },

        select: {
          id: true,
          onboardingApprovalStatus: true,
          lifecycleStatus: true,
          isDeleted: true,
        },
      });

    if (!employee) {
      throw new NotFoundException(
        `Employee ${employeeID} not found`,
      );
    }

    /*
     * Do not allow pending/rejected onboarding employees to be activated
     * manually through the credentials endpoint.
     */
    if (
      data.isActive === true &&
      employee.onboardingApprovalStatus !==
      'APPROVED'
    ) {
      throw new BadRequestException(
        'Employee credentials cannot be activated before onboarding approval is completed',
      );
    }

    if (
      data.isActive === true &&
      (
        employee.lifecycleStatus !== 'ACTIVE' ||
        employee.isDeleted
      )
    ) {
      throw new BadRequestException(
        'Credentials cannot be activated for an inactive or deleted employee',
      );
    }

    const updateData: {
      username?: string;
      password?: string;
      isActive?: boolean;
      mustChangePassword?: boolean;
      passwordChangedAt?: Date | null;
    } = {
      ...data,
    };

    if (data.password) {
      updateData.password =
        await this.hashPassword(
          data.password,
        );

      updateData.mustChangePassword =
        true;

      updateData.passwordChangedAt =
        null;
    }

    return this.prisma.employeeCredentials.update({
      where: {
        employeeID,
      },

      data: updateData,

      select: {
        id: true,
        username: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async changePassword(
    employeeID: number,
    oldPassword: string,
    newPassword: string,
  ) {
    const credentials =
      await this.prisma.employeeCredentials.findUnique({
        where: {
          employeeID,
        },

        include: {
          employee: {
            select: {
              onboardingApprovalStatus: true,
              lifecycleStatus: true,
              isDeleted: true,
            },
          },
        },
      });

    if (!credentials) {
      throw new NotFoundException(
        'Employee credentials not found',
      );
    }

    if (
      !credentials.isActive ||
      credentials.employee
        .onboardingApprovalStatus !==
      'APPROVED' ||
      credentials.employee.lifecycleStatus !==
      'ACTIVE' ||
      credentials.employee.isDeleted
    ) {
      throw new BadRequestException(
        'Password cannot be changed because the employee account is not active',
      );
    }

    const isValid =
      await this.verifyPassword(
        oldPassword,
        credentials.password,
      );

    if (!isValid) {
      throw new BadRequestException(
        'Current password is incorrect',
      );
    }

    const hashed =
      await this.hashPassword(
        newPassword,
      );

    await this.prisma.employeeCredentials.update({
      where: {
        employeeID,
      },

      data: {
        password: hashed,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    return {
      message:
        'Password changed successfully',
    };
  }

  // Method for employee login verification
  async verifyEmployeeLogin(
    username: string,
    password: string,
  ) {
    const credentials =
      await this.prisma.employeeCredentials.findFirst({
        where: {
          username,
          isActive: true,

          employee: {
            onboardingApprovalStatus: 'APPROVED',
            lifecycleStatus: 'ACTIVE',
            isDeleted: false,
          },
        },

        include: {
          employee: {
            include: {
              serviceProvider: true,
              company: true,
              branches: true,
              departments: true,
              designations: true,
            },
          },
        },
      });

    if (!credentials) {
      return null;
    }

    const isPasswordValid =
      await this.verifyPassword(
        password,
        credentials.password,
      );

    if (!isPasswordValid) {
      return null;
    }

    const {
      password: _password,
      ...credentialsWithoutPassword
    } = credentials;

    return {
      ...credentialsWithoutPassword,
      mustChangePassword:
        credentials.mustChangePassword,
    };
  }

  async findAllForList(status?: string) {
    const whereCondition: any = {};

    if (!status || status === 'ACTIVE') {
      whereCondition.lifecycleStatus = 'ACTIVE';
    }

    if (status === 'EXITED') {
      whereCondition.lifecycleStatus = 'EXITED';
    }

    return this.prisma.manageEmployee.findMany({
      where: whereCondition,
      select: {
        id: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeeID: true,
        businessEmail: true,
        companyID: true,
        branchesID: true,
        serviceProviderID: true,
        departmentNameID: true,
        designationID: true,
        employmentType: true,
        employmentStatus: true,
        typeOfEmployee: true,
        lifecycleStatus: true,
        onboardingApprovalStatus: true,
        joiningDate: true,
        salaryPayoutTo: true,
        personalPhoneNo: true,

        employeeCredentials: {
          select: {
            id: true,
            username: true,
            isActive: true,
            mustChangePassword: true,
          },
        },

        departments: {
          select: {
            id: true,
            departmentName: true,
          },
        },

        designations: {
          select: {
            id: true,
            designation: true,
          },
        },

        branches: {
          select: {
            id: true,
            branchName: true,
          },
        },

        empDesignation: {
          orderBy: {
            id: 'desc',
          },

          take: 1,

          include: {
            designation: {
              select: {
                designation: true,
              },
            },
          },
        },

        empBranch: {
          orderBy: {
            id: 'desc',
          },

          take: 1,
          include: {
            branch: {
              select: {
                branchName: true,
              },
            },
          },
        },

        empDepartment: {
          orderBy: {
            id: 'desc',
          },

          take: 1,

          include: {
            department: {
              select: {
                departmentName: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async findAll(status?: string) {
    const whereCondition: any = {};

    // Default → ACTIVE only
    if (!status || status === 'ACTIVE') {
      whereCondition.lifecycleStatus = 'ACTIVE';
    }

    // Fetch EXITED only
    if (status === 'EXITED') {
      whereCondition.lifecycleStatus = 'EXITED';
    }



    return this.prisma.manageEmployee.findMany({
      where: whereCondition,
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        contractors: true,
        employeeCredentials: {
          select: {
            id: true,
            username: true,
            isActive: true,
            mustChangePassword: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        departments: true,
        designations: true,
        workShift: true,
        employeeBankDetails: true,
        employeeDocuments: {
          orderBy: { createdAt: 'desc' },
        },
        attendancePolicy: true,
        leavePolicy: true,
        monthlyPayGrade: true,
        hourlyPayGrade: true,
        salaryCycle: true,
        empEduQualification: true,
        empProfExprience: true,
        empDesignation: { include: { designation: true } },
        empDeviceMapping: { include: { device: true } },
        tokenDeviceMapping: { include: { device: true } },
        empBranch: { include: { branch: true } },
        empDepartment: { include: { department: true } },
        empEmploymentType: true,
        empEmploymentStatus: true,
        empWorkShift: { include: { workShift: true } },
        empAttendancePolicy: { include: { attendancePolicy: true } },
        empFactualWorkShift: { include: { factualWorkShift: true } },
        empFactualAttendancePolicy: { include: { factualAttendancePolicy: true } },
        empLeavePolicy: { include: { leavePolicy: true } },
        empContractor: { include: { contractor: true } },
        empPromotion: {
          orderBy: { id: 'desc' },
          include: {
            departments: true,
            designations: true,
            workShift: true,
            attendancePolicy: true,
            leavePolicy: true,
            hourlyPayGrade: true,
            monthlyPayGrade: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async generateJoiningFormPdf(
    id: number,
  ): Promise<{ pdf: Buffer; filenameCode: string }> {
    const employee = await this.findOne(id);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    const pdf = await this.joiningFormService.generatePdf(
      employee as Parameters<JoiningFormService['generatePdf']>[0],
    );
    return {
      pdf,
      filenameCode: employee.employeeID?.trim() || String(id),
    };
  }

  async findOne(id: number) {
    return this.prisma.manageEmployee.findFirst({
      where: {
        id,
        // optional: prevent fetching soft deleted
        // isDeleted: false
      },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        contractors: true,
        employeeCredentials: {
          select: {
            id: true,
            username: true,
            isActive: true,
            mustChangePassword: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        departments: true,
        designations: true,
        employeeBankDetails: true,
        employeeDocuments: {
          orderBy: { createdAt: 'desc' },
        },
        workShift: true,
        attendancePolicy: true,
        leavePolicy: true,
        monthlyPayGrade: true,
        hourlyPayGrade: true,
        salaryCycle: true,
        empEduQualification: true,
        empProfExprience: true,
        empDesignation: { include: { designation: true } },
        empDeviceMapping: { include: { device: true } },
        tokenDeviceMapping: { include: { device: true } },
        empBranch: { include: { branch: true } },
        empDepartment: { include: { department: true } },
        empEmploymentType: true,
        empEmploymentStatus: true,
        empWorkShift: { include: { workShift: true } },
        empAttendancePolicy: { include: { attendancePolicy: true } },
        empFactualWorkShift: { include: { factualWorkShift: true } },
        empFactualAttendancePolicy: { include: { factualAttendancePolicy: true } },
        empLeavePolicy: { include: { leavePolicy: true } },
        empContractor: { include: { contractor: true } },
        empPromotion: {
          orderBy: {
            id: 'desc',
          },

          include: {
            departments: true,
            designations: true,
            workShift: true,
            attendancePolicy: true,
            leavePolicy: true,
            hourlyPayGrade: true,
            monthlyPayGrade: true,
          },
        },

        onboardingApprovalRequests: {
          orderBy: {
            id: 'desc',
          },

          take: 1,

          include: {
            steps: {
              orderBy: {
                stepNo: 'asc',
              },

              include: {
                approvers: {
                  orderBy: {
                    id: 'asc',
                  },

                  include: {
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
                createdAt: 'desc',
              },
            },
          },
        },
      },
    });
  }

  async update(id: number, dto: UpdateManageEmployeeDto, req?: Request) {
    const {
      serviceProviderID,
      companyID,
      branchesID,
      contractorID,
      // Extract basic position fields
      departmentNameID,
      designationID,
      employmentType,
      typeOfEmployee,
      bankDetails,
      employeeDocuments,
      employmentStatus,
      probationPeriod,
      workShiftID,
      attendancePolicyID,
      leavePolicyID,
      salaryPayGradeType,
      monthlyPayGradeID,
      hourlyPayGradeID,
      edu,
      exp,
      devices,
      tokenDevices,
      empDesignations,
      empBranches,
      empDepartments,
      empEmploymentTypes,
      empEmploymentStatuses,
      empWorkShifts,
      empAttendancePolicies,
      empFactualWorkShifts,
      empFactualAttendancePolicies,
      empLeavePolicies,
      empContractors,
      promotion,
      eduIdsToDelete = [],
      expIdsToDelete = [],
      deviceMapIdsToDelete = [],
      tokenDeviceMapIdsToDelete = [],
      bankDetailsIdsToDelete = [],
      empDesignationIdsToDelete = [],
      empBranchIdsToDelete = [],
      empDepartmentIdsToDelete = [],
      empEmploymentTypeIdsToDelete = [],
      empEmploymentStatusIdsToDelete = [],
      empWorkShiftIdsToDelete = [],
      empAttendancePolicyIdsToDelete = [],
      empFactualWorkShiftIdsToDelete = [],
      empFactualAttendancePolicyIdsToDelete = [],
      empLeavePolicyIdsToDelete = [],
      empContractorIdsToDelete = [],
      employeeID: _lockedEmployeeID,
      ...scalars
    } = dto;
    // Employee ID is auto-generated on create and locked from edits.
    void _lockedEmployeeID;

    const beforeUpdate =
      await this.prisma.manageEmployee.findUnique({
        where: {
          id,
        },
      });

    if (!beforeUpdate) {
      throw new NotFoundException(
        `Employee ${id} not found`,
      );
    }

    if (
      beforeUpdate.onboardingApprovalStatus ===
      'REJECTED' ||
      beforeUpdate.onboardingApprovalStatus ===
      'CANCELLED'
    ) {
      throw new BadRequestException(
        `Employee cannot be updated because onboarding approval is ${beforeUpdate.onboardingApprovalStatus}`,
      );
    }

    /*
     * Workflow-driving fields cannot be changed after the
     * approval request has been frozen.
     *
     * A future "revise and resubmit" action should cancel the
     * existing request and create a new approval request.
     */
    if (
      beforeUpdate.onboardingApprovalStatus ===
      'PENDING'
    ) {
      const scopeChanged =
        (
          companyID !== undefined &&
          companyID !== beforeUpdate.companyID
        ) ||
        (
          branchesID !== undefined &&
          branchesID !== beforeUpdate.branchesID
        ) ||
        (
          departmentNameID !== undefined &&
          departmentNameID !==
          beforeUpdate.departmentNameID
        ) ||
        (
          designationID !== undefined &&
          designationID !==
          beforeUpdate.designationID
        ) ||
        (
          serviceProviderID !== undefined &&
          serviceProviderID !==
          beforeUpdate.serviceProviderID
        );

      if (scopeChanged) {
        throw new BadRequestException(
          'Company, branch, department, designation and service provider cannot be changed while employee onboarding approval is pending',
        );
      }
    }

    const updated =
      await this.prisma.$transaction(async (tx) => {
        let plainInitialPassword: string | null = null;

        delete (scalars as any).bankDetailsIdsToDelete;
        delete (scalars as any).bankDetailIdsToDelete;
        delete (scalars as any).empDesignationIdsToDelete;
        delete (scalars as any).empBranchIdsToDelete;
        delete (scalars as any).empDepartmentIdsToDelete;
        delete (scalars as any).empEmploymentTypeIdsToDelete;
        delete (scalars as any).empEmploymentStatusIdsToDelete;
        delete (scalars as any).empWorkShiftIdsToDelete;
        delete (scalars as any).empAttendancePolicyIdsToDelete;
        delete (scalars as any).empFactualWorkShiftIdsToDelete;
        delete (scalars as any).empFactualAttendancePolicyIdsToDelete;
        delete (scalars as any).empLeavePolicyIdsToDelete;
        delete (scalars as any).empContractorIdsToDelete;

        // Fetch old data for history tracking
        const oldData = await tx.manageEmployee.findUnique({ where: { id } });

        // 1) update parent scalars + relations
        await tx.manageEmployee.update({
          where: { id },
          data: {
            ...scalars,

            // Basic position scalars
            ...(employmentType !== undefined ? { employmentType } : {}),
            ...(typeOfEmployee !== undefined ? { typeOfEmployee } : {}),
            ...(employmentStatus !== undefined ? { employmentStatus } : {}),
            ...(probationPeriod !== undefined ? { probationPeriod } : {}),
            ...(salaryPayGradeType !== undefined ? { salaryPayGradeType } : {}),

            // Basic position fields (direct field assignments)
            ...(departmentNameID !== undefined ? { departmentNameID } : {}),
            ...(designationID !== undefined ? { designationID } : {}),
            ...(workShiftID !== undefined ? { workShiftID } : {}),
            ...(attendancePolicyID !== undefined ? { attendancePolicyID } : {}),
            ...(leavePolicyID !== undefined ? { leavePolicyID } : {}),
            ...(monthlyPayGradeID !== undefined ? { monthlyPayGradeID } : {}),
            ...(hourlyPayGradeID !== undefined ? { hourlyPayGradeID } : {}),

            ...(scalars.shiftEligibility !== undefined ? { shiftEligibility: scalars.shiftEligibility } : {}),
            ...(scalars.nightShiftEligibility !== undefined ? { nightShiftEligibility: scalars.nightShiftEligibility } : {}),
            ...(scalars.maxHoursPerDay !== undefined ? { maxHoursPerDay: scalars.maxHoursPerDay } : {}),
            ...(scalars.weeklyOffPattern !== undefined ? { weeklyOffPattern: scalars.weeklyOffPattern } : {}),
            ...(scalars.noticePeriodDaysForResignation !== undefined ? { noticePeriodDaysForResignation: scalars.noticePeriodDaysForResignation } : {}),
            ...(scalars.noticePeriodDaysForTermination !== undefined ? { noticePeriodDaysForTermination: scalars.noticePeriodDaysForTermination } : {}),
            ...(scalars.allowCreateTaskOnMobile !== undefined
              ? { allowCreateTaskOnMobile: !!scalars.allowCreateTaskOnMobile }
              : {}),
            ...(scalars.pwaShowLeaveBalance !== undefined
              ? { pwaShowLeaveBalance: !!scalars.pwaShowLeaveBalance }
              : {}),
            ...(scalars.pwaShowLoanAdvances !== undefined
              ? { pwaShowLoanAdvances: !!scalars.pwaShowLoanAdvances }
              : {}),

            // Foreign key fields
            serviceProviderID: serviceProviderID ?? undefined,
            companyID: companyID ?? undefined,
            branchesID: branchesID ?? undefined,
            contractorID: contractorID ?? undefined,
          } as any,
        });

        // Track field changes for history
        if (oldData) {
          await this.trackFieldChanges(tx, id, oldData, {
            departmentNameID,
            branchesID,
            designationID,
            employmentType,
            employmentStatus,
            salaryPayGradeType,
            monthlyPayGradeID,
            workShiftID,
            leavePolicyID,
            attendancePolicyID,
            contractorID,
          });
        }

        // Create credentials on first save from email + mobile. Do not
        // overwrite an existing login username when the employee is updated.
        const nextLoginUsername = this.employeeLoginUsername(
          scalars.personalEmail !== undefined
            ? scalars.personalEmail
            : oldData?.personalEmail,
          scalars.businessEmail !== undefined
            ? scalars.businessEmail
            : oldData?.businessEmail,
        );
        const nextPhone =
          scalars.personalPhoneNo !== undefined
            ? scalars.personalPhoneNo
            : oldData?.personalPhoneNo;
        const nextInitialPassword = this.employeeInitialPassword(nextPhone);

        if (
          nextLoginUsername ||
          scalars.personalPhoneNo ||
          serviceProviderID !== undefined ||
          companyID !== undefined ||
          branchesID !== undefined
        ) {
          const currentCredentials = await tx.employeeCredentials.findUnique({
            where: { employeeID: id }
          });

          if (currentCredentials) {
            const updateData: any = {
              serviceProviderID: serviceProviderID ?? undefined,
              companyID: companyID ?? undefined,
              branchesID: branchesID ?? undefined,
            };

            await tx.employeeCredentials.update({
              where: { employeeID: id },
              data: updateData,
            });

          } else if (nextLoginUsername && nextInitialPassword) {
            const taken = await tx.employeeCredentials.findFirst({
              where: { username: nextLoginUsername },
            });
            if (taken) {
              throw new BadRequestException(
                'An employee login already exists for this email address',
              );
            }

            plainInitialPassword = nextInitialPassword;
            const hashedPassword = await this.hashPassword(plainInitialPassword);

            const employeeApprovalState =
              await tx.manageEmployee.findUnique({
                where: {
                  id,
                },

                select: {
                  onboardingApprovalStatus: true,
                  lifecycleStatus: true,
                  isDeleted: true,
                },
              });

            await tx.employeeCredentials.create({
              data: {
                employeeID: id,
                username: nextLoginUsername,
                password: hashedPassword,
                mustChangePassword: true,

                isActive:
                  employeeApprovalState?.onboardingApprovalStatus ===
                  'APPROVED' &&
                  employeeApprovalState?.lifecycleStatus ===
                  'ACTIVE' &&
                  employeeApprovalState?.isDeleted ===
                  false,

                serviceProviderID:
                  serviceProviderID ?? undefined,

                companyID:
                  companyID ?? undefined,

                branchesID:
                  branchesID ?? undefined,
              },
            });
          }
        }

        if (eduIdsToDelete.length) {
          await tx.empEduQualification.deleteMany({
            where: { id: { in: eduIdsToDelete }, manageEmployeeID: id },
          });
        }

        if (expIdsToDelete.length) {
          await tx.empProfExprience.deleteMany({
            where: { id: { in: expIdsToDelete }, manageEmployeeID: id },
          });
        }
        if (deviceMapIdsToDelete.length) {
          await tx.empDeviceMapping.deleteMany({
            where: { id: { in: deviceMapIdsToDelete }, manageEmployeeID: id },
          });
        }

        if (tokenDeviceMapIdsToDelete.length) {
          await tx.tokenDeviceMapping.deleteMany({
            where: { id: { in: tokenDeviceMapIdsToDelete }, manageEmployeeID: id },
          });
        }

        // 3) upsert edu
        if (edu?.length) {
          const toUpdate = edu.filter((e) => !!e.id);
          const toCreate = edu.filter((e) => !e.id);
          for (const e of toUpdate) {
            await tx.empEduQualification.update({
              where: { id: e.id! },
              data: {
                instituteType: e.instituteType ?? null,
                instituteName: e.instituteName ?? null,
                degree: e.degree ?? null,
                pasingYear: e.pasingYear ?? null,
                marks: e.marks ?? null,
                gpaCgpa: e.gpaCgpa ?? null,
                class: e.class ?? null,
              },
            });
          }

          if (toCreate.length) {
            await tx.empEduQualification.createMany({
              data: toCreate.map((e) => ({
                manageEmployeeID: id,
                instituteType: e.instituteType ?? null,
                instituteName: e.instituteName ?? null,
                degree: e.degree ?? null,
                pasingYear: e.pasingYear ?? null,
                marks: e.marks ?? null,
                gpaCgpa: e.gpaCgpa ?? null,
                class: e.class ?? null,
              })),
            });
          }
        }

        // 4) upsert exp
        if (exp?.length) {
          const toUpdate = exp.filter((x) => !!x.id);
          const toCreate = exp.filter((x) => !x.id);
          for (const x of toUpdate) {
            await tx.empProfExprience.update({
              where: { id: x.id! },
              data: {
                orgName: x.orgName ?? null,
                designation: x.designation ?? null,
                fromDate: x.fromDate ?? null,
                toDate: x.toDate ?? null,
                responsibility: x.responsibility ?? null,
                skill: x.skill ?? null,
              },
            });
          }

          if (toCreate.length) {
            await tx.empProfExprience.createMany({
              data: toCreate.map((x) => ({
                manageEmployeeID: id,
                orgName: x.orgName ?? null,
                designation: x.designation ?? null,
                fromDate: x.fromDate ?? null,
                toDate: x.toDate ?? null,
                responsibility: x.responsibility ?? null,
                skill: x.skill ?? null,
              })),
            });
          }
        }

        // 5) upsert devices
        if (devices?.length) {
          const toUpdate = devices.filter((d) => !!d.id);
          const toCreate = devices.filter((d) => !d.id);
          for (const d of toUpdate) {
            const owned = await tx.empDeviceMapping.findFirst({
              where: { id: d.id!, manageEmployeeID: id },
            });
            if (!owned) continue;
            await tx.empDeviceMapping.update({
              where: { id: d.id! },
              data: {
                device: { connect: { id: d.deviceID } },
                deviceEmpCode: d.deviceEmpCode ?? null,
                authType: d.authType ?? null,
              },
            });
          }

          for (const d of toCreate) {
            await tx.empDeviceMapping.create({
              data: {
                manageEmployee: { connect: { id } },
                device: { connect: { id: d.deviceID } },
                deviceEmpCode: d.deviceEmpCode ?? null,
                authType: d.authType ?? null,
              },
            });
          }
        }



        // Upsert Token devices (TokenDeviceMapping)
        if (tokenDevices?.length) {
          const toUpdate = tokenDevices.filter((d) => !!d.id);
          const toCreate = tokenDevices.filter((d) => !d.id);
          for (const d of toUpdate) {
            const owned = await tx.tokenDeviceMapping.findFirst({
              where: { id: d.id!, manageEmployeeID: id },
            });
            if (!owned) continue;
            await tx.tokenDeviceMapping.update({
              where: { id: d.id! },
              data: {
                device: { connect: { id: d.deviceID } },
                deviceEmpCode: d.deviceEmpCode ?? null,
                authType: d.authType ?? null,
              },
            });
          }
          for (const d of toCreate) {
            await tx.tokenDeviceMapping.create({
              data: {
                manageEmployee: { connect: { id } },
                device: { connect: { id: d.deviceID } },
                deviceEmpCode: d.deviceEmpCode ?? null,
                authType: d.authType ?? null,
              },
            });
          }
        }

        // 6) upsert bank details
        if (bankDetails?.length) {
          const toUpdate = bankDetails.filter((b) => !!b.id);
          const toCreate = bankDetails.filter((b) => !b.id);

          // Update existing
          for (const b of toUpdate) {
            await tx.employeeBankDetails.update({
              where: { id: b.id! },
              data: {
                bankName: b.bankName ?? null,
                bankBranchName: b.bankBranchName ?? null,
                accNumber: b.accNumber ?? null,
                ifscCode: b.ifscCode ?? null,
                upi: b.upi ?? null,
              },
            });
          }

          // Create new
          if (toCreate.length) {
            await tx.employeeBankDetails.createMany({
              data: toCreate.map((b) => ({
                employeeID: id,
                bankName: b.bankName ?? null,
                bankBranchName: b.bankBranchName ?? null,
                accNumber: b.accNumber ?? null,
                ifscCode: b.ifscCode ?? null,
                upi: b.upi ?? null,
              })),
            });
          }
        }

        // Delete removed bank details
        if (bankDetailsIdsToDelete.length) {
          await tx.employeeBankDetails.deleteMany({
            where: { id: { in: bankDetailsIdsToDelete }, employeeID: id },
          });
        }

        // Delete removed emp designations
        if (employeeDocuments !== undefined) {
          const currentEmployee = await tx.manageEmployee.findUnique({
            where: { id },
            select: {
              id: true,
              serviceProviderID: true,
              companyID: true,
              branchesID: true,
            },
          });

          if (!currentEmployee) {
            throw new NotFoundException(`Employee ${id} not found`);
          }

          await tx.employeeDocument.deleteMany({
            where: { employeeID: id },
          });

          const docsToCreate = employeeDocuments
            .map((doc: any) => this.normalizeEmployeeDocument(doc, currentEmployee))
            .filter(Boolean);

          if (docsToCreate.length) {
            await tx.employeeDocument.createMany({
              data: docsToCreate as any[],
            });
          }
        }

        // Delete removed emp designations
        if (empDesignationIdsToDelete.length) {
          await tx.empDesignation.deleteMany({
            where: { id: { in: empDesignationIdsToDelete }, manageEmployeeID: id },
          });
        }

        // Upsert emp designations
        if (empDesignations?.length) {
          const toUpdate = empDesignations.filter((d) => !!d.id);
          const toCreate = empDesignations.filter((d) => !d.id);
          for (const d of toUpdate) {
            await tx.empDesignation.update({
              where: { id: d.id! },
              data: {
                designationID: d.designationID ?? null,
                effectFrom: d.effectFrom ?? null,
              },
            });
          }
          if (toCreate.length) {
            await tx.empDesignation.createMany({
              data: toCreate
                .filter((d) => d.designationID != null)
                .map((d) => ({
                  manageEmployeeID: id,
                  designationID: d.designationID!,
                  effectFrom: d.effectFrom ?? null,
                })),
            });
          }
        }

        // Delete and upsert empBranch
        if (empBranchIdsToDelete.length) {
          await tx.empBranch.deleteMany({ where: { id: { in: empBranchIdsToDelete }, manageEmployeeID: id } });
        }
        if (empBranches?.length) {
          const toUpdate = empBranches.filter((b) => !!b.id);
          const toCreate = empBranches.filter((b) => !b.id);
          for (const b of toUpdate) {
            await tx.empBranch.update({ where: { id: b.id! }, data: { branchesID: b.branchesID!, effectFrom: b.effectFrom ?? null } });
          }
          if (toCreate.length) {
            await tx.empBranch.createMany({ data: toCreate.filter((b) => b.branchesID != null).map((b) => ({ manageEmployeeID: id, branchesID: b.branchesID!, effectFrom: b.effectFrom ?? null })) });
          }
        }

        // Delete and upsert empDepartment
        if (empDepartmentIdsToDelete.length) {
          await tx.empDepartment.deleteMany({ where: { id: { in: empDepartmentIdsToDelete }, manageEmployeeID: id } });
        }
        if (empDepartments?.length) {
          const toUpdate = empDepartments.filter((d) => !!d.id);
          const toCreate = empDepartments.filter((d) => !d.id);
          for (const d of toUpdate) {
            await tx.empDepartment.update({ where: { id: d.id! }, data: { departmentNameID: d.departmentNameID!, effectFrom: d.effectFrom ?? null } });
          }
          if (toCreate.length) {
            await tx.empDepartment.createMany({ data: toCreate.filter((d) => d.departmentNameID != null).map((d) => ({ manageEmployeeID: id, departmentNameID: d.departmentNameID!, effectFrom: d.effectFrom ?? null })) });
          }

          // Keep ManageEmployee.departmentNameID in sync with latest history row.
          const latestDept =
            [...empDepartments]
              .reverse()
              .find((d) => d.departmentNameID != null)?.departmentNameID ??
            (
              await tx.empDepartment.findFirst({
                where: { manageEmployeeID: id },
                orderBy: { id: 'desc' },
                select: { departmentNameID: true },
              })
            )?.departmentNameID ??
            null;
          if (latestDept != null) {
            await tx.manageEmployee.update({
              where: { id },
              data: { departmentNameID: latestDept },
            });
          }
        }

        // Delete and upsert empEmploymentType
        if (empEmploymentTypeIdsToDelete.length) {
          await tx.empEmploymentType.deleteMany({ where: { id: { in: empEmploymentTypeIdsToDelete }, manageEmployeeID: id } });
        }
        if (empEmploymentTypes?.length) {
          const toUpdate = empEmploymentTypes.filter((t) => !!t.id);
          const toCreate = empEmploymentTypes.filter((t) => !t.id);
          for (const t of toUpdate) {
            await tx.empEmploymentType.update({ where: { id: t.id! }, data: { employmentType: t.employmentType!, effectFrom: t.effectFrom ?? null } });
          }
          if (toCreate.length) {
            await tx.empEmploymentType.createMany({ data: toCreate.filter((t) => t.employmentType).map((t) => ({ manageEmployeeID: id, employmentType: t.employmentType!, effectFrom: t.effectFrom ?? null })) });
          }
        }

        // Delete and upsert empEmploymentStatus
        if (empEmploymentStatusIdsToDelete.length) {
          await tx.empEmploymentStatus.deleteMany({ where: { id: { in: empEmploymentStatusIdsToDelete }, manageEmployeeID: id } });
        }
        if (empEmploymentStatuses?.length) {
          const toUpdate = empEmploymentStatuses.filter((s) => !!s.id);
          const toCreate = empEmploymentStatuses.filter((s) => !s.id);
          for (const s of toUpdate) {
            await tx.empEmploymentStatus.update({ where: { id: s.id! }, data: { employmentStatus: s.employmentStatus!, probationPeriod: s.probationPeriod ?? null, effectFrom: s.effectFrom ?? null } });
          }
          if (toCreate.length) {
            await tx.empEmploymentStatus.createMany({ data: toCreate.filter((s) => s.employmentStatus).map((s) => ({ manageEmployeeID: id, employmentStatus: s.employmentStatus!, probationPeriod: s.probationPeriod ?? null, effectFrom: s.effectFrom ?? null })) });
          }
        }

        // Delete and upsert empWorkShift
        if (empWorkShiftIdsToDelete.length) {
          await tx.empWorkShift.deleteMany({ where: { id: { in: empWorkShiftIdsToDelete }, manageEmployeeID: id } });
        }
        if (empWorkShifts?.length) {
          const toUpdate = empWorkShifts.filter((w) => !!w.id);
          const toCreate = empWorkShifts.filter((w) => !w.id);
          for (const w of toUpdate) {
            await tx.empWorkShift.update({ where: { id: w.id! }, data: { workShiftID: w.workShiftID!, effectFrom: w.effectFrom ?? null } });
          }
          if (toCreate.length) {
            await tx.empWorkShift.createMany({ data: toCreate.filter((w) => w.workShiftID != null).map((w) => ({ manageEmployeeID: id, workShiftID: w.workShiftID!, effectFrom: w.effectFrom ?? null })) });
          }
        }

        // Delete and upsert empAttendancePolicy
        if (empAttendancePolicyIdsToDelete.length) {
          await tx.empAttendancePolicy.deleteMany({ where: { id: { in: empAttendancePolicyIdsToDelete }, manageEmployeeID: id } });
        }
        if (empAttendancePolicies?.length) {
          const toUpdate = empAttendancePolicies.filter((a) => !!a.id);
          const toCreate = empAttendancePolicies.filter((a) => !a.id);
          for (const a of toUpdate) {
            await tx.empAttendancePolicy.update({ where: { id: a.id! }, data: { attendancePolicyID: a.attendancePolicyID!, effectFrom: a.effectFrom ?? null } });
          }
          if (toCreate.length) {
            await tx.empAttendancePolicy.createMany({ data: toCreate.filter((a) => a.attendancePolicyID != null).map((a) => ({ manageEmployeeID: id, attendancePolicyID: a.attendancePolicyID!, effectFrom: a.effectFrom ?? null })) });
          }
        }

        // Delete and upsert empFactualWorkShift
        if (empFactualWorkShiftIdsToDelete.length) {
          await (tx as any).empFactualWorkShift.deleteMany({ where: { id: { in: empFactualWorkShiftIdsToDelete }, manageEmployeeID: id } });
        }
        if (empFactualWorkShifts?.length) {
          const toUpdate = empFactualWorkShifts.filter((w) => !!w.id);
          const toCreate = empFactualWorkShifts.filter((w) => !w.id);
          for (const w of toUpdate) {
            await (tx as any).empFactualWorkShift.update({ where: { id: w.id! }, data: { factualWorkShiftID: w.factualWorkShiftID!, effectFrom: w.effectFrom ?? null } });
          }
          if (toCreate.length) {
            await (tx as any).empFactualWorkShift.createMany({ data: toCreate.filter((w) => w.factualWorkShiftID != null).map((w) => ({ manageEmployeeID: id, factualWorkShiftID: w.factualWorkShiftID!, effectFrom: w.effectFrom ?? null })) });
          }
        }

        // Delete and upsert empFactualAttendancePolicy
        if (empFactualAttendancePolicyIdsToDelete.length) {
          await (tx as any).empFactualAttendancePolicy.deleteMany({ where: { id: { in: empFactualAttendancePolicyIdsToDelete }, manageEmployeeID: id } });
        }
        if (empFactualAttendancePolicies?.length) {
          const toUpdate = empFactualAttendancePolicies.filter((a) => !!a.id);
          const toCreate = empFactualAttendancePolicies.filter((a) => !a.id);
          for (const a of toUpdate) {
            await (tx as any).empFactualAttendancePolicy.update({ where: { id: a.id! }, data: { factualAttendancePolicyID: a.factualAttendancePolicyID!, effectFrom: a.effectFrom ?? null } });
          }
          if (toCreate.length) {
            await (tx as any).empFactualAttendancePolicy.createMany({ data: toCreate.filter((a) => a.factualAttendancePolicyID != null).map((a) => ({ manageEmployeeID: id, factualAttendancePolicyID: a.factualAttendancePolicyID!, effectFrom: a.effectFrom ?? null })) });
          }
        }

        // Delete and upsert empLeavePolicy
        if (empLeavePolicyIdsToDelete.length) {
          await tx.empLeavePolicy.deleteMany({ where: { id: { in: empLeavePolicyIdsToDelete }, manageEmployeeID: id } });
        }
        if (empLeavePolicies?.length) {
          const toUpdate = empLeavePolicies.filter((l) => !!l.id);
          const toCreate = empLeavePolicies.filter((l) => !l.id);
          for (const l of toUpdate) {
            await tx.empLeavePolicy.update({ where: { id: l.id! }, data: { leavePolicyID: l.leavePolicyID!, effectFrom: l.effectFrom ?? null } });
          }
          if (toCreate.length) {
            await tx.empLeavePolicy.createMany({ data: toCreate.filter((l) => l.leavePolicyID != null).map((l) => ({ manageEmployeeID: id, leavePolicyID: l.leavePolicyID!, effectFrom: l.effectFrom ?? null })) });
          }
        }

        // Delete and upsert empContractor
        if (empContractorIdsToDelete.length) {
          await tx.empContractor.deleteMany({ where: { id: { in: empContractorIdsToDelete }, manageEmployeeID: id } });
        }
        if (empContractors?.length) {
          const toUpdate = empContractors.filter((c) => !!c.id);
          const toCreate = empContractors.filter((c) => !c.id);
          for (const c of toUpdate) {
            await tx.empContractor.update({ where: { id: c.id! }, data: { contractorID: c.contractorID!, effectFrom: c.effectFrom ?? null } });
          }
          if (toCreate.length) {
            await tx.empContractor.createMany({ data: toCreate.filter((c) => c.contractorID != null).map((c) => ({ manageEmployeeID: id, contractorID: c.contractorID!, effectFrom: c.effectFrom ?? null })) });
          }
        }

        if (promotion) {
          if (promotion.id) {
            await tx.empPromotion.update({
              where: { id: promotion.id },
              data: {
                departmentNameID: promotion.departmentNameID ?? null,
                designationID: promotion.designationID ?? null,
                managerID: promotion.managerID ?? null,
                employmentType: promotion.employmentType ?? null,
                employmentStatus: promotion.employmentStatus ?? null,
                probationPeriod: promotion.probationPeriod ?? null,
                workShiftID: promotion.workShiftID ?? null,
                attendancePolicyID: promotion.attendancePolicyID ?? null,
                leavePolicyID: promotion.leavePolicyID ?? null,
                salaryPayGradeType: promotion.salaryPayGradeType ?? null,
                monthlyPayGradeID: promotion.monthlyPayGradeID ?? null,
                hourlyPayGradeID: promotion.hourlyPayGradeID ?? null,
              },
            });
          } else {
            await tx.empPromotion.create({
              data: {
                manageEmployeeID: id,
                departmentNameID: promotion.departmentNameID ?? null,
                designationID: promotion.designationID ?? null,
                managerID: promotion.managerID ?? null,
                employmentType: promotion.employmentType ?? null,
                employmentStatus: promotion.employmentStatus ?? null,
                probationPeriod: promotion.probationPeriod ?? null,
                workShiftID: promotion.workShiftID ?? null,
                attendancePolicyID: promotion.attendancePolicyID ?? null,
                leavePolicyID: promotion.leavePolicyID ?? null,
                salaryPayGradeType: promotion.salaryPayGradeType ?? null,
                monthlyPayGradeID: promotion.monthlyPayGradeID ?? null,
                hourlyPayGradeID: promotion.hourlyPayGradeID ?? null,
              },
            });
          }
        }

        // 7) return fresh data with credentials (excluding password)
        const employeeWithRelations = await tx.manageEmployee.findUnique({
          where: { id },
          include: {
            serviceProvider: true,
            company: true,
            branches: true,
            contractors: true,
            employeeCredentials: {
              select: {
                id: true,
                username: true,
                isActive: true,
                mustChangePassword: true,
                createdAt: true,
                updatedAt: true,
              }
            },
            // Basic position relations
            departments: true,
            designations: true,
            workShift: true,
            attendancePolicy: true,
            leavePolicy: true,
            monthlyPayGrade: true,
            hourlyPayGrade: true,
            salaryCycle: true,
            employeeBankDetails: true,
            employeeDocuments: {
              orderBy: { createdAt: 'desc' },
            },
            empEduQualification: true,
            empProfExprience: true,
            empDesignation: { include: { designation: true } },
            empDeviceMapping: { include: { device: true } },
            tokenDeviceMapping: { include: { device: true } },
            empBranch: { include: { branch: true } },
            empDepartment: { include: { department: true } },
            empEmploymentType: true,
            empEmploymentStatus: true,
            empWorkShift: { include: { workShift: true } },
            empAttendancePolicy: { include: { attendancePolicy: true } },
            empFactualWorkShift: { include: { factualWorkShift: true } },
            empFactualAttendancePolicy: { include: { factualAttendancePolicy: true } },
            empLeavePolicy: { include: { leavePolicy: true } },
            empContractor: { include: { contractor: true } },
            empPromotion: {
              orderBy: { id: 'desc' },
              include: {
                departments: true,
                designations: true,
                workShift: true,
                attendancePolicy: true,
                leavePolicy: true,
                hourlyPayGrade: true,
                monthlyPayGrade: true,
              },
            },
          },
        });
        return {
          ...employeeWithRelations,
          initialPassword: plainInitialPassword,
        };
      });

    await this.auditLog.logFromRequest(req, {
      action: 'UPDATE',
      module: 'EMPLOYEE',
      entityId: id,
      entityName: this.employeeDisplayName(beforeUpdate),
      oldData: {
        employeeID: beforeUpdate.employeeID,
        employeeFirstName: beforeUpdate.employeeFirstName,
        employeeLastName: beforeUpdate.employeeLastName,
      },
      newData: dto,
    });

    return updated;
  }

  async getEmployeeDocuments(employeeID: number) {
    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeID },
      select: { id: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${employeeID} not found`);
    }

    const docs = await this.prisma.employeeDocument.findMany({
      where: { employeeID },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((doc) => this.toEmployeeDocumentResponse(doc));
  }

  async createEmployeeDocument(employeeID: number, body: any, req?: Request) {
    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeID },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${employeeID} not found`);
    }

    const data = this.normalizeEmployeeDocument(body, employee);

    if (!data) {
      throw new Error('Document name, category and fileUrl are required');
    }

    const created = await this.prisma.employeeDocument.create({
      data,
    });

    await this.auditLog.logFromRequest(req, {
      action: 'CREATE',
      module: 'EMPLOYEE_DOCUMENT',
      entityId: created.id,
      entityName: created.documentName,
      newData: created,
    });

    return this.toEmployeeDocumentResponse(created);
  }

  async updateEmployeeDocument(documentId: number, body: any, req?: Request) {
    const existing = await this.prisma.employeeDocument.findUnique({
      where: { id: documentId },
    });

    if (!existing) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    const updated = await this.prisma.employeeDocument.update({
      where: { id: documentId },
      data: {
        documentName: body.documentName ?? body.name ?? existing.documentName,
        documentCategory:
          body.documentCategory ?? body.category ?? existing.documentCategory,
        description:
          body.description !== undefined ? body.description : existing.description,

        issuedDate:
          body.issuedDate !== undefined
            ? body.issuedDate
              ? new Date(body.issuedDate)
              : null
            : existing.issuedDate,

        expiryDate:
          body.expiryDate !== undefined
            ? body.expiryDate
              ? new Date(body.expiryDate)
              : null
            : existing.expiryDate,

        fileName: body.fileName ?? existing.fileName,
        fileUrl: body.fileUrl ?? existing.fileUrl,
        fileType: body.fileType ?? body.fileMimeType ?? existing.fileType,
        fileSize:
          body.fileSize !== undefined ? Number(body.fileSize) : existing.fileSize,
      },
    });

    await this.auditLog.logFromRequest(req, {
      action: 'UPDATE',
      module: 'EMPLOYEE_DOCUMENT',
      entityId: updated.id,
      entityName: updated.documentName,
      oldData: existing,
      newData: updated,
    });

    return this.toEmployeeDocumentResponse(updated);
  }

  async deleteEmployeeDocument(documentId: number, req?: Request) {
    const existing = await this.prisma.employeeDocument.findUnique({
      where: { id: documentId },
    });

    if (!existing) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    await this.prisma.employeeDocument.delete({
      where: { id: documentId },
    });

    await this.auditLog.logFromRequest(req, {
      action: 'DELETE',
      module: 'EMPLOYEE_DOCUMENT',
      entityId: existing.id,
      entityName: existing.documentName,
      oldData: existing,
    });

    return { success: true };
  }

  async remove(id: number, req?: Request) {
    try {
      const existing =
        await this.prisma.manageEmployee.findUnique({
          where: {
            id,
          },

          include: {
            _count: {
              select: {
                onboardingApprovalRequests: true,
                approvalAssignments: true,
                approvalActions: true,
              },
            },
          },
        });

      if (!existing) {
        throw new NotFoundException(
          `Employee ${id} not found`,
        );
      }

      const hasApprovalHistory =
        existing._count
          .onboardingApprovalRequests > 0 ||
        existing._count
          .approvalAssignments > 0 ||
        existing._count
          .approvalActions > 0;

      if (hasApprovalHistory) {
        throw new BadRequestException(
          'Employee cannot be deleted because approval workflow history exists. Mark the employee inactive instead.',
        );
      }

      await this.prisma.$transaction([
        // Delete employee credentials
        this.prisma.employeeCredentials.deleteMany({
          where: { employeeID: id },
        }),

        // Delete AT devices (EmpDeviceMapping)
        this.prisma.empDeviceMapping.deleteMany({
          where: { manageEmployeeID: id },
        }),

        // Delete Token devices (TokenDeviceMapping) - Add this
        this.prisma.tokenDeviceMapping.deleteMany({
          where: { manageEmployeeID: id },
        }),

        // Delete other related records
        this.prisma.empProfExprience.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empEduQualification.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empDesignation.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empBranch.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empDepartment.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empEmploymentType.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empEmploymentStatus.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empWorkShift.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empAttendancePolicy.deleteMany({
          where: { manageEmployeeID: id },
        }),
        (this.prisma as any).empFactualWorkShift.deleteMany({
          where: { manageEmployeeID: id },
        }),
        (this.prisma as any).empFactualAttendancePolicy.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empLeavePolicy.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empContractor.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empCurrentPosition.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.promotionRequest.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empPromotion.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.employeeBankDetails.deleteMany({
          where: { employeeID: id },
        }),
        this.prisma.employeeDocument.deleteMany({
          where: { employeeID: id },
        }),
        this.prisma.empAttendanceRegularise.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.empFieldSiteAttendance.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.genarateBonus.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.leaveApplication.deleteMany({
          where: { manageEmployeeID: id },
        }),
        this.prisma.bonusAllocation.deleteMany({ where: { employeeID: id } }),
        this.prisma.employeeFieldHistory.deleteMany({ where: { employeeId: id } }),

        // Finally delete the ManageEmployee record
        this.prisma.manageEmployee.delete({ where: { id } }),
      ]);

      await this.auditLog.logFromRequest(req, {
        action: 'DELETE',
        module: 'EMPLOYEE',
        entityId: id,
        entityName: this.employeeDisplayName(existing),
        oldData: {
          employeeID: existing.employeeID,
          employeeFirstName: existing.employeeFirstName,
          employeeLastName: existing.employeeLastName,
        },
      });

      return { success: true };
    } catch (e: any) {
      if (e?.code === 'P2003') {
        throw new Error(
          'Cannot delete employee: related records exist (education/experience/mappings/etc).',
        );
      }
      throw e;
    }
  }

  // ── Employee Field History ──

  private readonly TRACKED_FIELDS = [
    'departmentNameID',
    'branchesID',
    'designationID',
    'employmentType',
    'employmentStatus',
    'salaryPayGradeType',
    'monthlyPayGradeID',
    'workShiftID',
    'leavePolicyID',
    'attendancePolicyID',
    'contractorID',
  ] as const;

  private readonly FIELD_LABELS: Record<string, string> = {
    departmentNameID: 'Department',
    branchesID: 'Branch',
    designationID: 'Designation',
    employmentType: 'Employment Type',
    employmentStatus: 'Employment Status',
    salaryPayGradeType: 'Salary Pay Grade Type',
    monthlyPayGradeID: 'Pay Grade',
    workShiftID: 'Work Shift',
    leavePolicyID: 'Leave Policy',
    attendancePolicyID: 'Attendance Policy',
    contractorID: 'Contractor',
  };

  async trackFieldChanges(
    tx: any,
    employeeId: number,
    oldData: Record<string, any>,
    newData: Record<string, any>,
  ) {
    const resolveLabel = async (field: string, value: any): Promise<string | null> => {
      if (value == null) return null;
      try {
        switch (field) {
          case 'departmentNameID': {
            const r = await tx.departments.findUnique({ where: { id: value } });
            return r?.departmentName ?? String(value);
          }
          case 'branchesID': {
            const r = await tx.branches.findUnique({ where: { id: value } });
            return r?.branchName ?? String(value);
          }
          case 'designationID': {
            const r = await tx.designations.findUnique({ where: { id: value } });
            return r?.designation ?? String(value);
          }
          case 'monthlyPayGradeID': {
            const r = await tx.monthlyPayGrade.findUnique({ where: { id: value } });
            return r?.monthlyPayGradeName ?? String(value);
          }
          case 'workShiftID': {
            const r = await tx.workShift.findUnique({ where: { id: value } });
            return r?.workShiftName ?? String(value);
          }
          case 'leavePolicyID': {
            const r = await tx.leavePolicy.findUnique({ where: { id: value } });
            return r?.leavePolicyName ?? String(value);
          }
          case 'attendancePolicyID': {
            const r = await tx.attendancePolicy.findUnique({ where: { id: value } });
            return r?.attendancePolicyName ?? String(value);
          }
          case 'contractorID': {
            const r = await tx.contractors.findUnique({ where: { id: value } });
            return r?.contractorName ?? String(value);
          }
          default:
            return String(value);
        }
      } catch {
        return String(value);
      }
    };

    for (const field of this.TRACKED_FIELDS) {
      const oldVal = oldData[field] ?? null;
      const newVal = newData[field] !== undefined ? (newData[field] ?? null) : undefined;
      if (newVal === undefined) continue; // field not in update payload
      if (String(oldVal) === String(newVal)) continue; // no change

      const [oldLabel, newLabel] = await Promise.all([
        resolveLabel(field, oldVal),
        resolveLabel(field, newVal),
      ]);

      await tx.employeeFieldHistory.create({
        data: {
          employeeId,
          fieldName: this.FIELD_LABELS[field] ?? field,
          oldValue: oldVal != null ? String(oldVal) : null,
          newValue: newVal != null ? String(newVal) : null,
          oldLabel,
          newLabel,
        },
      });
    }
  }

  async getFieldHistory(employeeId: number) {
    return this.prisma.employeeFieldHistory.findMany({
      where: { employeeId },
      orderBy: { changedAt: 'desc' },
    });
  }

  // --- Linked Employees ---

  async getLinkedEmployees(employeeId: number) {
    const links = await this.prisma.employeeLink.findMany({
      where: { employeeId },
      include: {
        linkedEmployee: {
          select: {
            id: true,
            employeeFirstName: true,
            employeeLastName: true,
            employeeID: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    return links.map((l) => l.linkedEmployee);
  }

  async saveLinkedEmployees(employeeId: number, linkedEmployeeIds: number[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.employeeLink.deleteMany({ where: { employeeId } });
      if (linkedEmployeeIds && linkedEmployeeIds.length > 0) {
        await tx.employeeLink.createMany({
          data: linkedEmployeeIds
            .filter((lid) => lid !== employeeId)
            .map((lid) => ({
              employeeId,
              linkedEmployeeId: lid,
            })),
        });
      }
      const links = await tx.employeeLink.findMany({
        where: { employeeId },
        include: {
          linkedEmployee: {
            select: {
              id: true,
              employeeFirstName: true,
              employeeLastName: true,
              employeeID: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      });
      return links.map((l) => l.linkedEmployee);
    });
  }

}