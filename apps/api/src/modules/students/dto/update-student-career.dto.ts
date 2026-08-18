import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateStudentCareerDto } from './create-student-career.dto';

export class UpdateStudentCareerDto extends PartialType(
  CreateStudentCareerDto,
) {
  @ApiPropertyOptional({
    enum: ['ACTIVA', 'FINALIZADA', 'SUSPENDIDA', 'RETIRADA'],
  })
  @IsOptional()
  @IsIn(['ACTIVA', 'FINALIZADA', 'SUSPENDIDA', 'RETIRADA'])
  status?: 'ACTIVA' | 'FINALIZADA' | 'SUSPENDIDA' | 'RETIRADA';
}
