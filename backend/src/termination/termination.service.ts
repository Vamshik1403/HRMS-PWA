import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTerminationDto } from './dto/create-termination.dto';
import { ApproveTerminationDto } from './dto/approve-termination.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class TerminationService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}



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
          serviceProviderID: true,
          companyID: true,
          branchesID: true,
          departmentNameID: true,
          branches: {
            select: {
              id: true,
              branchName: true,
            },
          },
          departments: {
            select: {
              id: true,
              departmentName: true,
            },
          },
        },
      },
    },
    orderBy: { id: 'desc' },
  });
}


     findOne(id: number) {
    return this.prisma.employeeTermination.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeFirstName: true,
            employeeLastName: true,
            employeeID: true,
            lifecycleStatus: true,
            serviceProviderID: true,
            companyID: true,
            branchesID: true,
            departmentNameID: true,
            branches: {
              select: {
                id: true,
                branchName: true,
              },
            },
            departments: {
              select: {
                id: true,
                departmentName: true,
              },
            },
          },
        },
      },
    });
  }


 async create(dto: CreateTerminationDto) {
  const employee = await this.prisma.manageEmployee.findUnique({
    where: { id: dto.employeeId },
  });

  if (!employee) throw new NotFoundException('Employee not found');
  
  if (dto.branchesID && Number(dto.branchesID) !== Number(employee.branchesID)) {
  throw new BadRequestException('Selected branch does not match employee branch');
}

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

  const created = await this.prisma.employeeTermination.create({
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
      noticeStartDate: dto.noticeStartDate
        ? new Date(dto.noticeStartDate)
        : null,
      noticeDays: dto.noticeDays ?? null,
      exitStatus: 'DRAFT',
    },
  });

  void this.mailService.sendToEmployeeWithManagerCc({
    employeeId: employee.id,
    companyID: employee.companyID,
    eventType: 'OFFBOARDING',
    vars: {
      status: 'DRAFT',
      details: `${dto.exitType ?? ''} – ${dto.reasonCategory ?? ''}`,
    },
  });

  return created;
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

    const lastWorkingDate = new Date(dto.lastWorkingDay);
    lastWorkingDate.setHours(0, 0, 0, 0);

    return this.prisma.$transaction(async (tx) => {
      // 1️⃣ Update termination record — employee stays ACTIVE throughout notice period
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

      // NOTE: Employee lifecycleStatus and credentials are NOT changed here.
      // The employee remains ACTIVE until finalSettle is called after the notice period ends.

      return { message: 'Termination approved successfully' };
    });
  }

  async finalSettle(id: number) {
    const termination = await this.prisma.employeeTermination.findUnique({
      where: { id },
      include: {
        employee: { include: { employeeCredentials: true } },
      },
    });

    if (!termination)
      throw new NotFoundException('Termination not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.employeeTermination.update({
        where: { id },
        data: { exitStatus: 'FINAL_SETTLED' },
      });

      // Mark employee as EXITED and disable credentials on final settlement
      await tx.manageEmployee.update({
        where: { id: termination.employeeId },
        data: {
          lifecycleStatus: 'EXITED',
          exitDate: termination.lastWorkingDay ?? new Date(),
        },
      });

      await tx.employeeCredentials.updateMany({
        where: { employeeID: termination.employeeId },
        data: { isActive: false },
      });

      return { message: 'Final settlement complete' };
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
