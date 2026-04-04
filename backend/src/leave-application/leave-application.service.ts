import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveApplicationDto } from './dto/create-leave-application.dto';
import { UpdateLeaveApplicationDto } from './dto/update-leave-application.dto';

@Injectable()
export class LeaveApplicationService {
  constructor(private prisma: PrismaService) {}

  create(createLeaveApplicationDto: CreateLeaveApplicationDto) {
    return this.prisma.leaveApplication.create({
      data: createLeaveApplicationDto,
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  async findByEmployee(empId: number) {
  return this.prisma.leaveApplication.findMany({
    where: { manageEmployeeID: empId },
    include: {
      serviceProvider: true,
      company: true,
      branches: true,
      manageEmployee: true,
    },
    orderBy: { id: 'desc' },
  });
}


  findAll() {
    return this.prisma.leaveApplication.findMany({
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.leaveApplication.findUnique({
      where: { id },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

 async revokeLeave(id: number, revokedReason?: string) {
  const leave = await this.prisma.leaveApplication.findUnique({ where: { id } })
  if (!leave) throw new NotFoundException('Leave not found')

  // Only approved leaves can go to revoke request
  if (leave.status !== 'Approved') {
    throw new BadRequestException('Only approved leaves can be revoked')
  }

  // === Append to old revoke history (in the same String field) ===
  const oldReason = leave.revokedReason ? leave.revokedReason + '\n' : ''
  const reasonLog =
    oldReason +
    `[${new Date().toLocaleString()}] Revoke requested: ${
      revokedReason ?? '(no reason provided)'
    }`

  // === Update leave record ===
  const updated = await this.prisma.leaveApplication.update({
    where: { id },
    data: {
      status: 'RevokePending', // waiting for manager approval
      revokedReason: reasonLog, // append old + new reasons
      revokedAt: new Date(), // store last request date/time
    },
  })

  return {
    message: 'Revoke request logged and waiting for approval',
    data: updated,
  }
}





  update(id: number, updateLeaveApplicationDto: UpdateLeaveApplicationDto) {
    return this.prisma.leaveApplication.update({
      where: { id },
      data: updateLeaveApplicationDto,
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

  remove(id: number) {
    return this.prisma.leaveApplication.delete({
      where: { id },
    });
  }
}
