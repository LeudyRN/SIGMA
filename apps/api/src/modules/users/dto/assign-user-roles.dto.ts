import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, Matches } from 'class-validator';

export class AssignUserRolesDto {
  @ApiProperty({ type: [String], example: ['1', '2'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Matches(/^\d+$/, { each: true })
  roleIds!: string[];
}
