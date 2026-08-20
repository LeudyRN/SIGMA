import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateBankAccountDto {
  @ApiProperty() @IsString() @MaxLength(120) bank!: string;
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9 -]{4,80}$/)
  accountNumber!: string;
  @ApiProperty({ enum: ['AHORRO', 'CORRIENTE'] })
  @IsEnum(['AHORRO', 'CORRIENTE'])
  accountType!: 'AHORRO' | 'CORRIENTE';
  @ApiProperty({ enum: ['CEDULA', 'PASAPORTE', 'RNC'] })
  @IsEnum(['CEDULA', 'PASAPORTE', 'RNC'])
  documentType!: 'CEDULA' | 'PASAPORTE' | 'RNC';
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{5,30}$/)
  holderDocument!: string;
  @ApiProperty() @IsString() @MaxLength(200) holderName!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}
export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {
  @ApiPropertyOptional({ enum: ['ACTIVO', 'INACTIVO'] })
  @IsOptional()
  @IsEnum(['ACTIVO', 'INACTIVO'])
  status?: 'ACTIVO' | 'INACTIVO';
}
export class CreateTransferDto {
  @ApiProperty() @IsString() @Matches(/^\d+$/) enrollmentId!: string;
  @ApiProperty() @IsString() @Matches(/^\d+$/) bankAccountId!: string;
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9._/-]{4,100}$/)
  reference!: string;
  @ApiProperty() @IsDateString() paidAt!: string;
}
export class ReviewTransferDto {
  @ApiProperty({ enum: ['VALIDADO', 'RECHAZADO'] })
  @IsEnum(['VALIDADO', 'RECHAZADO'])
  decision!: 'VALIDADO' | 'RECHAZADO';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observation?: string;
}
export class UpsertPaymentMethodDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9_-]{2,50}$/) code!: string;
  @ApiProperty() @IsString() @MaxLength(100) name!: string;
  @ApiPropertyOptional({ enum: ['ACTIVO', 'INACTIVO'] })
  @IsOptional()
  @IsEnum(['ACTIVO', 'INACTIVO'])
  status?: 'ACTIVO' | 'INACTIVO';
}
export class CreateReconciliationDto {
  @ApiProperty() @IsString() @MaxLength(80) provider!: string;
  @ApiProperty() @IsDateString() from!: string;
  @ApiProperty() @IsDateString() to!: string;
}
export class CloseReconciliationDto {
  @ApiPropertyOptional({ enum: ['PROCESADA', 'CON_DIFERENCIAS', 'CERRADA'] })
  @IsOptional()
  @IsEnum(['PROCESADA', 'CON_DIFERENCIAS', 'CERRADA'])
  status?: 'PROCESADA' | 'CON_DIFERENCIAS' | 'CERRADA';
}
