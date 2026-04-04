import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchesDto } from './dto/create-branch.dto';
import { UpdateBranchesDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  // CREATE branch + nested bank rows
  create(dto: CreateBranchesDto) {
    const { bankDetails = [], serviceProviderID, companyID, ...branch } = dto;

    return this.prisma.branches.create({
      data: {
        ...branch,
        ...(serviceProviderID != null
          ? { serviceProvider: { connect: { id: serviceProviderID } } }
          : {}),
        ...(companyID != null
          ? { company: { connect: { id: companyID } } }
          : {}),
        bankDetails: {
          create: bankDetails.map((b) => ({
            bankName: b.bankName ?? null,
            bankBranchName: b.bankBranchName ?? null,
            accountNo: b.accountNo ?? null,
            ifscCode: b.ifscCode ?? null,
          })),
        },
      },
      include: { serviceProvider: true, company: true, bankDetails: true },
    });
  }

  findAll() {
    return this.prisma.branches.findMany({
      include: { serviceProvider: true, company: true, bankDetails: true },
    });
  }

  findOne(id: number) {
    return this.prisma.branches.findUnique({
      where: { id },
      include: { serviceProvider: true, company: true, bankDetails: true },
    });
  }

  // UPDATE branch + (update/create/delete) bank rows
  async update(id: number, dto: UpdateBranchesDto) {
    const { bankDetails, idsToDelete, serviceProviderID, companyID, ...branch } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 1) update branch scalars and relations
      await tx.branches.update({
        where: { id },
        data: {
          ...branch,
          ...(serviceProviderID !== undefined
            ? serviceProviderID == null
              ? { serviceProvider: { disconnect: true } }
              : { serviceProvider: { connect: { id: serviceProviderID } } }
            : {}),
          ...(companyID !== undefined
            ? companyID == null
              ? { company: { disconnect: true } }
              : { company: { connect: { id: companyID } } }
            : {}),
        },
      });

      // 2) delete removed bank rows
      if (idsToDelete?.length) {
        await tx.bankDetails.deleteMany({
          where: { id: { in: idsToDelete }, branchesID: id },
        });
      }

      // 3) upsert bank rows if provided
      if (bankDetails?.length) {
        const toUpdate = bankDetails.filter((b) => !!b.id);
        const toCreate = bankDetails.filter((b) => !b.id);

        for (const b of toUpdate) {
          await tx.bankDetails.update({
            where: { id: b.id! },
            data: {
              bankName: b.bankName ?? null,
              bankBranchName: b.bankBranchName ?? null,
              accountNo: b.accountNo ?? null,
              ifscCode: b.ifscCode ?? null,
            },
          });
        }

        if (toCreate.length) {
          await tx.bankDetails.createMany({
            data: toCreate.map((b) => ({
              branchesID: id, // unchecked path for createMany is fine
              bankName: b.bankName ?? null,
              bankBranchName: b.bankBranchName ?? null,
              accountNo: b.accountNo ?? null,
              ifscCode: b.ifscCode ?? null,
            })),
          });
        }
      }

      // 4) return fresh
      return tx.branches.findUnique({
        where: { id },
        include: { bankDetails: true, serviceProvider: true, company: true },
      });
    });
  }

  remove(id: number) {
    return this.prisma.branches.delete({ where: { id } });
  }
}
