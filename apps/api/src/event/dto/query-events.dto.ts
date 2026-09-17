import { IsOptional, IsString } from 'class-validator';

export class QueryEventsDto {
  @IsOptional()
  @IsString()
  oltId?: string;
}
