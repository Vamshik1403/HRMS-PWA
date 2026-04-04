import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { UserRole } from './dto/create-user.dto'
import * as bcrypt from 'bcrypt'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // 🟢 CREATE USER
  async create(createUserDto: CreateUserDto) {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { username: createUserDto.username },
      })
      if (existingUser) {
        throw new ConflictException('Username already exists')
      }

      const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12
      const passwordHash = await bcrypt.hash(createUserDto.password, saltRounds)

      const user = await this.prisma.user.create({
        data: {
          username: createUserDto.username,
          passwordHash,
          role: createUserDto.role || UserRole.EMPLOYEE,
          serviceProviderID: createUserDto.serviceProviderID ?? null,
          companyID: createUserDto.companyID ?? null,
          branchesID: createUserDto.branchesID ?? null,
        },
        include: {
          serviceProvider: true,
          company: true,
          branches: true,
        },
      })

      return this.excludePassword(user)
    } catch (error) {
      if (error instanceof ConflictException) throw error
      throw new InternalServerErrorException('Failed to create user')
    }
  }

  // 🟢 FIND ALL USERS
  async findAll() {
    try {
      const users = await this.prisma.user.findMany({
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          serviceProviderID: true,
          companyID: true,
          branchesID: true,
          serviceProvider: {
            select: { companyName: true },
          },
          company: {
            select: { companyName: true },
          },
          branches: {
            select: { branchName: true },
          },
        },
        orderBy: { id: 'desc' },
      })
      return users
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch users')
    }
  }

  // 🟢 FIND ONE BY ID
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        serviceProvider: true,
        company: true,
        branches: true,
      },
    })

    if (!user) throw new NotFoundException(`User with ID ${id} not found`)
    return this.excludePassword(user)
  }

  // 🟢 UPDATE USER
  async update(id: number, updateUserDto: UpdateUserDto) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id } })
      if (!user) throw new NotFoundException(`User with ID ${id} not found`)

      // check for duplicate username
      if (updateUserDto.username) {
        const existing = await this.prisma.user.findFirst({
          where: { username: updateUserDto.username, id: { not: id } },
        })
        if (existing) throw new ConflictException('Username already taken')
      }

      const updateData: any = {
        username: updateUserDto.username ?? undefined,
        role: updateUserDto.role ?? undefined,
        isActive: updateUserDto.isActive ?? undefined,
        serviceProviderID:
          updateUserDto.serviceProviderID ?? user.serviceProviderID,
        companyID: updateUserDto.companyID ?? user.companyID,
        branchesID: updateUserDto.branchesID ?? user.branchesID,
      }

      if (updateUserDto.password) {
        const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12
        updateData.passwordHash = await bcrypt.hash(
          updateUserDto.password,
          saltRounds,
        )
      }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: updateData,
        include: {
          serviceProvider: true,
          company: true,
          branches: true,
        },
      })
      return this.excludePassword(updatedUser)
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException)
        throw error
      throw new InternalServerErrorException('Failed to update user')
    }
  }

  // 🟢 DELETE USER
  async remove(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException(`User with ID ${id} not found`)

    await this.prisma.user.delete({ where: { id } })
    return { message: `User with ID ${id} deleted successfully` }
  }

  // 🟢 VALIDATE CREDENTIALS (for login)
  async validateCredentials(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } })
    if (!user || !user.isActive) return null

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return null

    return this.excludePassword(user)
  }

  // 🟢 FIND ONE BY USERNAME (used in AuthService)
  async findOneByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } })
  }

  // 🧩 Helper to exclude passwordHash from responses
  private excludePassword(user: any) {
    if (!user) return user
    const { passwordHash, ...rest } = user
    return rest
  }
}
