import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [AuthModule],
  controllers: [RolesController, PermissionsController],
  providers: [RolesService, PermissionsService],
})
export class RolesModule {}
