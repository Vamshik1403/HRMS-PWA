import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { snapBranchesIDToCompany } from '../common/org-scope.util';
import { CreateFactualWorkShiftDto } from './dto/create-factual-work-shift.dto';
import { UpdateFactualWorkShiftDto } from './dto/update-factual-work-shift.dto';

@Injectable()
export class FactualWorkShiftService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFactualWorkShiftDto) {
    const { workShiftDays, ...shiftData } = dto;
    const branchesID = await snapBranchesIDToCompany(this.prisma, shiftData.companyID, shiftData.branchesID);

    const shift = await this.prisma.factualWorkShift.create({
      data: {
        serviceProviderID: shiftData.serviceProviderID,
        companyID: shiftData.companyID,
        branchesID,
        workShiftName: shiftData.workShiftName,
        isActive: shiftData.isActive,
        workShiftType: shiftData.workShiftType,
        isFlexible: shiftData.isFlexible,
        isRotating: shiftData.isRotating,
        breakTimeMin: shiftData.breakTimeMin,
      },
    });

    if (workShiftDays && workShiftDays.length > 0) {
      await this.prisma.factualWorkShiftDay.createMany({
        data: workShiftDays.map((day) => ({
          factualWorkShiftID: shift.id,
          weekDay: day.weekDay,
          shiftType: day.shiftType,
          weeklyOff: day.weeklyOff,
          startTime: day.startTime,
          endTime: day.endTime,
          breakStart: day.breakStart,
          breakEnd: day.breakEnd,
          totalMinutes: day.totalMinutes,
        })),
      });
    }

    return this.findOne(shift.id);
  }

  async findAll(query: {
    serviceProviderID?: number;
    companyID?: number;
    branchesID?: number;
  }) {
    const where: any = {};
    if (query.serviceProviderID) where.serviceProviderID = Number(query.serviceProviderID);
    if (query.companyID) where.companyID = Number(query.companyID);
    if (query.branchesID) where.branchesID = Number(query.branchesID);

    return this.prisma.factualWorkShift.findMany({
      where,
      include: { factualWorkShiftDay: true },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const shift = await this.prisma.factualWorkShift.findUnique({
      where: { id },
      include: { factualWorkShiftDay: true },
    });
    if (!shift) throw new NotFoundException(`FactualWorkShift #${id} not found`);
    return shift;
  }

  async update(id: number, dto: UpdateFactualWorkShiftDto) {
    const { workShiftDays, ...shiftData } = dto;

    const updateData: any = {};
    if (shiftData.serviceProviderID !== undefined) updateData.serviceProviderID = shiftData.serviceProviderID;
    if (shiftData.companyID !== undefined || shiftData.branchesID !== undefined) {
      const existing = await this.prisma.factualWorkShift.findUnique({
        where: { id },
        select: { companyID: true, branchesID: true },
      });
      const companyID = shiftData.companyID !== undefined ? shiftData.companyID : existing?.companyID;
      const requestedBranch = shiftData.branchesID !== undefined ? shiftData.branchesID : existing?.branchesID;
      updateData.branchesID = await snapBranchesIDToCompany(this.prisma, companyID, requestedBranch);
      if (shiftData.companyID !== undefined) updateData.companyID = shiftData.companyID;
    }
    if (shiftData.workShiftName !== undefined) updateData.workShiftName = shiftData.workShiftName;
    if (shiftData.isActive !== undefined) updateData.isActive = shiftData.isActive;
    if (shiftData.workShiftType !== undefined) updateData.workShiftType = shiftData.workShiftType;
    if (shiftData.isFlexible !== undefined) updateData.isFlexible = shiftData.isFlexible;
    if (shiftData.isRotating !== undefined) updateData.isRotating = shiftData.isRotating;
    if (shiftData.breakTimeMin !== undefined) updateData.breakTimeMin = shiftData.breakTimeMin;

    await this.prisma.factualWorkShift.update({ where: { id }, data: updateData });

    if (workShiftDays !== undefined) {
      await this.prisma.factualWorkShiftDay.deleteMany({ where: { factualWorkShiftID: id } });
      if (workShiftDays.length > 0) {
        await this.prisma.factualWorkShiftDay.createMany({
          data: workShiftDays.map((day) => ({
            factualWorkShiftID: id,
            weekDay: day.weekDay,
            shiftType: day.shiftType,
            weeklyOff: day.weeklyOff,
            startTime: day.startTime,
            endTime: day.endTime,
            breakStart: day.breakStart,
            breakEnd: day.breakEnd,
            totalMinutes: day.totalMinutes,
          })),
        });
      }
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.prisma.$transaction(async (tx) => {
      await tx.factualWorkShiftDay.deleteMany({ where: { factualWorkShiftID: id } });
      await tx.factualWorkShift.delete({ where: { id } });
    });
    return { message: `FactualWorkShift #${id} deleted` };
  }
}
