import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { ApproveTerminationDto } from './dto/approve-termination.dto';

@Injectable()
export class TerminationService {
  constructor(private prisma: PrismaService) {}



async findAll() {
  return this.prisma.employeeTermination.findMany({
    include: {
      employee: {
        select: {
          id: true,
          employeeFirstName: true,
          employeeLastName: true,
          employeeID: true,
          lifecycleStatus: true,
        },
      },
    },
    orderBy: { id: 'desc' },
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


 async create(dto: CreateTerminationDto) {
  const employee = await this.prisma.manageEmployee.findUnique({
    where: { id: dto.employeeId },
  });

  if (!employee) throw new NotFoundException('Employee not found');

  if (employee.lifecycleStatus === 'EXITED') {
    throw new BadRequestException('Employee already exited');
  }

  const existingActiveTermination =
    await this.prisma.employeeTermination.findFirst({
      where: {
        employeeId: dto.employeeId,
        exitStatus: { in: ['DRAFT', 'NOTICE_RUNNING', 'APPROVED'] },
      },
    });

  if (existingActiveTermination) {
    throw new BadRequestException(
      'Termination already initiated for this employee',
    );
  }

  return this.prisma.employeeTermination.create({
    data: {
      employeeId: employee.id,
      serviceProviderID: employee.serviceProviderID!,
      companyID: employee.companyID!,
      branchesID: employee.branchesID!,
      exitType: dto.exitType,
      reasonCategory: dto.reasonCategory,
      reasonNote: dto.reasonNote,
      resignationDate: dto.resignationDate
        ? new Date(dto.resignationDate)
        : null,
      exitStatus: 'DRAFT',
    },
  });
}
    


  async approve(id: number, dto: ApproveTerminationDto) {
    const termination = await this.prisma.employeeTermination.findUnique({
      where: { id },
      include: {
        employee: {
          include: { employeeCredentials: true },
        },
      },
    });

    if (!termination)
      throw new NotFoundException('Termination record not found');

    if (!dto.lastWorkingDay)
      throw new BadRequestException('Last working day required');

    return this.prisma.$transaction(async (tx) => {
      // 1️⃣ Update termination
      await tx.employeeTermination.update({
        where: { id },
        data: {
          exitStatus: 'APPROVED',
          lastWorkingDay: new Date(dto.lastWorkingDay),
          noticeDays: dto.noticeDays,
          approvalDate: new Date(),
          disableLoginOn: dto.disableLoginOn
            ? new Date(dto.disableLoginOn)
            : new Date(dto.lastWorkingDay),
        },
      });

      // 2️⃣ Update employee lifecycle
      await tx.manageEmployee.update({
        where: { id: termination.employeeId },
        data: {
          lifecycleStatus: 'EXITED',
          exitDate: new Date(dto.lastWorkingDay),
        },
      });

      // 3️⃣ Disable credentials
      await tx.employeeCredentials.updateMany({
        where: { employeeID: termination.employeeId },
        data: { isActive: false },
      });

      return { message: 'Termination approved successfully' };
    });
  }

  async finalSettle(id: number) {
    const termination = await this.prisma.employeeTermination.findUnique({
      where: { id },
    });

    if (!termination)
      throw new NotFoundException('Termination not found');

    return this.prisma.employeeTermination.update({
      where: { id },
      data: {
        exitStatus: 'FINAL_SETTLED',
      },
    });
  }

  async cancel(id: number) {
    const termination = await this.prisma.employeeTermination.findUnique({
      where: { id },
    });

    if (!termination)
      throw new NotFoundException('Termination not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.employeeTermination.update({
        where: { id },
        data: { exitStatus: 'CANCELLED' },
      });

      await tx.manageEmployee.update({
        where: { id: termination.employeeId },
        data: {
          lifecycleStatus: 'ACTIVE',
          exitDate: null,
        },
      });

      await tx.employeeCredentials.updateMany({
        where: { employeeID: termination.employeeId },
        data: { isActive: true },
      });

      return { message: 'Termination cancelled' };
    });
  }
}
