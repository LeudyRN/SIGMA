import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCatalogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => normalizeCatalogCode(value))
  @Matches(/^[A-Z0-9_-]{2,60}$/, {
    message:
      'El código debe contener entre 2 y 60 letras, números, guiones o guiones bajos.',
  })
  codigo?: string;
  @ApiProperty() @IsString() @MaxLength(150) nombre!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
  @ApiPropertyOptional({ enum: ['AUTOMATICA', 'MANUAL', 'DOCUMENTAL'] })
  @IsOptional()
  @IsEnum(['AUTOMATICA', 'MANUAL', 'DOCUMENTAL'])
  tipoValidacion?: 'AUTOMATICA' | 'MANUAL' | 'DOCUMENTAL';
}

export class UpdateCatalogDto extends PartialType(CreateCatalogDto) {
  @ApiPropertyOptional({ enum: ['ACTIVO', 'INACTIVO'] })
  @IsOptional()
  @IsEnum(['ACTIVO', 'INACTIVO'])
  estado?: 'ACTIVO' | 'INACTIVO';
}

export class CreatePeriodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,30}$/)
  codigo?: string;
  @ApiProperty() @IsString() @MaxLength(100) nombre!: string;
  @ApiProperty() @IsDateString() fechaInicio!: string;
  @ApiProperty() @IsDateString() fechaFin!: string;
  @ApiPropertyOptional({
    enum: ['PLANIFICADO', 'ACTIVO', 'CERRADO', 'CANCELADO'],
  })
  @IsOptional()
  @IsEnum(['PLANIFICADO', 'ACTIVO', 'CERRADO', 'CANCELADO'])
  estado?: 'PLANIFICADO' | 'ACTIVO' | 'CERRADO' | 'CANCELADO';
}

export class UpdatePeriodDto extends PartialType(CreatePeriodDto) {}

export class CreateOfferDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,50}$/)
  codigo?: string;
  @ApiProperty() @IsString() @Matches(/^\d+$/) recintoCarreraId!: string;
  @ApiProperty() @IsString() @Matches(/^\d+$/) modalidadId!: string;
  @ApiProperty() @IsString() @Matches(/^\d+$/) periodoId!: string;
  @ApiProperty() @IsString() @MaxLength(200) titulo!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string;
  @ApiProperty() @IsDateString() fechaInicioInscripcion!: string;
  @ApiProperty() @IsDateString() fechaFinInscripcion!: string;
  @ApiProperty() @IsInt() @Min(1) cupoTotal!: number;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) monto!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  moneda?: string;
  @ApiPropertyOptional({
    enum: ['BORRADOR', 'PUBLICADA', 'CERRADA', 'CANCELADA'],
  })
  @IsOptional()
  @IsEnum(['BORRADOR', 'PUBLICADA', 'CERRADA', 'CANCELADA'])
  estado?: 'BORRADOR' | 'PUBLICADA' | 'CERRADA' | 'CANCELADA';
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Matches(/^\d+$/, { each: true })
  areaIds?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Matches(/^\d+$/, { each: true })
  requisitoIds?: string[];
}

export class UpdateOfferDto extends PartialType(CreateOfferDto) {}

export function normalizeCatalogCode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}
