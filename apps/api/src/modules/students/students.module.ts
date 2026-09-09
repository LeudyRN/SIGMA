import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { AcademicHistoryParserService } from './academic-history-parser.service';
import { AcademicHistoryPdfService } from './academic-history-pdf.service';
import { AcademicHistoryTransferService } from './academic-history-transfer.service';
import { StudentsController } from './students.controller';
import { StudentPortalController } from './student-portal.controller';
import { StudentsService } from './students.service';
import { StudentProcessService } from './student-process.service';

@Module({
  imports: [AuthModule, EnrollmentsModule],
  exports: [StudentsService],
  controllers: [StudentsController, StudentPortalController],
  providers: [
    StudentsService,
    StudentProcessService,
    AcademicHistoryParserService,
    AcademicHistoryTransferService,
    AcademicHistoryPdfService,
  ],
})
export class StudentsModule {}
