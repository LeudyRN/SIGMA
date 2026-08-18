import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'OFERTAS_GESTIONAR' })
  @Matches(/^[A-Z0-9_]{3,100}$/)
  code!: string;

  @ApiProperty({ example: 'Gestionar ofertas' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'OFERTAS' })
  @Matches(/^[A-Z0-9_]{3,80}$/)
  module!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
