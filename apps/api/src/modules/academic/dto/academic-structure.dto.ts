import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class BaseAcademicCatalogDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,50}$/)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;
}

export class CreateCampusDto extends BaseAcademicCatalogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;
}

export class UpdateCampusDto extends PartialType(CreateCampusDto) {
  @ApiPropertyOptional({ enum: ['ACTIVO', 'INACTIVO'] })
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  status?: 'ACTIVO' | 'INACTIVO';
}

export class CreateFacultyDto extends BaseAcademicCatalogDto {}
export class UpdateFacultyDto extends PartialType(CreateFacultyDto) {
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  status?: 'ACTIVO' | 'INACTIVO';
}

export class CreateSchoolDto extends BaseAcademicCatalogDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  facultyId!: string;
}

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  status?: 'ACTIVO' | 'INACTIVO';
}

export class CreateCareerDto extends BaseAcademicCatalogDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  schoolId!: string;

  @ApiPropertyOptional({ default: 'GRADO' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  academicLevel?: string;
}

export class UpdateCareerDto extends PartialType(CreateCareerDto) {
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  status?: 'ACTIVO' | 'INACTIVO';
}

export class CreateCampusCareerDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  campusId!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  careerId!: string;
}

export class UpdateCampusCareerDto extends PartialType(CreateCampusCareerDto) {
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  status?: 'ACTIVO' | 'INACTIVO';
}

export class CreateStudyPlanDto extends BaseAcademicCatalogDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  careerId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  startYear!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  endYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalCredits?: number;
}

export class UpdateStudyPlanDto extends PartialType(CreateStudyPlanDto) {
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  status?: 'ACTIVO' | 'INACTIVO';
}

export class CreateSubjectDto extends BaseAcademicCatalogDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  credits!: number;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  status?: 'ACTIVO' | 'INACTIVO';
}

export class StudyPlanSubjectDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d+$/)
  subjectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  semester?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  planCredits?: number;
}

export class AssignStudyPlanSubjectsDto {
  @ApiProperty({ type: [StudyPlanSubjectDto] })
  @IsArray()
  @ArrayUnique((item: StudyPlanSubjectDto) => item.subjectId)
  @ValidateNested({ each: true })
  @Type(() => StudyPlanSubjectDto)
  items!: StudyPlanSubjectDto[];
}
