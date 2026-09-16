import { IsIP, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateOltDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsIP()
  ipAddress: string;

  @IsString()
  @MinLength(1)
  snmpCommunity: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  snmpPort?: number;

  @IsString()
  @MinLength(1)
  sshUsername: string;

  @IsString()
  @MinLength(1)
  sshPassword: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  sshPort?: number;
}
