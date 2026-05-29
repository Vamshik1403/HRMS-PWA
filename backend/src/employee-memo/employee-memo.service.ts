import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeMemoDto } from './dto/create-employee-memo.dto';
import { UpdateEmployeeMemoDto } from './dto/update-employee-memo.dto';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

@Injectable()
export class EmployeeMemoService {
  constructor(
    private prisma: PrismaService,
    private pushService: PushNotificationsService,
  ) {}

  findAll() {
    return this.prisma.employeeMemo.findMany({
      include: { manageEmployee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number) {
    return this.prisma.employeeMemo.findUnique({
      where: { id },
      include: { manageEmployee: true },
    });
  }

  async create(dto: CreateEmployeeMemoDto) {
    // Handle both single and multiple employee scenarios
    const employeeIDs = dto.employeeIDs && dto.employeeIDs.length > 0 
      ? dto.employeeIDs 
      : (dto.employeeID ? [dto.employeeID] : []);

    // Create memos for each employee
    const memos = await Promise.all(
      employeeIDs.map(empId =>
        this.prisma.employeeMemo.create({
          data: {
            serviceProviderID: dto.serviceProviderID,
            companyID: dto.companyID,
            branchesID: dto.branchesID,
            employeeID: empId,
            employeeIDs: employeeIDs,
            memoType: dto.memoType,
            subject: dto.subject,
            description: dto.description,
            issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null,
            issuedBy: dto.issuedBy,
          },
        })
      )
    );

    // Send push notifications to all employees
    employeeIDs.forEach(empId => {
      this.pushService.sendToEmployee(
        empId,
        'New Notice',
        dto.subject || 'You have a new notice on the board.',
        { url: '/empNoticeboard', tag: `notice-${empId}-${Date.now()}` },
      ).catch(() => null);
    });

    return memos.length === 1 ? memos[0] : memos;
  }

  update(id: number, dto: UpdateEmployeeMemoDto) {
    return this.prisma.employeeMemo.update({
      where: { id },
      data: {
        ...dto,
        issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : undefined,
      },
    });
  }

  remove(id: number) {
    return this.prisma.employeeMemo.delete({ where: { id } });
  }
}
