import { IsBoolean } from 'class-validator';

export class UpdateCanteenSetupDto {
  @IsBoolean()
  default_token_enabled: boolean;
}
