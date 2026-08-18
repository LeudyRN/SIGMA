import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const IDENTIFIER_PATTERN = /^[A-Za-z0-9-]{3,30}$/;

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(IDENTIFIER_PATTERN)
  employeeCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({
    enum: ['ACTIVO', 'INACTIVO', 'BLOQUEADO', 'PENDIENTE'],
  })
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO', 'BLOQUEADO', 'PENDIENTE'])
  status?: 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO' | 'PENDIENTE';
}
