import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const CIDR_OR_IP_REGEX =
  /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\d|[12]\d|3[0-2]))?$/;

export class CreateAllowedNetworkDto {
  @IsString()
  @Matches(CIDR_OR_IP_REGEX, { message: 'Informe um IP (ex: 200.1.2.3) ou faixa CIDR (ex: 200.1.2.0/24)' })
  cidr: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string;
}
