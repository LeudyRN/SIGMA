import { MonographModule } from './modules/monograph/monograph.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AcademicModule } from './modules/academic/academic.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RolesModule } from './modules/roles/roles.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { StudentsModule } from './modules/students/students.module';
import { UcotesisModule } from './modules/ucotesis/ucotesis.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { validateEnvironment } from './shared/config/environment';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment,
    }),
    PrismaModule,
    MonographModule,
    AuthModule,
    DashboardModule,
    UsersModule,
    RolesModule,
    SessionsModule,
    StudentsModule,
    AcademicModule,
    UcotesisModule,
    EnrollmentsModule,
    PaymentsModule,
    ProjectsModule,
    NotificationsModule,
    AuditModule,
    HealthModule,
  ],
})
export class AppModule {}
