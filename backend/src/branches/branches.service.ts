import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchesDto } from './dto/create-branch.dto';
import { UpdateBranchesDto } from './dto/update-branch.dto';
import { composeAddressQuery } from '../common/reverse-geocode';
import { GoogleMapsService } from '../google-maps/google-maps.service';

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private googleMaps: GoogleMapsService,
  ) {}

  private toPositiveId(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private async resolveCompanyAndSp(
    companyID?: number | null,
    serviceProviderID?: number | null,
  ) {
    const resolvedCompanyID = this.toPositiveId(companyID);
    if (!resolvedCompanyID) {
      throw new BadRequestException('Company is required to create a branch.');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: resolvedCompanyID },
      select: { id: true, serviceProviderID: true, companyName: true },
    });
    if (!company) {
      throw new NotFoundException(
        `Company with ID ${resolvedCompanyID} was not found.`,
      );
    }

    let resolvedSpID = this.toPositiveId(serviceProviderID);
    if (resolvedSpID) {
      const sp = await this.prisma.serviceProvider.findUnique({
        where: { id: resolvedSpID },
        select: { id: true },
      });
      if (!sp) {
        // Stale sidebar / client SP — fall back to the company's SP.
        resolvedSpID = this.toPositiveId(company.serviceProviderID);
      }
    } else {
      resolvedSpID = this.toPositiveId(company.serviceProviderID);
    }

    return { companyID: company.id, serviceProviderID: resolvedSpID };
  }

  private async resolveBranchPin(opts: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
    latitude?: unknown;
    longitude?: unknown;
    placeId?: string | null;
    locationSource?: string | null;
    refetchLocation?: boolean;
    existing?: {
      address?: string | null;
      city?: string | null;
      state?: string | null;
      pincode?: string | null;
      country?: string | null;
      latitude?: string | null;
      longitude?: string | null;
      placeId?: string | null;
      locationSource?: string | null;
      locationVerified?: boolean | null;
    } | null;
  }) {
    const addressQuery = composeAddressQuery(
      opts.address,
      opts.city,
      opts.state,
      opts.pincode,
      opts.country,
    );
    const existingQuery = opts.existing
      ? composeAddressQuery(
          opts.existing.address,
          opts.existing.city,
          opts.existing.state,
          opts.existing.pincode,
          opts.existing.country,
        )
      : '';
    const pin = await this.googleMaps.resolvePin({
      feature: 'branch',
      addressQuery,
      incomingLat: opts.latitude,
      incomingLng: opts.longitude,
      incomingPlaceId: opts.placeId,
      incomingSource: opts.locationSource,
      refetch: opts.refetchLocation === true,
      existing: opts.existing
        ? { ...opts.existing, address: existingQuery }
        : null,
      missingMessage:
        'Could not find coordinates for this branch address. Please check the address.',
    });
    if (!pin) return {};
    return {
      latitude: pin.latitude,
      longitude: pin.longitude,
      placeId: pin.placeId,
      locationSource: pin.locationSource,
      locationVerified: pin.locationVerified,
    };
  }

  async create(dto: CreateBranchesDto) {
    const {
      bankDetails = [],
      serviceProviderID,
      companyID,
      latitude: _lat,
      longitude: _lng,
      placeId,
      locationSource,
      locationVerified: _verified,
      refetchLocation,
      ...branch
    } = dto;
    const resolved = await this.resolveCompanyAndSp(companyID, serviceProviderID);
    const coords = await this.resolveBranchPin({
      ...branch,
      latitude: _lat,
      longitude: _lng,
      placeId,
      locationSource,
      refetchLocation,
    });

    return this.prisma.branches.create({
      data: {
        ...branch,
        ...(coords ?? {}),
        ...(resolved.serviceProviderID != null
          ? { serviceProvider: { connect: { id: resolved.serviceProviderID } } }
          : {}),
        company: { connect: { id: resolved.companyID } },
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

  async update(id: number, dto: UpdateBranchesDto) {
    const {
      bankDetails,
      idsToDelete,
      serviceProviderID,
      companyID,
      latitude: _lat,
      longitude: _lng,
      placeId,
      locationSource,
      locationVerified: _verified,
      refetchLocation,
      ...branch
    } = dto;

    const existing = await this.prisma.branches.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Branch with ID ${id} was not found.`);
    }
    const coords = await this.resolveBranchPin({
      address: dto.address !== undefined ? dto.address : existing.address,
      city: dto.city !== undefined ? dto.city : existing.city,
      state: dto.state !== undefined ? dto.state : existing.state,
      pincode: dto.pincode !== undefined ? dto.pincode : existing.pincode,
      country: dto.country !== undefined ? dto.country : existing.country,
      latitude: _lat,
      longitude: _lng,
      placeId,
      locationSource,
      refetchLocation,
      existing,
    });

    return this.prisma.$transaction(async (tx) => {
      let companyConnect: { connect: { id: number } } | { disconnect: true } | undefined;
      let spConnect:
        | { connect: { id: number } }
        | { disconnect: true }
        | undefined;

      if (companyID !== undefined) {
        if (companyID == null) {
          companyConnect = { disconnect: true };
        } else {
          const resolved = await this.resolveCompanyAndSp(
            companyID,
            serviceProviderID,
          );
          companyConnect = { connect: { id: resolved.companyID } };
          if (resolved.serviceProviderID != null) {
            spConnect = { connect: { id: resolved.serviceProviderID } };
          }
        }
      } else if (serviceProviderID !== undefined) {
        if (serviceProviderID == null) {
          spConnect = { disconnect: true };
        } else {
          const spId = this.toPositiveId(serviceProviderID);
          if (!spId) {
            throw new BadRequestException('Invalid service provider ID.');
          }
          const sp = await tx.serviceProvider.findUnique({
            where: { id: spId },
            select: { id: true },
          });
          if (!sp) {
            throw new NotFoundException(
              `Service provider with ID ${spId} was not found.`,
            );
          }
          spConnect = { connect: { id: spId } };
        }
      }

      // 1) update branch scalars and relations
      await tx.branches.update({
        where: { id },
        data: {
          ...branch,
          ...(coords ?? {}),
          ...(spConnect ? { serviceProvider: spConnect } : {}),
          ...(companyConnect ? { company: companyConnect } : {}),
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
              branchesID: id,
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
