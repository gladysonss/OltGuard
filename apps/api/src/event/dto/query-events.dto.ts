import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryEventsDto {
  /** Aceita uma OLT (?oltId=abc) ou varias (?oltId=abc,def). */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray()
  @IsString({ each: true })
  oltId?: string[];

  /**
   * Selecao de GPON individual na arvore da tela de Alarmes - uma ou varias
   * chaves "oltId:slotNo:portNo" (?oltPort=abc:1:1,abc:1:2). Quando presente,
   * substitui oltId (ver EventService.findAll).
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray()
  @IsString({ each: true })
  oltPort?: string[];

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
