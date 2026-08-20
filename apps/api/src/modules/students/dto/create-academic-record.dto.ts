import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ACADEMIC_STATUSES = [
  'APROBADA',
  'REPROBADA',
  'RETIRADA',
  'CURSANDO',
  'PENDIENTE',
  'CONVALIDADA',
] as const;

export class CreateAcademicRecordDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  subjectId!: string;

  @ApiProperty({ example: '2026-20' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{3,30}$/)
  periodCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  grade?: number | null;

  @ApiPropertyOptional({
    description: 'Componente práctico sobre 30 puntos. Se presenta como Lxx.',
    example: 23,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(30)
  laboratoryGrade?: number | null;

  @ApiProperty({ enum: ACADEMIC_STATUSES })
  @IsIn(ACADEMIC_STATUSES)
  status!: (typeof ACADEMIC_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;
}
