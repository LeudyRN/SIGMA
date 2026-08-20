import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RoleCode } from '../auth/roles';
import { CreateAcademicRecordDto } from './dto/create-academic-record.dto';
import { CreateStudentCareerDto } from './dto/create-student-career.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateAcademicRecordDto } from './dto/update-academic-record.dto';
import { UpdateStudentCareerDto } from './dto/update-student-career.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { AcademicHistoryPdfService } from './academic-history-pdf.service';
import {
  AcademicHistoryTransferService,
  type UploadedHistoryPdf,
} from './academic-history-transfer.service';
import { StudentsService } from './students.service';

@ApiTags('Estudiantes')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleCode.Admin, RoleCode.Coordinator)
@Permissions('ESTUDIANTES_EXPEDIENTE_GESTIONAR')
@Controller('students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly historyTransfer: AcademicHistoryTransferService,
    private readonly historyPdf: AcademicHistoryPdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Consultar perfiles estudiantiles' })
  list(@Query('search') search?: string) {
    return this.students.list(search);
  }

  @Get('catalogs')
  @ApiOperation({ summary: 'Consultar catálogos para expediente académico' })
  catalogs() {
    return this.students.catalogs();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.students.get(id);
  }

  @Post()
  create(
    @Body() dto: CreateStudentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.students.create(dto, actor.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.students.update(id, dto);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.students.deactivate(id);
  }

  @Post(':id/careers')
  addCareer(@Param('id') id: string, @Body() dto: CreateStudentCareerDto) {
    return this.students.addCareer(id, dto);
  }

  @Patch('careers/:careerId')
  updateCareer(
    @Param('careerId') careerId: string,
    @Body() dto: UpdateStudentCareerDto,
  ) {
    return this.students.updateCareer(careerId, dto);
  }

  @Get('careers/:careerId/history')
  history(@Param('careerId') careerId: string) {
    return this.students.history(careerId);
  }

  @Post('careers/:careerId/history/import/preview')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  @ApiOperation({
    summary: 'Validar un histórico académico antes de importarlo',
  })
  previewHistoryImport(
    @Param('careerId') careerId: string,
    @UploadedFile() file: UploadedHistoryPdf,
  ) {
    return this.historyTransfer.preview(careerId, file);
  }

  @Post('careers/:careerId/history/import/confirm')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Importar un histórico académico validado' })
  confirmHistoryImport(
    @Param('careerId') careerId: string,
    @UploadedFile() file: UploadedHistoryPdf,
  ) {
    return this.historyTransfer.confirm(careerId, file);
  }

  @Get('careers/:careerId/history/export')
  @ApiOperation({ summary: 'Exportar el histórico académico a PDF' })
  async exportHistory(
    @Param('careerId') careerId: string,
    @Res() response: Response,
  ) {
    const result = await this.historyPdf.exportCareer(careerId);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="historico-academico-${result.matricula}.pdf"`,
    );
    response.send(result.buffer);
  }

  @Post('careers/:careerId/history')
  addHistory(
    @Param('careerId') careerId: string,
    @Body() dto: CreateAcademicRecordDto,
  ) {
    return this.students.addHistory(careerId, dto);
  }

  @Patch('history/:recordId')
  updateHistory(
    @Param('recordId') recordId: string,
    @Body() dto: UpdateAcademicRecordDto,
  ) {
    return this.students.updateHistory(recordId, dto);
  }

  @Delete('history/:recordId')
  removeHistory(@Param('recordId') recordId: string) {
    return this.students.removeHistory(recordId);
  }

  @Get(':id/eligibility')
  eligibility(@Param('id') id: string, @Query('careerId') careerId?: string) {
    return this.students.eligibility(id, careerId);
  }
}
