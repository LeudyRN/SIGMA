import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const optionalTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class ProjectAdvisorDto {
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(200) name!: string;
  @Transform(optionalTrim)
  @IsOptional()
  @IsEmail()
  @MaxLength(190)
  email?: string;
  @Transform(optionalTrim)
  @IsOptional()
  @Matches(/^\+?[0-9 ()-]{7,30}$/)
  phone?: string;
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  specialty?: string;
  @IsIn(['ASESOR', 'COASESOR', 'JURADO']) participation!: string;
  @Transform(optionalTrim)
  @IsOptional()
  @IsString()
  @MaxLength(1500)
  notes?: string;
}

export class UpdateProjectAdvisorDto extends ProjectAdvisorDto {
  @IsBoolean() active!: boolean;
  @IsInt() @Min(1) version!: number;
}
