import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';

@Injectable()
export class PublicHolidayService {
  constructor(private prisma: PrismaService) {}

  create(data: CreatePublicHolidayDto) {
    return this.prisma.publicHoliday.create({ data });
  }

  findAll() {
    return this.prisma.publicHoliday.findMany({
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
        manageHoliday: true,
        leavePolicyHoliday: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.publicHoliday.findUnique({
      where: { id },
      include: {
        branches: true,
        company: true,
        serviceProvider: true,
        manageHoliday: true,
        leavePolicyHoliday: true,
      },
    });
  }

 async update(id: number, data: UpdatePublicHolidayDto) {
  try {
    // Filter out undefined values to avoid Prisma errors
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    
    return await this.prisma.publicHoliday.update({
      where: { id },
      data: updateData,
    });
  } catch (error) {
    console.error('Error updating public holiday:', error);
    throw new Error('Failed to update public holiday');
  }
}

  remove(id: number) {
    return this.prisma.$transaction(async (prisma) => {
      // First delete all related leavePolicyHoliday records
      await prisma.leavePolicyHoliday.deleteMany({
        where: { publicHolidayID: id },
      });
      
      // Then delete the PublicHoliday record
      return prisma.publicHoliday.delete({ where: { id } });
    });
  }
}
