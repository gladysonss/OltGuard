import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AlarmCondition, AlarmSeverity } from '@prisma/client';

export class QueryAlarmsDto {
  @IsOptional()
  @IsString()
  oltId?: string;

  /** Filtra pela alcancabilidade da OLT no momento (ver olt-health-check.service.ts). */
  @IsOptional()
  @IsIn(['active', 'inactive'])
  neStatus?: 'active' | 'inactive';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slotNo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  portNo?: number;

  @IsOptional()
  @IsEnum(AlarmSeverity)
  severity?: AlarmSeverity;

  @IsOptional()
  @IsEnum(AlarmCondition)
  condition?: AlarmCondition;
}
