import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: '100000000',
    description: 'Matrícula o código institucional de empleado',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{3,30}$/, {
    message: 'La matrícula o código de empleado contiene un formato inválido.',
  })
  identificador!: string;

  @ApiProperty({
    example: '********',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  @MaxLength(128, { message: 'La contraseña supera el máximo permitido.' })
  password!: string;
}
