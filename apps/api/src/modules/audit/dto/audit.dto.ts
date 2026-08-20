import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
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
