import { Body, Controller, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ForgotPasswordDto,
  VerifyForgotPasswordDto,
  VerifyLoginOtpDto,
  ResendLoginOtpDto,
} from './dto/forgot-password.dto';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req);
  }

  @Post('login/verify-otp')
  verifyLoginOtp(@Body() dto: VerifyLoginOtpDto, @Req() req: Request) {
    return this.authService.verifyLoginOtp(dto, req);
  }

  @Post('login/resend-otp')
  resendLoginOtp(@Body() dto: ResendLoginOtpDto) {
    return this.authService.resendLoginOtp(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('forgot-password/verify')
  verifyForgotPassword(@Body() dto: VerifyForgotPasswordDto) {
    return this.authService.verifyForgotPassword(dto);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  logout(@Req() req: Request) {
    return this.authService.logout(req);
  }
}
