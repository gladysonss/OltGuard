import { IsIP, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTrustedIpDto {
  @IsIP()
  ipAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;
}
