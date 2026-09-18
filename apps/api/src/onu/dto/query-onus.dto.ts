import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OnuStatus } from '@prisma/client';

export class QueryOnusDto {
  /** Aceita uma OLT (?oltId=abc) ou varias (?oltId=abc,def). */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray()
  @IsString({ each: true })
  oltId?: string[];

  /**
   * Selecao de GPON individual na arvore da tela de Alarmes/ONUs - uma ou
   * varias chaves "oltId:slotNo:portNo" (?oltPort=abc:1:1,abc:1:2). Quando
   * presente, substitui oltId (ver OnuService.findAll).
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray()
  @IsString({ each: true })
  oltPort?: string[];

  @IsOptional()
  @IsEnum(OnuStatus)
  status?: OnuStatus;

  /** Busca livre (case-insensitive, "contem") por serial ou alias - ver OnuService.findAll. */
  @IsOptional()
  @IsString()
  search?: string;

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
