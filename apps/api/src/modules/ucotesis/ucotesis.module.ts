import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UcotesisController } from './ucotesis.controller';
import { UcotesisService } from './ucotesis.service';

@Module({
  imports: [AuthModule],
  controllers: [UcotesisController],
  providers: [UcotesisService],
  exports: [UcotesisService],
})
export class UcotesisModule {}
