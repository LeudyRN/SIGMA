import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoicePdfService } from './invoice-pdf.service';
import {
  InvoiceVerificationController,
  PaymentsController,
} from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [PaymentsController, InvoiceVerificationController],
  providers: [PaymentsService, InvoicePdfService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
