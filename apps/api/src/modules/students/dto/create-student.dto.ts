import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStudentDto {
  @ApiProperty({ example: '100576672' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{3,30}$/)
  matricula!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  lastName!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(190)
  email!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;

  @ApiPropertyOptional({ example: '2000-01-31' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;
}
