import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service'; // Add this import
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwt: JwtService,
    private prisma: PrismaService // Inject PrismaService
  ) {}

  // REGISTER (only for regular users, not employees)
  async register(dto: RegisterDto) {
    return this.usersService.create(dto);
  }

  // LOGIN - Check both Users and EmployeeCredentials tables
  async login(dto: LoginDto) {
    let user: any = null;
    let userType: 'user' | 'employee' = 'user';

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
        type: 'user'
      };
    } else {
      // Employee user
      payload = {
        sub: user.employeeID,
        username: user.username,
        role: 'employee',
        type: 'employee',
        employeeId: user.employeeID,
        serviceProviderID: user.serviceProviderID,
        companyID: user.companyID,
        branchesID: user.branchesID
      };
      userData = {
        id: user.employeeID,
        username: user.username,
        role: 'employee',
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

    return {
      accessToken,
      user: userData,
    };
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