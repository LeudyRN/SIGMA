import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class ChangeEnrollmentStatusDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9_-]{2,50}$/) statusCode!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AddParticipantDto {
  @ApiProperty() @IsString() @Matches(/^\d+$/) studentId!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() principal?: boolean;
}

export class ValidateRequirementDto {
  @ApiProperty() @IsString() @Matches(/^\d+$/) requirementId!: string;
  @ApiProperty() @IsBoolean() meets!: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  value?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observation?: string;
}

export class ValidateDocumentDto {
  @ApiProperty({ enum: ['VALIDO', 'RECHAZADO'] })
  @IsEnum(['VALIDO', 'RECHAZADO'])
  status!: 'VALIDO' | 'RECHAZADO';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observation?: string;
}

export class RequestDocumentDto {
  @ApiProperty() @IsString() @Matches(/^\d+$/) enrollmentId!: string;
  @ApiProperty() @IsString() @MaxLength(80) type!: string;
  @ApiProperty() @IsString() @MaxLength(500) instructions!: string;
}

export class UploadEnrollmentDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  requestId?: string;
  @ApiProperty() @IsString() @Matches(/^\d+$/) enrollmentId!: string;
  @ApiProperty({ example: 'Propuesta de proyecto' })
  @IsString()
  @MaxLength(80)
  type!: string;
}

export class UpsertEnrollmentStateDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9_-]{2,50}$/) code!: string;
  @ApiProperty() @IsString() @MaxLength(100) name!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) order!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() final?: boolean;
  @ApiPropertyOptional({ enum: ['ACTIVO', 'INACTIVO'] })
  @IsOptional()
  @IsEnum(['ACTIVO', 'INACTIVO'])
  status?: 'ACTIVO' | 'INACTIVO';
}
