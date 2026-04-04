import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export enum DeviceStatusDto {
  Active = 'Active',
  Inactive = 'Inactive',
}

export class CreateDeviceDto {
  @IsEnum(DeviceStatusDto)
  status: DeviceStatusDto;

  @IsOptional() @IsInt()
  serviceProviderID?: number;

  @IsOptional() @IsInt()
  companyID?: number;

  @IsOptional() @IsInt()
  branchesID?: number;

  @IsString()
  deviceName: string;

  @IsString()
  deviceMake: string;

  @IsOptional()
  @IsString()
  deviceType?: string;

  @IsString()
  deviceModel: string;

  @IsString()
  deviceSN: string;
}
