import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  Equals,
  IsUUID,
} from 'class-validator';
export class ReviewFileDto {
  @Equals(true) documentsComplete!: boolean;
  @IsString() @MaxLength(1000) observation!: string;
}
export class ContactDto {
  @Matches(/^\+?[1-9]\d{9,14}$/) phone!: string;
  @Equals(true) confirmed!: boolean;
}
export class ChannelDto {
  @IsIn(['CAJA', 'VIRTUAL']) channel!: 'CAJA' | 'VIRTUAL';
}
export class SimulatePaymentDto extends ChannelDto {
  @IsUUID() idempotencyKey!: string;
  @IsIn(['APROBADO', 'RECHAZADO']) outcome!: 'APROBADO' | 'RECHAZADO';
  @Equals(true) simulationAcknowledged!: boolean;
}
export class AcademicPolicyDto {
  @IsInt() @Min(0) @Max(50) maxSubjects!: number;
  @IsInt() @Min(0) @Max(200) maxCredits!: number;
  @IsInt() @Min(1) @Max(30) fromSemester!: number;
}
export class CourseGroupDto {
  @IsOptional() @Matches(/^[1-9]\d*$/) coordinatorId?: string;
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(/^(https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+)?$/)
  whatsappUrl?: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999)
  teachingBudget!: number;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999)
  materialsBudget!: number;
}
export class GradeDto {
  @Matches(/^[1-9]\d*$/) studentId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) grade!: number;
  @IsOptional() @IsString() @MaxLength(1000) observation?: string;
}
export class RemitDto {
  @IsBoolean() @Equals(true) confirmed!: boolean;
}
