import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManageEmployeeDto } from './dto/create-manage-employee.dto';
import { UpdateManageEmployeeDto } from './dto/update-manage-employee.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ManageEmployeeService {
  private readonly SALT_ROUNDS = 12;

  constructor(private prisma: PrismaService) { }

  // Helper method to hash password
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  // Helper method to verify password (useful for login functionality)
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // CREATE employee with nested rows AND credentials with hashed password
  async create(dto: CreateManageEmployeeDto) {
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
      empDesignations = [],
      empBranches = [],
      empDepartments = [],
      empEmploymentTypes = [],
      empEmploymentStatuses = [],
      empWorkShifts = [],
      empAttendancePolicies = [],
      empLeavePolicies = [],
      empContractors = [],
      promotion,
      ...scalars
    } = dto;

    return this.prisma.$transaction(async (tx) => {
      // Create the employee
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
          ...(departmentNameID != null ? { departmentNameID } : {}),
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

          empDesignation: {
            create: empDesignations
              .filter((d) => d.designationID != null)
              .map((d) => ({
                designationID: d.designationID!,
              })),
          },

          empBranch: {
            create: empBranches
              .filter((b) => b.branchesID != null)
              .map((b) => ({ branchesID: b.branchesID! })),
          },

          empDepartment: {
            create: empDepartments
              .filter((d) => d.departmentNameID != null)
              .map((d) => ({ departmentNameID: d.departmentNameID! })),
          },

          empEmploymentType: {
            create: empEmploymentTypes
              .filter((t) => t.employmentType)
              .map((t) => ({ employmentType: t.employmentType! })),
          },

          empEmploymentStatus: {
            create: empEmploymentStatuses
              .filter((s) => s.employmentStatus)
              .map((s) => ({
                employmentStatus: s.employmentStatus!,
                probationPeriod: s.probationPeriod ?? null,
              })),
          },

          empWorkShift: {
            create: empWorkShifts
              .filter((w) => w.workShiftID != null)
              .map((w) => ({ workShiftID: w.workShiftID! })),
          },

          empAttendancePolicy: {
            create: empAttendancePolicies
              .filter((a) => a.attendancePolicyID != null)
              .map((a) => ({ attendancePolicyID: a.attendancePolicyID! })),
          },

          empLeavePolicy: {
            create: empLeavePolicies
              .filter((l) => l.leavePolicyID != null)
              .map((l) => ({ leavePolicyID: l.leavePolicyID! })),
          },

          empContractor: {
            create: empContractors
              .filter((c) => c.contractorID != null)
              .map((c) => ({ contractorID: c.contractorID! })),
          },
        } as any,
      });


      if (scalars.employeeID && scalars.personalPhoneNo) {
        const existingCred = await tx.employeeCredentials.findUnique({
          where: { employeeID: employee.id }, 
        });

        if (!existingCred) {
          const hashedPassword = await this.hashPassword(scalars.personalPhoneNo);

          await tx.employeeCredentials.create({
            data: {
              employeeID: employee.id,        
              username: scalars.employeeID, 
              password: hashedPassword,
              isActive: true,
              serviceProviderID: serviceProviderID ?? undefined,
              companyID: companyID ?? undefined,
              branchesID: branchesID ?? undefined,
            },
          });
        }
      }

      // Return the employee with all relations including credentials
      return tx.manageEmployee.findUnique({
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
              createdAt: true,
              updatedAt: true,
            }
          },
          empEduQualification: true,
          empProfExprience: true,
          employeeBankDetails: true,
          empDesignation: { include: { designation: true } },
          empDeviceMapping: { include: { device: true } },
          tokenDeviceMapping: { include: { device: true } },
          empBranch: { include: { branch: true } },
          empDepartment: { include: { department: true } },
          empEmploymentType: true,
          empEmploymentStatus: true,
          empWorkShift: { include: { workShift: true } },
          empAttendancePolicy: { include: { attendancePolicy: true } },
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
    });
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
    return this.prisma.employeeCredentials.findFirst({
      where: { username },
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

  // Reset password to personal phone number
  async resetPassword(employeeID: number) {
    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeID },
      select: { personalPhoneNo: true, employeeID: true }
    });

    if (!employee) {
      throw new Error('Employee not found');
    }

    if (!employee.personalPhoneNo) {
      throw new Error('Personal phone number not set for this employee');
    }

    const hashedPassword = await this.hashPassword(employee.personalPhoneNo);

    return this.prisma.employeeCredentials.update({
      where: { employeeID },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }


  // Method to update credentials separately with password hashing
  async updateCredentials(employeeID: number, data: { username?: string; password?: string; isActive?: boolean }) {
    const updateData: any = { ...data };

    // Hash password if provided
    if (data.password) {
      updateData.password = await this.hashPassword(data.password);
    }

    return this.prisma.employeeCredentials.update({
      where: { employeeID },
      data: updateData,
      select: {
        id: true,
        username: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  // Method for employee login verification
  async verifyEmployeeLogin(username: string, password: string) {
    const credentials = await this.prisma.employeeCredentials.findFirst({
      where: {
        username,
        isActive: true
      },
      include: {
        employee: {
          include: {
            serviceProvider: true,
            company: true,
            branches: true,
            departments: true,
            designations: true,
          }
        }
      }
    });

    if (!credentials) {
      return null;
    }

    const isPasswordValid = await this.verifyPassword(password, credentials.password);

    if (!isPasswordValid) {
      return null;
    }

    // Return employee data without password
    const { password: _, ...credentialsWithoutPassword } = credentials;
    return credentialsWithoutPassword;
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

  // ALL → no filter
  // INACTIVE → if needed later

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
          createdAt: true,
          updatedAt: true,
        },
      },
      departments: true,
      designations: true,
      workShift: true,
      employeeBankDetails: true,
      attendancePolicy: true,
      leavePolicy: true,
      monthlyPayGrade: true,
      hourlyPayGrade: true,
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
          createdAt: true,
          updatedAt: true,
        },
      },
      departments: true,
      designations: true,
      employeeBankDetails: true,
      workShift: true,
      attendancePolicy: true,
      leavePolicy: true,
      monthlyPayGrade: true,
      hourlyPayGrade: true,
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
}

  async update(id: number, dto: UpdateManageEmployeeDto) {
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
      empLeavePolicyIdsToDelete = [],
      empContractorIdsToDelete = [],
      ...scalars
    } = dto;

    return this.prisma.$transaction(async (tx) => {

      delete (scalars as any).bankDetailsIdsToDelete;
      delete (scalars as any).bankDetailIdsToDelete;
      delete (scalars as any).empDesignationIdsToDelete;
      delete (scalars as any).empBranchIdsToDelete;
      delete (scalars as any).empDepartmentIdsToDelete;
      delete (scalars as any).empEmploymentTypeIdsToDelete;
      delete (scalars as any).empEmploymentStatusIdsToDelete;
      delete (scalars as any).empWorkShiftIdsToDelete;
      delete (scalars as any).empAttendancePolicyIdsToDelete;
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

      // Update employee credentials if employeeID or personalPhoneNo changed
      if (scalars.employeeID || scalars.personalPhoneNo) {
        const existingEmployee = await tx.manageEmployee.findUnique({
          where: { id },
          select: { employeeID: true, personalPhoneNo: true }
        });

        const currentCredentials = await tx.employeeCredentials.findUnique({
          where: { employeeID: id }
        });

        if (currentCredentials) {
          const updateData: any = {
            serviceProviderID: serviceProviderID ?? undefined,
            companyID: companyID ?? undefined,
            branchesID: branchesID ?? undefined,
          };

          // Update username if employeeID changed
          if (scalars.employeeID) {
            updateData.username = scalars.employeeID;
          }

          // Update password if personalPhoneNo changed (with hashing)
          if (scalars.personalPhoneNo) {
            updateData.password = await this.hashPassword(scalars.personalPhoneNo);
          }

          await tx.employeeCredentials.update({
            where: { employeeID: id },
            data: updateData,
          });

        } else if (scalars.employeeID && scalars.personalPhoneNo) {
          // Create credentials if they don't exist but now we have the required data
          const hashedPassword = await this.hashPassword(scalars.personalPhoneNo);

          await tx.employeeCredentials.create({
            data: {
              employeeID: id,
              username: scalars.employeeID,
              password: hashedPassword,
              serviceProviderID: serviceProviderID ?? undefined,
              companyID: companyID ?? undefined,
              branchesID: branchesID ?? undefined,
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
          await tx.empBranch.update({ where: { id: b.id! }, data: { branchesID: b.branchesID! } });
        }
        if (toCreate.length) {
          await tx.empBranch.createMany({ data: toCreate.filter((b) => b.branchesID != null).map((b) => ({ manageEmployeeID: id, branchesID: b.branchesID! })) });
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
          await tx.empDepartment.update({ where: { id: d.id! }, data: { departmentNameID: d.departmentNameID! } });
        }
        if (toCreate.length) {
          await tx.empDepartment.createMany({ data: toCreate.filter((d) => d.departmentNameID != null).map((d) => ({ manageEmployeeID: id, departmentNameID: d.departmentNameID! })) });
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
          await tx.empEmploymentType.update({ where: { id: t.id! }, data: { employmentType: t.employmentType! } });
        }
        if (toCreate.length) {
          await tx.empEmploymentType.createMany({ data: toCreate.filter((t) => t.employmentType).map((t) => ({ manageEmployeeID: id, employmentType: t.employmentType! })) });
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
          await tx.empEmploymentStatus.update({ where: { id: s.id! }, data: { employmentStatus: s.employmentStatus!, probationPeriod: s.probationPeriod ?? null } });
        }
        if (toCreate.length) {
          await tx.empEmploymentStatus.createMany({ data: toCreate.filter((s) => s.employmentStatus).map((s) => ({ manageEmployeeID: id, employmentStatus: s.employmentStatus!, probationPeriod: s.probationPeriod ?? null })) });
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
          await tx.empWorkShift.update({ where: { id: w.id! }, data: { workShiftID: w.workShiftID! } });
        }
        if (toCreate.length) {
          await tx.empWorkShift.createMany({ data: toCreate.filter((w) => w.workShiftID != null).map((w) => ({ manageEmployeeID: id, workShiftID: w.workShiftID! })) });
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
          await tx.empAttendancePolicy.update({ where: { id: a.id! }, data: { attendancePolicyID: a.attendancePolicyID! } });
        }
        if (toCreate.length) {
          await tx.empAttendancePolicy.createMany({ data: toCreate.filter((a) => a.attendancePolicyID != null).map((a) => ({ manageEmployeeID: id, attendancePolicyID: a.attendancePolicyID! })) });
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
          await tx.empLeavePolicy.update({ where: { id: l.id! }, data: { leavePolicyID: l.leavePolicyID! } });
        }
        if (toCreate.length) {
          await tx.empLeavePolicy.createMany({ data: toCreate.filter((l) => l.leavePolicyID != null).map((l) => ({ manageEmployeeID: id, leavePolicyID: l.leavePolicyID! })) });
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
          await tx.empContractor.update({ where: { id: c.id! }, data: { contractorID: c.contractorID! } });
        }
        if (toCreate.length) {
          await tx.empContractor.createMany({ data: toCreate.filter((c) => c.contractorID != null).map((c) => ({ manageEmployeeID: id, contractorID: c.contractorID! })) });
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
      return tx.manageEmployee.findUnique({
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
          employeeBankDetails: true,
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
    });
  }



async remove(id: number) {
  try {
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