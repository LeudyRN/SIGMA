import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class StudyPlanScopeDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  campusIds!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  facultyIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  schoolIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  careerIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studyPlanIds?: string[];

  @IsOptional()
  @IsBoolean()
  allCampuses?: boolean;

  @IsOptional()
  @IsBoolean()
  allFaculties?: boolean;

  @IsOptional()
  @IsBoolean()
  allSchools?: boolean;

  @IsOptional()
  @IsBoolean()
  allCareers?: boolean;

  @IsOptional()
  @IsBoolean()
  allStudyPlans?: boolean;
}

export class ConfirmStudyPlanImportDto {
  @IsString()
  token!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  campusIds!: string[];
}
