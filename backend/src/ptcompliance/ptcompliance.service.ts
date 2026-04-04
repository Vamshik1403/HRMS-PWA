import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePTComplianceDto } from './dto/create-ptcompliance.dto';
import { UpdatePTComplianceDto } from './dto/update-ptcompliance.dto';

@Injectable()
export class PTComplianceService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePTComplianceDto) {
    const { ptslab, ...mainData } = dto;
    
    return this.prisma.pTCompliance.create({
      data: {
        companyID: mainData.companyID,
        branchID: mainData.branchID,
        ptApplicable: mainData.ptApplicable,
        state: mainData.state,
        maxPTPersonPerYear: mainData.maxPTPersonPerYear,
        monthlyDueDate: mainData.monthlyDueDate,
        quarterlyDueDate: mainData.quarterlyDueDate,
        monthlyReturnThreshold: mainData.monthlyReturnThreshold,
        quarterlyReturnThreshold: mainData.quarterlyReturnThreshold,
        ptslab: ptslab ? {
          create: ptslab.map(slab => ({
            slabName: slab.slabName,
            monthlyGrossFrom: slab.monthlyGrossFrom,
            monthlyGrossTo: slab.monthlyGrossTo,
            amount: slab.amount,
            applicableMonths: slab.applicableMonths ? JSON.stringify(slab.applicableMonths) : JSON.stringify([1,2,3,4,5,6,7,8,9,10,11,12])
          }))
        } : undefined
      },
      include: {
        ptslab: true,
        company: true,
        branch: true
      }
    });
  }

  async findAll() {
    const data = await this.prisma.pTCompliance.findMany({
      include: {
        ptslab: true,
        company: true,
        branch: true
      },
      orderBy: { id: 'desc' },
    });
    
    // Parse JSON strings back to arrays
    return data.map(item => ({
      ...item,
      ptslab: item.ptslab.map(slab => ({
        ...slab,
        applicableMonths: slab.applicableMonths ? JSON.parse(slab.applicableMonths as string) : []
      }))
    }));
  }

  async findByCompany(companyID: number) {
    const data = await this.prisma.pTCompliance.findMany({
      where: { companyID },
      include: {
        ptslab: true,
        branch: true,
        company: true
      }
    });
    
    // Parse JSON strings back to arrays
    return data.map(item => ({
      ...item,
      ptslab: item.ptslab.map(slab => ({
        ...slab,
        applicableMonths: slab.applicableMonths ? JSON.parse(slab.applicableMonths as string) : []
      }))
    }));
  }

  async findByBranch(branchID: number) {
    const data = await this.prisma.pTCompliance.findMany({
      where: { branchID },
      include: {
        ptslab: true,
        company: true
      }
    });
    
    // Parse JSON strings back to arrays
    return data.map(item => ({
      ...item,
      ptslab: item.ptslab.map(slab => ({
        ...slab,
        applicableMonths: slab.applicableMonths ? JSON.parse(slab.applicableMonths as string) : []
      }))
    }));
  }

  async findByCompanyAndBranch(companyID: number, branchID: number) {
    const data = await this.prisma.pTCompliance.findUnique({
      where: { 
        companyID_branchID: { companyID, branchID }
      },
      include: { 
        ptslab: true,
        company: true,
        branch: true 
      },
    });

    if (!data) {
      throw new NotFoundException(`PT Compliance not found for company ${companyID} and branch ${branchID}`);
    }
    
    // Parse JSON strings back to arrays
    return {
      ...data,
      ptslab: data.ptslab.map(slab => ({
        ...slab,
        applicableMonths: slab.applicableMonths ? JSON.parse(slab.applicableMonths as string) : []
      }))
    };
  }

  async update(companyID: number, branchID: number, dto: UpdatePTComplianceDto) {
    // First check if record exists
    await this.findByCompanyAndBranch(companyID, branchID);

    const { ptslab, ...mainData } = dto;

    // Use transaction to ensure data consistency
    return this.prisma.$transaction(async (prisma) => {
      // Update main PT Compliance
      const updated = await prisma.pTCompliance.update({
        where: { 
          companyID_branchID: { companyID, branchID }
        },
        data: {
          ...(mainData.ptApplicable !== undefined && { ptApplicable: mainData.ptApplicable }),
          ...(mainData.state !== undefined && { state: mainData.state }),
          ...(mainData.maxPTPersonPerYear !== undefined && { maxPTPersonPerYear: mainData.maxPTPersonPerYear }),
          ...(mainData.monthlyDueDate !== undefined && { monthlyDueDate: mainData.monthlyDueDate }),
          ...(mainData.quarterlyDueDate !== undefined && { quarterlyDueDate: mainData.quarterlyDueDate }),
          ...(mainData.monthlyReturnThreshold !== undefined && { monthlyReturnThreshold: mainData.monthlyReturnThreshold }),
          ...(mainData.quarterlyReturnThreshold !== undefined && { quarterlyReturnThreshold: mainData.quarterlyReturnThreshold }),
        }
      });

      // Handle slabs if provided
      if (ptslab) {
        // Delete existing slabs
        await prisma.pTSlab.deleteMany({
          where: { ptComplianceID: updated.id }
        });
        
        // Create new slabs
        if (ptslab.length > 0) {
          await prisma.pTSlab.createMany({
            data: ptslab.map(slab => ({
              slabName: slab.slabName,
              monthlyGrossFrom: slab.monthlyGrossFrom,
              monthlyGrossTo: slab.monthlyGrossTo,
              amount: slab.amount,
              applicableMonths: slab.applicableMonths ? JSON.stringify(slab.applicableMonths) : JSON.stringify([1,2,3,4,5,6,7,8,9,10,11,12]),
              ptComplianceID: updated.id
            }))
          });
        }
      }

      // Return updated record with slabs
      const result = await prisma.pTCompliance.findUnique({
        where: { id: updated.id },
        include: { 
          ptslab: true,
          company: true,
          branch: true 
        }
      });

      if (!result) {
        throw new NotFoundException('PT Compliance record not found after update');
      }

      // Parse JSON strings back to arrays
      return {
        ...result,
        ptslab: result.ptslab.map(slab => ({
          ...slab,
          applicableMonths: slab.applicableMonths ? JSON.parse(slab.applicableMonths as string) : []
        }))
      };
    });
  }

  async remove(companyID: number, branchID: number) {
    await this.findByCompanyAndBranch(companyID, branchID);
    
    return this.prisma.pTCompliance.delete({
      where: { 
        companyID_branchID: { companyID, branchID }
      }
    });
  }
}