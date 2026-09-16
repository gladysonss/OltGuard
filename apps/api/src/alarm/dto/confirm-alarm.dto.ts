import { IsOptional, IsString } from 'class-validator';

export class ConfirmAlarmDto {
  @IsOptional()
  @IsString()
  confirmedByUserId?: string;
}
