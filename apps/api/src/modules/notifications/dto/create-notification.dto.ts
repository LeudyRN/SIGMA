import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ example: 'INSCRIPCION_ACTUALIZADA' })
  @Matches(/^[A-Z0-9_]{3,60}$/)
  type!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  message!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  url?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Matches(/^\d+$/, { each: true })
  userIds?: string[];

  @ApiPropertyOptional({ type: [String], example: ['DOCENTE'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Matches(/^[A-Z0-9_]{3,50}$/, { each: true })
  roleCodes?: string[];
}
