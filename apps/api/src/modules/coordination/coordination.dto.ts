import {
  Equals,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class DesignationDto {
  @Matches(/^[1-9]\d*$/) teacherId!: string;
  @Matches(/^[1-9]\d*$/) schoolId!: string;
  @IsDateString() date!: string;
  @IsString() @MinLength(3) @MaxLength(200) reference!: string;
  @IsOptional() @IsString() @MaxLength(1000) observation?: string;
}
export class TeacherProfileDto {
  @IsString() @MinLength(3) @MaxLength(1000) specialties!: string;
  @IsString() @MinLength(3) @MaxLength(1000) availability!: string;
  @IsInt() @Min(1) @Max(100) maxGroups!: number;
  @IsInt() @Min(1) @Max(500) maxStudents!: number;
  @IsBoolean() available!: boolean;
}
export class MilestoneDto {
  @IsOptional() @Matches(/^[1-9]\d*$/) projectId?: string;
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsIn(['INICIO', 'AVANCE', 'ASESORIA', 'DEFENSA', 'NORMATIVA']) type!: string;
  @IsDateString() dueAt!: string;
  @IsString() @MinLength(3) @MaxLength(5000) instructions!: string;
  @IsIn(['PROGRAMADO', 'CANCELADO']) status!: string;
  @IsOptional() @IsInt() @Min(1) version?: number;
}
export class AcademicAssignmentDto {
  @Matches(/^[1-9]\d*$/) teacherId!: string;
  @IsIn(['ASESOR', 'COASESOR', 'JURADO']) participation!: string;
  @IsIn(['BAJA', 'MEDIA', 'ALTA']) complexity!: string;
  @Equals(true) availabilityConfirmed!: boolean;
  @IsString() @MinLength(10) @MaxLength(1500) rationale!: string;
}
export class AcademicReviewDto {
  @IsIn(['APROBADO', 'CAMBIOS']) status!: string;
  @IsString() @MinLength(3) @MaxLength(5000) feedback!: string;
}
export class TeacherRequestDto {
  @Matches(/^[1-9]\d*$/) teacherId!: string;
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsIn(['DESIGNACION', 'CONTRATACION', 'PAGO']) purpose!: string;
  @IsString() @MinLength(3) @MaxLength(5000) instructions!: string;
}
export class TeacherProcessDto {
  @IsIn(['ENVIADO', 'COMPLETADO']) status!: string;
  @IsString() @MinLength(3) @MaxLength(200) reference!: string;
}
