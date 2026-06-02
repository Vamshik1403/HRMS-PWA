import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authTypes?: string[];

  @IsString()
  deviceModel: string;

  @IsString()
  deviceSN: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
