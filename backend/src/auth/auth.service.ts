import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomInt } from 'crypto';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ForgotPasswordDto,
  VerifyForgotPasswordDto,
  VerifyLoginOtpDto,
} from './dto/forgot-password.dto';
import { AuthOtpPurpose, SubscriptionStatus } from '@prisma/client';

const SUBSCRIPTION_EXEMPT_ROLES = ['SUPERADMIN', 'SERVICE_PROVIDER'];
const EMAIL_NOT_FOUND_MSG =
  'Wrong email address or email not found. Contact your administrator.';
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwt: JwtService,
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    return this.usersService.create(dto);
  }

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

    user = await this.usersService.findOneByUsername(dto.username);

    if (!user) {
      const username = dto.username.trim();
      const employeeCreds = await this.prisma.employeeCredentials.findFirst({
        where: {
          isActive: true,
          username: { equals: username, mode: 'insensitive' },
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeFirstName: true,
              employeeLastName: true,
              employeeID: true,
              businessEmail: true,
              personalEmail: true,
              isCompanyOwner: true,
              ownerTitle: true,
              departments: {
                select: {
                  id: true,
                  departmentName: true,
                },
              },
              designations: {
                select: {
                  id: true,
                  designation: true,
                },
              },
              company: {
                select: {
                  id: true,
                  companyName: true,
                },
              },
              branches: {
                select: {
                  id: true,
                  branchName: true,
                },
              },
            },
          },
        },
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

    let isValidPassword = false;

    if (userType === 'user') {
      isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
    } else {
      isValidPassword = await this.passwordMatches(dto.password, user.password);
    }

    if (!isValidPassword) {
      await logFailed('Wrong password');
      throw new UnauthorizedException('Invalid credentials');
    }

    const companyIDForCheck =
      userType === 'user' ? user.companyID : user.companyID;
    const roleForCheck = userType === 'user' ? user.role : 'EMPLOYEE';
    if (!SUBSCRIPTION_EXEMPT_ROLES.includes(roleForCheck) && companyIDForCheck) {
      try {
        await this.assertCompanySubscriptionActive(companyIDForCheck);
      } catch (err) {
        await logFailed('Subscription expired');
        throw err;
      }
    }

    const isDesktopClient = dto.client !== 'mobile';

    if (
      isDesktopClient &&
      userType === 'user' &&
      user.role === 'SUPERADMIN' &&
      user.requireLoginOtp
    ) {
      const email = String(user.email || '').trim();
      if (!email) {
        throw new BadRequestException(
          'Email is not configured for this SuperAdmin. Contact your administrator.',
        );
      }

      const { pendingToken, maskedEmail } = await this.createAndSendOtp({
        purpose: AuthOtpPurpose.SUPERADMIN_LOGIN,
        identifier: `user:${user.id}`,
        to: email,
        payload: JSON.stringify({ userId: user.id }),
        subject: 'OpenHRM SuperAdmin login OTP',
        bodyLine: 'Use this 6-digit code to complete your SuperAdmin login.',
      });

      return {
        requiresOtp: true,
        pendingToken,
        maskedEmail,
      };
    }

    if (
      isDesktopClient &&
      userType === 'employee' &&
      user.employee?.isCompanyOwner
    ) {
      const email =
        String(user.employee?.businessEmail || '').trim() ||
        String(user.employee?.personalEmail || '').trim();
      if (!email) {
        throw new BadRequestException(
          'Email is not configured for this Company Admin. Contact your administrator.',
        );
      }

      const { pendingToken, maskedEmail } = await this.createAndSendOtp({
        purpose: AuthOtpPurpose.SUPERADMIN_LOGIN,
        identifier: `employee:${user.employeeID}`,
        to: email,
        payload: JSON.stringify({ employeeId: user.employeeID }),
        subject: 'OpenHRM Company Admin login OTP',
        bodyLine: 'Use this 6-digit code to complete your Company Admin login.',
      });

      return {
        requiresOtp: true,
        pendingToken,
        maskedEmail,
      };
    }

    return this.issueLoginResponse(user, userType, req);
  }

  async verifyLoginOtp(dto: VerifyLoginOtpDto, req?: Request) {
    const row = await this.consumeOtpIfValid(
      dto.pendingToken,
      dto.otp,
      AuthOtpPurpose.SUPERADMIN_LOGIN,
      false,
    );

    let userId: number | null = null;
    let employeeId: number | null = null;
    try {
      const payload = row.payload ? JSON.parse(row.payload) : null;
      userId = payload?.userId != null ? Number(payload.userId) : null;
      employeeId = payload?.employeeId != null ? Number(payload.employeeId) : null;
    } catch {
      userId = null;
      employeeId = null;
    }

    if (employeeId) {
      const employeeCreds = await this.prisma.employeeCredentials.findFirst({
        where: {
          employeeID: employeeId,
          isActive: true,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeFirstName: true,
              employeeLastName: true,
              employeeID: true,
              businessEmail: true,
              personalEmail: true,
              isCompanyOwner: true,
              ownerTitle: true,
              departments: {
                select: { id: true, departmentName: true },
              },
              designations: {
                select: { id: true, designation: true },
              },
              company: {
                select: { id: true, companyName: true },
              },
              branches: {
                select: { id: true, branchName: true },
              },
            },
          },
        },
      });
      if (!employeeCreds) {
        throw new UnauthorizedException('Invalid credentials');
      }
      await this.markOtpConsumed(row.id);
      return this.issueLoginResponse(employeeCreds, 'employee', req);
    }

    if (!userId) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.markOtpConsumed(row.id);
    return this.issueLoginResponse(user, 'user', req);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const identifier = String(dto.emailOrMobile || '').trim();
    if (!identifier) {
      throw new BadRequestException(EMAIL_NOT_FOUND_MSG);
    }

    const employee = identifier.includes('@')
      ? await this.findEmployeeByEmail(identifier)
      : await this.findEmployeeByMobile(identifier);

    if (!employee) {
      throw new BadRequestException(EMAIL_NOT_FOUND_MSG);
    }

    const to = this.employeeEmail(employee);
    if (!to) {
      throw new BadRequestException(EMAIL_NOT_FOUND_MSG);
    }

    if (!employee.employeeCredentials) {
      throw new BadRequestException(EMAIL_NOT_FOUND_MSG);
    }

    const { pendingToken, maskedEmail } = await this.createAndSendOtp({
      purpose: AuthOtpPurpose.FORGOT_PASSWORD,
      identifier: `employee:${employee.id}`,
      to,
      payload: JSON.stringify({ employeeID: employee.id }),
      subject: 'OpenHRM password reset OTP',
      bodyLine: 'Use this 6-digit code to reset your OpenHRM password.',
    });

    return {
      message: `OTP sent to ${maskedEmail}`,
      resetToken: pendingToken,
      maskedEmail,
    };
  }

  async verifyForgotPassword(dto: VerifyForgotPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirm password do not match');
    }

    if (dto.newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }

    const row = await this.consumeOtpIfValid(
      dto.resetToken,
      dto.otp,
      AuthOtpPurpose.FORGOT_PASSWORD,
      false,
    );

    let employeeID: number | null = null;
    try {
      const payload = row.payload ? JSON.parse(row.payload) : null;
      employeeID = payload?.employeeID != null ? Number(payload.employeeID) : null;
    } catch {
      employeeID = null;
    }

    if (!employeeID) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const credentials = await this.prisma.employeeCredentials.findUnique({
      where: { employeeID },
    });
    if (!credentials) {
      throw new BadRequestException(EMAIL_NOT_FOUND_MSG);
    }

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.employeeCredentials.update({
      where: { employeeID },
      data: {
        password: hashed,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    await this.markOtpConsumed(row.id);

    return { message: 'Password reset successfully. You can now log in.' };
  }

  async logout(req: Request) {
    await this.auditLog.logFromRequest(req, {
      action: 'LOGOUT',
      module: 'AUTH',
    });
    return { ok: true };
  }

  async assertCompanySubscriptionActive(companyID?: number | null) {
    if (!companyID) return;

    const latest = await this.prisma.companySubscription.findFirst({
      where: { companyID },
      orderBy: { endDate: 'desc' },
    });

    if (!latest) return;

    const expired =
      latest.status === SubscriptionStatus.EXPIRED ||
      latest.status === SubscriptionStatus.CANCELLED ||
      new Date(latest.endDate).getTime() < Date.now();

    if (expired) {
      throw new ForbiddenException('SUBSCRIPTION_EXPIRED');
    }
  }

  async validateUser(payload: any) {
    if (payload.type === 'user') {
      return await this.usersService.findOne(payload.sub);
    }
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
          },
        },
      },
    });
  }

  private async issueLoginResponse(
    user: any,
    userType: 'user' | 'employee',
    req?: Request,
  ) {
    let payload: any;
    let userData: any;

    if (userType === 'user') {
      payload = {
        sub: user.id,
        username: user.username,
        role: user.role,
        type: 'user',
        companyID: user.companyID ?? undefined,
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
      payload = {
        sub: user.employeeID,
        username: user.username,
        role: 'EMPLOYEE',
        type: 'employee',
        employeeId: user.employeeID,
        serviceProviderID: user.serviceProviderID,
        companyID: user.companyID,
        branchesID: user.branchesID,
      };
      userData = {
        id: user.employeeID,
        username: user.username,
        role: 'EMPLOYEE',
        type: 'employee',
        mustChangePassword: user.mustChangePassword === true,
        isCompanyOwner: !!user.employee?.isCompanyOwner,
        ownerTitle: user.employee?.ownerTitle ?? null,
        employee: {
          id: user.employee.id,
          employeeID: user.employee.employeeID,
          firstName: user.employee.employeeFirstName,
          lastName: user.employee.employeeLastName,
          email: user.employee.businessEmail,
          isCompanyOwner: !!user.employee?.isCompanyOwner,
          ownerTitle: user.employee?.ownerTitle ?? null,
          department: user.employee.departments?.departmentName,
          designation: user.employee.designations?.designation,
          company: user.employee.company?.companyName,
          branch: user.employee.branches?.branchName,
        },
        employeeCredentials: {
          mustChangePassword: user.mustChangePassword === true,
        },
        serviceProviderID: user.serviceProviderID,
        companyID: user.companyID,
        branchesID: user.branchesID,
      };
    }

    const accessToken = this.jwt.sign(payload, {
      secret: process.env.JWT_SECRET || 'secret123',
      expiresIn: '12h',
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

  private async passwordMatches(plain: string, hash: string): Promise<boolean> {
    if (await bcrypt.compare(plain, hash)) return true;
    const digits = String(plain || '').replace(/\D/g, '');
    if (digits && digits !== plain) {
      return bcrypt.compare(digits, hash);
    }
    return false;
  }

  private employeeEmail(emp: {
    personalEmail?: string | null;
    businessEmail?: string | null;
    employeeCredentials?: { username?: string | null } | null;
  }): string {
    return (
      String(emp.personalEmail || '').trim() ||
      String(emp.businessEmail || '').trim() ||
      (String(emp.employeeCredentials?.username || '').includes('@')
        ? String(emp.employeeCredentials?.username).trim()
        : '')
    );
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    if (local.length <= 2) return `${local[0] || '*'}xxx@${domain}`;
    return `${local[0]}xxx${local[local.length - 1]}@${domain}`;
  }

  private async findEmployeeByEmail(email: string) {
    const value = email.trim();
    return this.prisma.manageEmployee.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { personalEmail: { equals: value, mode: 'insensitive' } },
          { businessEmail: { equals: value, mode: 'insensitive' } },
          {
            employeeCredentials: {
              is: { username: { equals: value, mode: 'insensitive' } },
            },
          },
        ],
      },
      include: { employeeCredentials: true },
    });
  }

  private async findEmployeeByMobile(mobile: string) {
    const trimmed = mobile.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return null;

    const candidates = await this.prisma.manageEmployee.findMany({
      where: {
        isDeleted: false,
        OR: [
          { personalPhoneNo: trimmed },
          { personalPhoneNo: { contains: digits } },
        ],
      },
      include: { employeeCredentials: true },
    });

    const matches = candidates.filter((row) => {
      const rowDigits = String(row.personalPhoneNo || '').replace(/\D/g, '');
      return rowDigits === digits || String(row.personalPhoneNo || '').trim() === trimmed;
    });

    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const withEmail = matches.filter((row) => this.employeeEmail(row));
      return withEmail[0] || matches[0];
    }
    return null;
  }

  private async createAndSendOtp(params: {
    purpose: AuthOtpPurpose;
    identifier: string;
    to: string;
    payload: string;
    subject: string;
    bodyLine: string;
  }) {
    if (!this.mail.isConfigured()) {
      throw new BadRequestException(
        'Email could not be sent. Contact your administrator.',
      );
    }

    await this.prisma.authOtp.updateMany({
      where: {
        purpose: params.purpose,
        identifier: params.identifier,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    const otp = String(randomInt(100000, 1000000));
    const pendingToken = randomBytes(32).toString('hex');
    const codeHash = await bcrypt.hash(otp, OTP_SALT_ROUNDS);

    await this.prisma.authOtp.create({
      data: {
        purpose: params.purpose,
        identifier: params.identifier,
        codeHash,
        pendingToken,
        payload: params.payload,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    const sent = await this.mail.sendRawEmail({
      to: params.to,
      subject: params.subject,
      html:
        `<p>${params.bodyLine}</p>` +
        `<p style="font-size:22px;letter-spacing:4px;font-weight:700">${otp}</p>` +
        `<p>This code expires in 10 minutes.</p>`,
      text: `${params.bodyLine}\n\n${otp}\n\nThis code expires in 10 minutes.`,
    });

    if (!sent) {
      throw new BadRequestException(
        'Email could not be sent. Contact your administrator.',
      );
    }

    return {
      pendingToken,
      maskedEmail: this.maskEmail(params.to),
    };
  }

  private async consumeOtpIfValid(
    pendingToken: string,
    otp: string,
    purpose: AuthOtpPurpose,
    consume: boolean,
  ) {
    const row = await this.prisma.authOtp.findUnique({
      where: { pendingToken: String(pendingToken || '').trim() },
    });

    if (!row || row.purpose !== purpose || row.consumedAt) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const ok = await bcrypt.compare(String(otp || '').trim(), row.codeHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    if (consume) {
      await this.markOtpConsumed(row.id);
    }

    return row;
  }

  private markOtpConsumed(id: number) {
    return this.prisma.authOtp.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
}
