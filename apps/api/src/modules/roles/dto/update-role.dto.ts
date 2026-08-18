import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'DIRECTOR_ESCUELA' })
  @IsOptional()
  @Matches(/^[A-Z0-9_]{3,50}$/)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

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
