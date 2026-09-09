import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentsModule } from '../students/students.module';
import { MonographController } from './monograph.controller';
import { MonographService } from './monograph.service';
@Module({
  imports: [AuthModule, StudentsModule],
  controllers: [MonographController],
  providers: [MonographService],
})
export class MonographModule {}
