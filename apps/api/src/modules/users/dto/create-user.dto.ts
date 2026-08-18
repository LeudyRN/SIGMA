import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const IDENTIFIER_PATTERN = /^[A-Za-z0-9-]{3,30}$/;

export class CreateUserDto {
  @ApiProperty({ example: 'EMP-0042' })
  @Matches(IDENTIFIER_PATTERN)
  employeeCode!: string;

  @ApiProperty({ example: 'María' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  firstName!: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  lastName!: string;

  @ApiProperty({ example: 'maria.perez@uasd.edu.do' })
  @IsEmail()
  @MaxLength(190)
  email!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ type: [String], example: ['1'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Matches(/^\d+$/, { each: true })
  roleIds!: string[];
}
