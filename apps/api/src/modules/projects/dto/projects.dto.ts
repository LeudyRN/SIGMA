import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty() @IsString() @Matches(/^\d+$/) enrollmentId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  areaId?: string;
  @ApiProperty() @IsString() @MaxLength(300) title!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({
    enum: [
      'PENDIENTE',
      'EN_DESARROLLO',
      'EN_REVISION',
      'APROBADO',
      'RECHAZADO',
      'FINALIZADO',
      'CANCELADO',
    ],
  })
  @IsOptional()
  @IsEnum([
    'PENDIENTE',
    'EN_DESARROLLO',
    'EN_REVISION',
    'APROBADO',
    'RECHAZADO',
    'FINALIZADO',
    'CANCELADO',
  ])
  status?:
    | 'PENDIENTE'
    | 'EN_DESARROLLO'
    | 'EN_REVISION'
    | 'APROBADO'
    | 'RECHAZADO'
    | 'FINALIZADO'
    | 'CANCELADO';
  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;
}
export class AssignTeacherDto {
  @ApiProperty() @IsString() @Matches(/^\d+$/) teacherId!: string;
  @ApiProperty() @IsString() @Matches(/^\d+$/) participationTypeId!: string;
}
export class UpsertParticipationTypeDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9_-]{2,50}$/) code!: string;
  @ApiProperty() @IsString() @MaxLength(100) name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
