import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveApplicationRequestDto } from './dto/create-leave-application-request.dto';
import { UpdateLeaveApplicationRequestDto } from './dto/update-leave-application-request.dto';

@Injectable()
export class LeaveApplicationRequestService {
  constructor(private prisma: PrismaService) {}

  create(createDto: CreateLeaveApplicationRequestDto) {
    return this.prisma.leaveApplicationRequest.create({
      data: createDto,
    });
  }

  findAll() {
    return this.prisma.leaveApplicationRequest.findMany({
      include: {
        company: true,
        branches: true,
        serviceProvider: true,
        leaveApplication: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.leaveApplicationRequest.findUnique({
      where: { id },
      include: {
        company: true,
        branches: true,
        serviceProvider: true,
        leaveApplication: true,
      },
    });
  }

  update(id: number, updateDto: UpdateLeaveApplicationRequestDto) {
    return this.prisma.leaveApplicationRequest.update({
      where: { id },
      data: updateDto,
    });
  }

  remove(id: number) {
    return this.prisma.leaveApplicationRequest.delete({
      where: { id },
    });
  }
}
