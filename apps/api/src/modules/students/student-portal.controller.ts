import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { StudentsService } from './students.service';
import { StudentProcessService } from './student-process.service';
import {
  CreatePaymentIntentDto,
  RequestEnrollmentDto,
} from './dto/student-process.dto';

@ApiTags('Portal estudiantil')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('ESTUDIANTES_ELEGIBILIDAD_PROPIA')
@Controller('student-portal')
export class StudentPortalController {
  constructor(
    private readonly students: StudentsService,
    private readonly process: StudentProcessService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Consultar el expediente del estudiante autenticado',
  })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.students.getOwnProfile(user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Consultar el historial académico propio' })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('careerId') careerId?: string,
  ) {
    return this.students.getOwnHistory(user.id, careerId);
  }

  @Get('eligibility')
  @ApiOperation({ summary: 'Evaluar la elegibilidad académica propia' })
  eligibility(
    @CurrentUser() user: AuthenticatedUser,
    @Query('careerId') careerId?: string,
  ) {
    return this.students.getOwnEligibility(user.id, careerId);
  }

  @Get('offers')
  @Permissions('UCOTESIS_OFERTAS_LEER')
  @ApiOperation({
    summary: 'Consultar ofertas disponibles para la carrera propia',
  })
  offers(@CurrentUser() user: AuthenticatedUser) {
    return this.process.offers(user.id);
  }

  @Get('enrollments')
  @Permissions('INSCRIPCIONES_PROPIAS_GESTIONAR')
  enrollments(@CurrentUser() user: AuthenticatedUser) {
    return this.process.enrollments(user.id);
  }

  @Post('enrollments')
  @Permissions('INSCRIPCIONES_PROPIAS_GESTIONAR')
  requestEnrollment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestEnrollmentDto,
  ) {
    return this.process.requestEnrollment(user.id, dto);
  }

  @Get('payment-methods')
  @Permissions('PAGOS_PROPIOS_GESTIONAR')
  paymentMethods() {
    return this.process.paymentMethods();
  }

  @Post('payment-intents')
  @Permissions('PAGOS_PROPIOS_GESTIONAR')
  createPaymentIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentIntentDto,
  ) {
    return this.process.createPaymentIntent(user.id, dto);
  }
}
