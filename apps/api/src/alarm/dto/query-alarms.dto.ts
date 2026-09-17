import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { AlarmCondition, AlarmSeverity } from '@prisma/client';

export class QueryAlarmsDto {
  /** Aceita uma OLT (?oltId=abc) ou varias (?oltId=abc,def). */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray()
  @IsString({ each: true })
  oltId?: string[];

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  logicalPortNo?: number;

  /** Aceita uma severidade (?severity=CRITICAL) ou varias (?severity=CRITICAL,MAJOR). */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray()
  @IsEnum(AlarmSeverity, { each: true })
  severity?: AlarmSeverity[];

  /** Omitido = todos (ativos + historico); ACTIVE ou CLEARED filtra so um dos dois. */
  @IsOptional()
  @IsEnum(AlarmCondition)
  condition?: AlarmCondition;

  /** Filtra por raisedAt >= from (ISO 8601). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Filtra por raisedAt <= to (ISO 8601). */
  @IsOptional()
  @IsISO8601()
  to?: string;

  /** 1-indexado. Padrao 1. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;
}
