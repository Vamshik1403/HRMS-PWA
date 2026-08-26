import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private normalizeCompanyIDs(companyID?: number | null, companyIDs?: number[]) {
    const ids = new Set<number>()

    if (companyID) ids.add(Number(companyID))

    if (Array.isArray(companyIDs)) {
      companyIDs.forEach((id) => {
        if (id) ids.add(Number(id))
      })
    }

    return Array.from(ids)
  }

  async create(createUserDto: CreateUserDto) {
    try {
      const role = (createUserDto.role as UserRole) || UserRole.EMPLOYEE
      if (role === UserRole.COMPANY_ADMIN) {
        throw new ConflictException(
          'COMPANY_ADMIN creation is disabled. Create a Company Owner via POST /company/:id/owner instead.',
        )
      }

      if (!createUserDto.email?.trim()) {
        throw new BadRequestException('Email is required')
      }
      if (!createUserDto.contactNo?.trim()) {
        throw new BadRequestException('Contact number is required')
      }

      if (role === UserRole.SUPERADMIN && !createUserDto.email?.trim()) {
        throw new BadRequestException('Email is required for SuperAdmin accounts')
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { username: createUserDto.username },
      })

      if (existingUser) {
        throw new ConflictException('Username already exists')
      }

      const companyIDs = this.normalizeCompanyIDs(
        createUserDto.companyID,
        createUserDto.companyIDs,
      )

      const primaryCompanyID =
        createUserDto.companyID ?? companyIDs[0] ?? null

      const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12
      const passwordHash = await bcrypt.hash(createUserDto.password, saltRounds)

      const user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            username: createUserDto.username,
            passwordHash,
            role,
            firstName: createUserDto.firstName ?? null,
            lastName: createUserDto.lastName ?? null,
            contactNo: createUserDto.contactNo ?? null,
            email: createUserDto.email ?? null,
            requireLoginOtp: role === UserRole.SUPERADMIN,
            serviceProviderID: createUserDto.serviceProviderID ?? null,
            companyID: primaryCompanyID,
            branchesID: createUserDto.branchesID ?? null,
            contractorID: createUserDto.contractorID ?? null,
            isActive: createUserDto.isActive ?? true,
          },
        })

        if (companyIDs.length > 0) {
          await tx.userCompany.createMany({
            data: companyIDs.map((companyID) => ({
              userID: createdUser.id,
              companyID,
              isPrimary: Number(companyID) === Number(primaryCompanyID),
            })),
            skipDuplicates: true,
          })
        }

        return tx.user.findUnique({
          where: { id: createdUser.id },
          include: {
            serviceProvider: true,
            company: true,
            branches: true,
            userCompanies: {
              include: {
                company: {
                  select: {
                    id: true,
                    companyName: true,
                  },
                },
              },
            },
          },
        })
      })

      return this.excludePassword(user)
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error
      console.error(error)
      throw new InternalServerErrorException('Failed to create user')
    }
  }

  async findAll() {
    try {
      return this.prisma.user.findMany({
        select: {
          id: true,
          username: true,
          role: true,
          firstName: true,
          lastName: true,
          contactNo: true,
          email: true,
          requireLoginOtp: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          serviceProviderID: true,
          companyID: true,
          branchesID: true,
          contractorID: true,
          serviceProvider: {
            select: { companyName: true },
          },
          company: {
            select: { id: true, companyName: true },
          },
          branches: {
            select: { branchName: true },
          },
          contractors: {
            select: { contractorName: true },
          },
          userCompanies: {
            select: {
              id: true,
              userID: true,
              companyID: true,
              isPrimary: true,
              company: {
                select: {
                  id: true,
                  companyName: true,
                },
              },
            },
          },
        },
        orderBy: { id: 'desc' },
      })
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch users')
    }
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        userCompanies: {
          include: {
            company: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
          orderBy: {
            isPrimary: 'desc',
          },
        },
      },
    })

    if (!user) throw new NotFoundException(`User with ID ${id} not found`)
    return this.excludePassword(user)
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id } })
      if (!user) throw new NotFoundException(`User with ID ${id} not found`)

      const nextEmail =
        updateUserDto.email !== undefined ? updateUserDto.email : user.email
      const nextContact =
        updateUserDto.contactNo !== undefined ? updateUserDto.contactNo : user.contactNo
      if (!String(nextEmail || '').trim()) {
        throw new BadRequestException('Email is required')
      }
      if (!String(nextContact || '').trim()) {
        throw new BadRequestException('Contact number is required')
      }

      if (updateUserDto.username) {
        const existing = await this.prisma.user.findFirst({
          where: { username: updateUserDto.username, id: { not: id } },
        })

        if (existing) throw new ConflictException('Username already taken')
      }

      const companyIDs = this.normalizeCompanyIDs(
        updateUserDto.companyID ?? user.companyID,
        updateUserDto.companyIDs,
      )

      const primaryCompanyID =
        updateUserDto.companyID ?? user.companyID ?? companyIDs[0] ?? null

      const updateData: any = {
        username: updateUserDto.username ?? undefined,
        role: updateUserDto.role ?? undefined,
        firstName: updateUserDto.firstName ?? undefined,
        lastName: updateUserDto.lastName ?? undefined,
        contactNo: updateUserDto.contactNo ?? undefined,
        email: updateUserDto.email ?? undefined,
        
        isActive: updateUserDto.isActive ?? undefined,
        serviceProviderID:
          updateUserDto.serviceProviderID ?? user.serviceProviderID,
        companyID: primaryCompanyID,
        branchesID: updateUserDto.branchesID ?? user.branchesID,
        contractorID: updateUserDto.contractorID ?? user.contractorID,
      }

      if (updateUserDto.password) {
        const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12
        updateData.passwordHash = await bcrypt.hash(
          updateUserDto.password,
          saltRounds,
        )
      }

      const updatedUser = await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: updateData,
        })

        if (Array.isArray(updateUserDto.companyIDs) || updateUserDto.companyID) {
          await tx.userCompany.deleteMany({
            where: { userID: id },
          })

          if (companyIDs.length > 0) {
            await tx.userCompany.createMany({
              data: companyIDs.map((companyID) => ({
                userID: id,
                companyID,
                isPrimary: Number(companyID) === Number(primaryCompanyID),
              })),
              skipDuplicates: true,
            })
          }
        }

        return tx.user.findUnique({
          where: { id },
          include: {
            serviceProvider: true,
            company: true,
            branches: true,
            userCompanies: {
              include: {
                company: {
                  select: {
                    id: true,
                    companyName: true,
                  },
                },
              },
            },
          },
        })
      })

      return this.excludePassword(updatedUser)
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error
      }

      console.error(error)
      throw new InternalServerErrorException('Failed to update user')
    }
  }

  async remove(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException(`User with ID ${id} not found`)

    await this.prisma.user.delete({ where: { id } })
    return { message: `User with ID ${id} deleted successfully` }
  }

  async validateCredentials(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        userCompanies: {
          include: {
            company: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
      },
    })

    if (!user || !user.isActive) return null

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return null

    return this.excludePassword(user)
  }

  async findOneByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
        userCompanies: {
          include: {
            company: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
      },
    })
  }

  async getProfile(userId: number) {
    return this.prisma.userProfile.findUnique({
      where: { userId },
    })
  }

  async upsertProfile(
    userId: number,
    data: {
      fullName?: string
      email?: string
      mobileNo?: string
      address?: string
      city?: string
      state?: string
      pincode?: string
    },
  ) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    })
  }

  private excludePassword(user: any) {
    if (!user) return user
    const { passwordHash, ...rest } = user
    return rest
  }
}