import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  AddParticipantDto,
  ChangeEnrollmentStatusDto,
  UpsertEnrollmentStateDto,
  ValidateDocumentDto,
  ValidateRequirementDto,
} from './dto/enrollments.dto';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('Inscripciones')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('INSCRIPCIONES_GESTIONAR')
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}
  @Get() list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('offerId') offerId?: string,
  ) {
    return this.service.list({ search, status, offerId });
  }
  @Get('catalogs') catalogs() {
    return this.service.catalogs();
  }
  @Get(':id') detail(@Param('id') id: string) {
    return this.service.detail(id);
  }
  @Patch(':id/status') changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ChangeEnrollmentStatusDto,
  ) {
    return this.service.changeStatus(user.id, id, dto);
  }
  @Post(':id/participants') addParticipant(
    @Param('id') id: string,
    @Body() dto: AddParticipantDto,
  ) {
    return this.service.addParticipant(id, dto);
  }
  @Delete(':id/participants/:studentId') removeParticipant(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    return this.service.removeParticipant(id, studentId);
  }
  @Post(':id/validations') validateRequirement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ValidateRequirementDto,
  ) {
    return this.service.validateRequirement(user.id, id, dto);
  }
  @Patch('documents/:documentId') validateDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Body() dto: ValidateDocumentDto,
  ) {
    return this.service.validateDocument(user.id, documentId, dto);
  }
  @Get('documents/:documentId/file') downloadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    return this.service.downloadDocument(user, documentId, response);
  }
  @Post('states') createState(@Body() dto: UpsertEnrollmentStateDto) {
    return this.service.createState(dto);
  }
  @Patch('states/:id') updateState(
    @Param('id') id: string,
    @Body() dto: UpsertEnrollmentStateDto,
  ) {
    return this.service.updateState(id, dto);
  }
}
