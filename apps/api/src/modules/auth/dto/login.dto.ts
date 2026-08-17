import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: '100000000',
    description: 'Matrícula institucional del usuario',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{5,30}$/, {
    message: 'La matrícula contiene un formato inválido.',
  })
  matricula!: string;

  @ApiProperty({
    example: '********',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @MaxLength(128, { message: 'La contraseña supera el máximo permitido.' })
  password!: string;
}
