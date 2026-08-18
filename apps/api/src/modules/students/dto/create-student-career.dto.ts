import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateStudentCareerDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  campusCareerId!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  studyPlanId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  graduationDate?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  primary?: boolean;
}
