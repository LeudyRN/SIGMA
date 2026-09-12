import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoordinationController } from './coordination.controller';
import { CoordinationService } from './coordination.service';
import { AcademicAlertsService } from './academic-alerts.service';
@Module({
  imports: [AuthModule],
  controllers: [CoordinationController],
  providers: [CoordinationService, AcademicAlertsService],
})
export class CoordinationModule {}
