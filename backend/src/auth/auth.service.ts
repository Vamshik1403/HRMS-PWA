import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwt: JwtService,
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  // REGISTER (only for regular users, not employees)
  async register(dto: RegisterDto) {
    return this.usersService.create(dto);
  }

  // LOGIN - Check both Users and EmployeeCredentials tables
  async login(dto: LoginDto, req?: Request) {
    let user: any = null;
    let userType: 'user' | 'employee' = 'user';

    const logFailed = async (reason: string) => {
      await this.auditLog.logFromRequest(req, {
        action: 'LOGIN_FAILED',
        module: 'AUTH',
        entityName: dto.username,
        success: false,
        failureReason: reason,
        newData: { username: dto.username },
      });
    };

    // First, check in Users table
    user = await this.usersService.findOneByUsername(dto.username);
    
    // If not found in Users table, check in EmployeeCredentials table
    if (!user) {
      const employeeCreds = await this.prisma.employeeCredentials.findFirst({
        where: { 
          username: dto.username,
          isActive: true 
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeFirstName: true,
              employeeLastName: true,
              employeeID: true,
              businessEmail: true,
              departments: {
                select: {
                  id: true,
                  departmentName: true,
                }
              },
              designations: {
                select: {
                  id: true,
                  designation: true,
                }
              },
              company: {
                select: {
                  id: true,
                  companyName: true,
                }
              },
              branches: {
                select: {
                  id: true,
                  branchName: true,
                }
              }
            }
          }
        }
      });

      if (employeeCreds) {
        user = employeeCreds;
        userType = 'employee';
      }
    }

    if (!user) {
      await logFailed('Invalid credentials');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate password based on user type
    let isValidPassword = false;
    
    if (userType === 'user') {
      // Check password for regular user
      isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
    } else {
      // Check password for employee (already hashed in EmployeeCredentials)
      isValidPassword = await bcrypt.compare(dto.password, user.password);
    }

    if (!isValidPassword) {
      await logFailed('Wrong password');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT payload based on user type
    let payload: any;
    let userData: any;

    if (userType === 'user') {
      payload = { 
        sub: user.id, 
        username: user.username, 
        role: user.role,
        type: 'user'
      };
      userData = {
        id: user.id,
        username: user.username,
        role: user.role,
        type: 'user',
        serviceProviderID: user.serviceProviderID ?? undefined,
        companyID: user.companyID ?? undefined,
        branchesID: user.branchesID ?? undefined,
      };

      // For roles that are scoped to SP/Company/Branch, fetch relation names
      if (user.serviceProviderID || user.companyID || user.branchesID) {
        const fullUser = await this.prisma.user.findUnique({
          where: { id: user.id },
          include: {
            serviceProvider: { select: { companyName: true } },
            company: { select: { companyName: true } },
            branches: { select: { branchName: true } },
          },
        });
        if (fullUser?.serviceProvider) userData.serviceProvider = fullUser.serviceProvider;
        if (fullUser?.company) userData.company = fullUser.company;
        if (fullUser?.branches) userData.branches = fullUser.branches;
      }
    } else {
      // Employee user
      payload = {
        sub: user.employeeID,
        username: user.username,
        role: 'EMPLOYEE',
        type: 'employee',
        employeeId: user.employeeID,
        serviceProviderID: user.serviceProviderID,
        companyID: user.companyID,
        branchesID: user.branchesID
      };
      userData = {
        id: user.employeeID,
        username: user.username,
        role: 'EMPLOYEE',
        type: 'employee',
        employee: {
          id: user.employee.id,
          employeeID: user.employee.employeeID,
          firstName: user.employee.employeeFirstName,
          lastName: user.employee.employeeLastName,
          email: user.employee.businessEmail,
          department: user.employee.departments?.departmentName,
          designation: user.employee.designations?.designationName,
          company: user.employee.company?.companyName,
          branch: user.employee.branches?.branchName
        },
        serviceProviderID: user.serviceProviderID,
        companyID: user.companyID,
        branchesID: user.branchesID
      };
    }

    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_SECRET || 'secret123',
      expiresIn: '1d',
    });

    await this.auditLog.logFromRequest(req, {
      action: 'LOGIN',
      module: 'AUTH',
      entityId: userData.id,
      entityName: userData.username,
      newData: { role: userData.role, type: userData.type },
      actor: {
        userId: userType === 'user' ? user.id : user.employeeID,
        username: userData.username,
        userRole: userData.role,
        employeeName:
          userType === 'employee'
            ? `${user.employee?.employeeFirstName || ''} ${user.employee?.employeeLastName || ''}`.trim()
            : undefined,
      },
    });

    return {
      accessToken,
      user: userData,
    };
  }

  async logout(req: Request) {
    await this.auditLog.logFromRequest(req, {
      action: 'LOGOUT',
      module: 'AUTH',
    });
    return { ok: true };
  }

  // Optional: Method to get user profile from token
  async validateUser(payload: any) {
    if (payload.type === 'user') {
      return await this.usersService.findOne(payload.sub);
    } else {
      return await this.prisma.employeeCredentials.findUnique({
        where: { employeeID: payload.sub },
        include: {
          employee: {
            select: {
              id: true,
              employeeFirstName: true,
              employeeLastName: true,
              employeeID: true,
              businessEmail: true,
            }
          }
        }
      });
    }
  }
}