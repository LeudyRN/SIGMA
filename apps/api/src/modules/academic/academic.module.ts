import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';

import { StudyPlanParserService } from './study-plan-parser.service';
import { StudyPlanTransferService } from './study-plan-transfer.service';
import { StudyPlanPdfService } from './study-plan-pdf.service';

@Module({
  imports: [
    PrismaModule,
  ],

  controllers: [
    AcademicController,
  ],

  providers: [
    AcademicService,

    StudyPlanParserService,
    StudyPlanTransferService,
    StudyPlanPdfService,
  ],
})
export class AcademicModule {}