import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoordinationController } from './coordination.controller';
import { CoordinationService } from './coordination.service';
import { AcademicAlertsService } from './academic-alerts.service';
import { ProjectAdvisorsController } from './project-advisors.controller';
import { ProjectAdvisorsService } from './project-advisors.service';
@Module({
  imports: [AuthModule],
  controllers: [CoordinationController, ProjectAdvisorsController],
  providers: [
    CoordinationService,
    AcademicAlertsService,
    ProjectAdvisorsService,
  ],
})
export class CoordinationModule {}
