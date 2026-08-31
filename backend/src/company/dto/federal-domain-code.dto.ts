import { IsNotEmpty, IsString } from 'class-validator';

export class FederalDomainCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
