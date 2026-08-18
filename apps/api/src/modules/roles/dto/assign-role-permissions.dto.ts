import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, Matches } from 'class-validator';

export class AssignRolePermissionsDto {
  @ApiProperty({ type: [String], example: ['1', '2'] })
  @IsArray()
  @ArrayUnique()
  @Matches(/^\d+$/, { each: true })
  permissionIds!: string[];
}
