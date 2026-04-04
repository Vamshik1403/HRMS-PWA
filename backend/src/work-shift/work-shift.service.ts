import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkShiftDto } from './dto/create-work-shift.dto';
import { UpdateWorkShiftDto } from './dto/update-work-shift.dto';

@Injectable()
export class WorkShiftService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateWorkShiftDto) {
    const { workShiftDays, ...workShiftData } = data;

    // Prepare the data object for creation
    const createData: any = {
      serviceProviderID: workShiftData.serviceProviderID,
      companyID: workShiftData.companyID,
      branchesID: workShiftData.branchesID,
      workShiftName: workShiftData.workShiftName,
      workShiftType: workShiftData.workShiftType,
      isFlexible: workShiftData.isFlexible ?? false,
      isRotating: workShiftData.isRotating ?? false,
      isActive: workShiftData.isActive || "1",
      breakTimeMin: workShiftData.breakTimeMin ?? 0,
    };

    // Remove undefined values to avoid Prisma errors
    Object.keys(createData).forEach(key => {
      if (createData[key] === undefined) {
        delete createData[key];
      }
    });

    // Add workShiftDays if they exist
    if (workShiftDays && workShiftDays.length > 0) {
      createData.workShiftDay = {
        create: workShiftDays.map((day) => ({
          weekDay: day.weekDay,
          weeklyOff: day.weeklyOff,
          startTime: day.weeklyOff ? null : day.startTime,
          endTime: day.weeklyOff ? null : day.endTime,
          totalMinutes: day.weeklyOff ? 0 : day.totalMinutes,
        })),
      };
    }

    return this.prisma.workShift.create({
      data: createData,
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
        workShiftDay: true,
      },
    });
  }

  findAll() {
    return this.prisma.workShift.findMany({
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
        workShiftDay: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.workShift.findUnique({
      where: { id },
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
        workShiftDay: true,
      },
    });
  }

  update(id: number, data: UpdateWorkShiftDto) {
    const { workShiftDays, ...workShiftData } = data;

    // Prepare the update data object
    const updateData: any = {};

    // Only add fields that are provided
    if (workShiftData.serviceProviderID !== undefined) {
      updateData.serviceProviderID = workShiftData.serviceProviderID;
    }
    if (workShiftData.companyID !== undefined) {
      updateData.companyID = workShiftData.companyID;
    }
    if (workShiftData.branchesID !== undefined) {
      updateData.branchesID = workShiftData.branchesID;
    }
    if (workShiftData.workShiftName !== undefined) {
      updateData.workShiftName = workShiftData.workShiftName;
    }
    if (workShiftData.workShiftType !== undefined) {
      updateData.workShiftType = workShiftData.workShiftType;
    }
    if (workShiftData.isFlexible !== undefined) {
      updateData.isFlexible = workShiftData.isFlexible; // Already boolean
    }
    if (workShiftData.isRotating !== undefined) {
      updateData.isRotating = workShiftData.isRotating; // Already boolean
    }
    if (workShiftData.isActive !== undefined) {
      updateData.isActive = workShiftData.isActive;
    }
    if (workShiftData.breakTimeMin !== undefined) {
      updateData.breakTimeMin = workShiftData.breakTimeMin;
    }

    // Handle workShiftDays
    if (workShiftDays !== undefined) {
      updateData.workShiftDay = {
        deleteMany: {}, // Delete all existing days
        create: workShiftDays.map((day) => ({
          weekDay: day.weekDay,
          weeklyOff: day.weeklyOff,
          startTime: day.weeklyOff ? null : day.startTime,
          endTime: day.weeklyOff ? null : day.endTime,
          totalMinutes: day.weeklyOff ? 0 : day.totalMinutes,
        })),
      };
    }

    return this.prisma.workShift.update({
      where: { id },
      data: updateData,
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
        workShiftDay: true,
      },
    });
  }

  remove(id: number) {
    return this.prisma.$transaction(async (prisma) => {
      // First delete all related WorkShiftDay records
      await prisma.workShiftDay.deleteMany({
        where: { workShiftID: id }
      });
      
      // Then delete the WorkShift record
      return prisma.workShift.delete({ where: { id } });
    });
  }
}