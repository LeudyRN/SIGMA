import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdatePermissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[A-Z0-9_]{3,100}$/)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[A-Z0-9_]{3,80}$/)
  module?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ enum: ['ACTIVO', 'INACTIVO'] })
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  status?: 'ACTIVO' | 'INACTIVO';
}
