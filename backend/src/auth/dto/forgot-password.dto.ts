import { IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  emailOrMobile: string;
}

export class VerifyForgotPasswordDto {
  @IsString()
  resetToken: string;

  @IsString()
  @MinLength(6)
  otp: string;

  @IsString()
  @MinLength(8)
  newPassword: string;

  @IsString()
  @MinLength(8)
  confirmPassword: string;
}

export class VerifyLoginOtpDto {
  @IsString()
  pendingToken: string;

  @IsString()
  @MinLength(6)
  otp: string;
}

export class ResendLoginOtpDto {
  @IsString()
  pendingToken: string;
}
