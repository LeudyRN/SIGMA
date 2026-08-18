import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentsController } from './students.controller';
import { StudentPortalController } from './student-portal.controller';
import { StudentsService } from './students.service';
import { StudentProcessService } from './student-process.service';

@Module({
  imports: [AuthModule],
  controllers: [StudentsController, StudentPortalController],
  providers: [StudentsService, StudentProcessService],
})
export class StudentsModule {}
