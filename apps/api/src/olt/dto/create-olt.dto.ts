import { IsIP, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateOltDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsIP()
  ipAddress: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  manufacturer?: string;

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
