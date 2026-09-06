import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateConfigurationDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9_.-]{2,120}$/) key!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  value?: string;
  @ApiProperty({
    enum: [
      'STRING',
      'INTEGER',
      'DECIMAL',
      'BOOLEAN',
      'JSON',
      'DATE',
      'DATETIME',
    ],
  })
  @IsEnum([
    'STRING',
    'INTEGER',
    'DECIMAL',
    'BOOLEAN',
    'JSON',
    'DATE',
    'DATETIME',
  ])
  type!:
    'STRING' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'JSON' | 'DATE' | 'DATETIME';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() public?: boolean;
}
export class UpdateConfigurationDto extends PartialType(
  CreateConfigurationDto,
) {}

export class AuditQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsString() @MaxLength(100) action?: string;
  @IsOptional() @IsString() @MaxLength(100) entity?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  pageSize?: number;
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
