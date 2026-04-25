import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRosterDto } from './dto/create-roster.dto';
import { UpdateRosterDto } from './dto/update-roster.dto';

@Injectable()
export class RosterService {
  constructor(private prisma: PrismaService) {}

  private calcRosterPeriod(dateStr: string) {
    const d = new Date(dateStr);
    const mon = d.toLocaleString('default', { month: 'short' }).toUpperCase();
    return `${mon}-${d.getFullYear()}`;
  }

  async create(dto: CreateRosterDto, userId: number) {
    const from = new Date(dto.fromDate);
    const to = new Date(dto.toDate);
    if (from > to) throw new BadRequestException('fromDate cannot be after toDate');

    return this.prisma.roster.create({
      data: {
        serviceProviderID: dto.serviceProviderID,
        companyID: dto.companyID,
        branchesID: dto.branchesID,
        departmentID: dto.departmentID,
        designationID: dto.designationID,
        fromDate: from,
        toDate: to,
        rosterPeriod: dto.rosterPeriod ?? this.calcRosterPeriod(dto.fromDate),
        createdBy: userId,
      },
    });
  }

  async findAll() {
    return this.prisma.roster.findMany({
      orderBy: { id: 'desc' },
      include: {
        employees: { include: { manageEmployee: true, days: { include: { workShift: true } } } },
        company: true,
        branches: true,
        departments: true,
        designations: true,
      },
    });
  }

  async findOne(id: number) {
    const roster = await this.prisma.roster.findUnique({
      where: { id },
      include: {
        employees: {
          include: {
            manageEmployee: true,
            days: { include: { workShift: true } },
          },
        },
      },
    });

    if (!roster) throw new NotFoundException('Roster not found');
    return roster;
  }

  async update(id: number, dto: UpdateRosterDto) {
    const data: any = { ...dto };
    if (dto.fromDate) data.fromDate = new Date(dto.fromDate);
    if (dto.toDate) data.toDate = new Date(dto.toDate);

    return this.prisma.roster.update({ where: { id }, data });
  }

  async remove(id: number) {
    // delete children first to avoid FK issues (unless you have cascade)
    return this.prisma.$transaction(async (tx) => {
      const empRows = await tx.rosterEmployee.findMany({ where: { rosterID: id }, select: { id: true } });
      const empIds = empRows.map(e => e.id);

      if (empIds.length) {
        await tx.rosterDay.deleteMany({ where: { rosterEmployeeID: { in: empIds } } });
        await tx.rosterEmployee.deleteMany({ where: { rosterID: id } });
      }

      return tx.roster.delete({ where: { id } });
    });
  }
}
