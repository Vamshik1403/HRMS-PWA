import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { snapBranchesIDToCompany } from '../common/org-scope.util';
import { CreateLeavePolicyDto } from './dto/create-leave-policy.dto';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';

@Injectable()
export class LeavePolicyService {
  constructor(private prisma: PrismaService) {}

  async create(createLeavePolicyDto: CreateLeavePolicyDto) {
    const { applicableHolidayIds, ...rest } = createLeavePolicyDto as any;

    // Sanitize FK fields: 0 or falsy values should be null (not valid FK references)
    if (!rest.serviceProviderID) rest.serviceProviderID = null;
    if (!rest.companyID) rest.companyID = null;
    rest.branchesID = await snapBranchesIDToCompany(this.prisma, rest.companyID, rest.branchesID);

    // Convert lapseEncashmentDate to full ISO-8601 DateTime if it's a date-only string
    if (rest.lapseEncashmentDate && typeof rest.lapseEncashmentDate === 'string' && !rest.lapseEncashmentDate.includes('T')) {
      rest.lapseEncashmentDate = new Date(rest.lapseEncashmentDate).toISOString();
    }

    return this.prisma.$transaction(async (prisma) => {
      const policy = await prisma.leavePolicy.create({
        data: rest,
        include: {
          serviceProvider: true,
          company: true,
          branches: true,
        },
      });

      // Link selected holidays via PublicHoliday table entries (if provided)
      if (Array.isArray(applicableHolidayIds) && applicableHolidayIds.length > 0) {
        for (const manageHolidayID of applicableHolidayIds) {
          // Reuse existing PublicHoliday for same org + manageHoliday if present
          let pub = await prisma.publicHoliday.findFirst({
            where: {
              manageHolidayID,
              serviceProviderID: policy.serviceProviderID ?? null,
              companyID: policy.companyID ?? null,
              branchesID: policy.branchesID ?? null,
            },
          });
          if (!pub) {
            pub = await prisma.publicHoliday.create({
              data: {
                serviceProviderID: policy.serviceProviderID ?? null,
                companyID: policy.companyID ?? null,
                branchesID: policy.branchesID ?? null,
                manageHolidayID,
              },
            });
          }
          await prisma.leavePolicyHoliday.create({
            data: {
              leavePolicyID: policy.id,
              publicHolidayID: pub.id,
              serviceProviderID: policy.serviceProviderID ?? null,
              companyID: policy.companyID ?? null,
              branchesID: policy.branchesID ?? null,
            },
          });
        }
      }

      return policy;
    });
  }

  async findAll() {
    return this.prisma.leavePolicy.findMany({
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        leavePolicyHoliday: {
          include: {
            publicHoliday: {
              include: {
                manageHoliday: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const leavePolicy = await this.prisma.leavePolicy.findUnique({
      where: { id },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        leavePolicyHoliday: {
          include: {
            publicHoliday: {
              include: { manageHoliday: true },
            },
          },
        },
      },
    });

    if (!leavePolicy) {
      throw new NotFoundException(`Leave policy with ID ${id} not found`);
    }

    return leavePolicy;
  }

  async update(id: number, updateLeavePolicyDto: UpdateLeavePolicyDto) {
    const { applicableHolidayIds, ...rest } = updateLeavePolicyDto as any;
    await this.findOne(id);

    // Sanitize FK fields: 0 or falsy values should be null (not valid FK references)
    if (rest.serviceProviderID === 0) rest.serviceProviderID = null;
    if (rest.companyID === 0) rest.companyID = null;
    if (rest.companyID !== undefined || rest.branchesID !== undefined) {
      const existing = await this.prisma.leavePolicy.findUnique({
        where: { id },
        select: { companyID: true, branchesID: true },
      });
      const companyID = rest.companyID !== undefined ? rest.companyID : existing?.companyID;
      const requestedBranch = rest.branchesID !== undefined ? rest.branchesID : existing?.branchesID;
      rest.branchesID = await snapBranchesIDToCompany(this.prisma, companyID, requestedBranch);
    }

    // Convert lapseEncashmentDate to full ISO-8601 DateTime if it's a date-only string
    if (rest.lapseEncashmentDate && typeof rest.lapseEncashmentDate === 'string' && !rest.lapseEncashmentDate.includes('T')) {
      rest.lapseEncashmentDate = new Date(rest.lapseEncashmentDate).toISOString();
    }

    return this.prisma.$transaction(async (prisma) => {
      const policy = await prisma.leavePolicy.update({
        where: { id },
        data: rest,
        include: {
          serviceProvider: true,
          company: true,
          branches: true,
        },
      });

      if (Array.isArray(applicableHolidayIds)) {
        // Clear existing links
        await prisma.leavePolicyHoliday.deleteMany({ where: { leavePolicyID: id } });

        // Re-add links
        for (const manageHolidayID of applicableHolidayIds) {
          let pub = await prisma.publicHoliday.findFirst({
            where: {
              manageHolidayID,
              serviceProviderID: policy.serviceProviderID ?? null,
              companyID: policy.companyID ?? null,
              branchesID: policy.branchesID ?? null,
            },
          });
          if (!pub) {
            pub = await prisma.publicHoliday.create({
              data: {
                serviceProviderID: policy.serviceProviderID ?? null,
                companyID: policy.companyID ?? null,
                branchesID: policy.branchesID ?? null,
                manageHolidayID,
              },
            });
          }
          await prisma.leavePolicyHoliday.create({
            data: {
              leavePolicyID: policy.id,
              publicHolidayID: pub.id,
              serviceProviderID: policy.serviceProviderID ?? null,
              companyID: policy.companyID ?? null,
              branchesID: policy.branchesID ?? null,
            },
          });
        }
      }

      return policy;
    });
  }

  async remove(id: number) {
    const leavePolicy = await this.findOne(id);

    // Prevent deletion if assigned to employees
    const employeeCount = await this.prisma.manageEmployee.count({
      where: { leavePolicyID: id, isDeleted: false },
    });
    const empLeavePolicyCount = await this.prisma.empLeavePolicy.count({
      where: { leavePolicyID: id },
    });
    if (employeeCount > 0 || empLeavePolicyCount > 0) {
      throw new BadRequestException(
        'Cannot delete this leave policy because it is assigned to one or more employees. Reassign those employees first.',
      );
    }

    // Prevent deletion if the leave policy is referenced by privileged leave entries
    const plLedgerCount = await this.prisma.privilegedLeaveLedger.count({
      where: { leavePolicyID: id },
    });
    const plLapseCount = await this.prisma.privilegedLeaveLapse.count({
      where: { leavePolicyID: id },
    });
    if (plLedgerCount > 0 || plLapseCount > 0) {
      throw new BadRequestException(
        'Cannot delete this leave policy because it is referenced by privileged leave entries. A leave policy can be used for multiple employees.',
      );
    }

    return this.prisma.$transaction(async (prisma) => {
      // First delete all related leavePolicyHoliday records
      await prisma.leavePolicyHoliday.deleteMany({
        where: { leavePolicyID: id },
      });
      
      // Then delete all related EmpPromotion records that reference this leave policy
      await prisma.empPromotion.updateMany({
        where: { leavePolicyID: id },
        data: { leavePolicyID: null }, // Set to null instead of deleting the promotion
      });
      
      // Finally delete the leave policy record
      return prisma.leavePolicy.delete({
        where: { id },
      });
    });
  }
}
