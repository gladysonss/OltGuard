import { IsEnum, IsIP, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { OltManufacturer } from '@prisma/client';

export class CreateOltDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsIP()
  ipAddress: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsEnum(OltManufacturer)
  manufacturer: OltManufacturer;

  @IsString()
  @MinLength(1)
  snmpCommunity: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  snmpPort?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  sshUsername?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  sshPassword?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  sshPort?: number;
}
