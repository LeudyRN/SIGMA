import {
  Body,
  GoneException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  EnrollmentsService,
  type UploadedEnrollmentDocument,
} from '../enrollments/enrollments.service';
import { UploadEnrollmentDocumentDto } from '../enrollments/dto/enrollments.dto';
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
    private readonly enrollmentDocuments: EnrollmentsService,
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

  @Post('documents')
  @Permissions('INSCRIPCIONES_PROPIAS_GESTIONAR')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadEnrollmentDocumentDto,
    @UploadedFile() file?: UploadedEnrollmentDocument,
  ) {
    return this.enrollmentDocuments.uploadStudentDocument(user.id, dto, file);
  }

  @Get('documents/:documentId/file')
  @Permissions('INSCRIPCIONES_PROPIAS_GESTIONAR')
  downloadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    return this.enrollmentDocuments.downloadDocument(
      user,
      documentId,
      response,
    );
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
    void user;
    void dto;
    throw new GoneException(
      'Usa Pagos: Secretaría debe abrir la deuda antes de iniciar la simulación.',
    );
  }
}
