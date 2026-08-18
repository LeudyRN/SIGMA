import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AcademicService } from './academic.service';
import {
  AssignStudyPlanSubjectsDto,
  CreateCampusCareerDto,
  CreateCampusDto,
  CreateCareerDto,
  CreateFacultyDto,
  CreateSchoolDto,
  CreateStudyPlanDto,
  CreateSubjectDto,
  UpdateCampusCareerDto,
  UpdateCampusDto,
  UpdateCareerDto,
  UpdateFacultyDto,
  UpdateSchoolDto,
  UpdateStudyPlanDto,
  UpdateSubjectDto,
} from './dto/academic-structure.dto';

@ApiTags('Estructura académica')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('academic')
export class AcademicController {
  constructor(private readonly academic: AcademicService) {}

  @Get('structure')
  @Permissions('ACADEMICO_CATALOGOS_LEER')
  @ApiOperation({ summary: 'Consultar la estructura académica completa' })
  structure() {
    return this.academic.structure();
  }

  @Post('campuses')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  createCampus(@Body() dto: CreateCampusDto) {
    return this.academic.createCampus(dto);
  }
  @Patch('campuses/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  updateCampus(@Param('id') id: string, @Body() dto: UpdateCampusDto) {
    return this.academic.updateCampus(id, dto);
  }
  @Delete('campuses/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  deleteCampus(@Param('id') id: string) {
    return this.academic.deleteCampus(id);
  }

  @Post('faculties')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  createFaculty(@Body() dto: CreateFacultyDto) {
    return this.academic.createFaculty(dto);
  }
  @Patch('faculties/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  updateFaculty(@Param('id') id: string, @Body() dto: UpdateFacultyDto) {
    return this.academic.updateFaculty(id, dto);
  }
  @Delete('faculties/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  deleteFaculty(@Param('id') id: string) {
    return this.academic.deleteFaculty(id);
  }

  @Post('schools')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  createSchool(@Body() dto: CreateSchoolDto) {
    return this.academic.createSchool(dto);
  }
  @Patch('schools/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  updateSchool(@Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.academic.updateSchool(id, dto);
  }
  @Delete('schools/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  deleteSchool(@Param('id') id: string) {
    return this.academic.deleteSchool(id);
  }

  @Post('careers')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  createCareer(@Body() dto: CreateCareerDto) {
    return this.academic.createCareer(dto);
  }
  @Patch('careers/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  updateCareer(@Param('id') id: string, @Body() dto: UpdateCareerDto) {
    return this.academic.updateCareer(id, dto);
  }
  @Delete('careers/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  deleteCareer(@Param('id') id: string) {
    return this.academic.deleteCareer(id);
  }

  @Post('campus-careers')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  createCampusCareer(@Body() dto: CreateCampusCareerDto) {
    return this.academic.createCampusCareer(dto);
  }
  @Patch('campus-careers/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  updateCampusCareer(
    @Param('id') id: string,
    @Body() dto: UpdateCampusCareerDto,
  ) {
    return this.academic.updateCampusCareer(id, dto);
  }
  @Delete('campus-careers/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  deleteCampusCareer(@Param('id') id: string) {
    return this.academic.deleteCampusCareer(id);
  }

  @Post('study-plans')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  createStudyPlan(@Body() dto: CreateStudyPlanDto) {
    return this.academic.createStudyPlan(dto);
  }
  @Patch('study-plans/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  updateStudyPlan(@Param('id') id: string, @Body() dto: UpdateStudyPlanDto) {
    return this.academic.updateStudyPlan(id, dto);
  }
  @Delete('study-plans/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  deleteStudyPlan(@Param('id') id: string) {
    return this.academic.deleteStudyPlan(id);
  }
  @Put('study-plans/:id/subjects')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  assignStudyPlanSubjects(
    @Param('id') id: string,
    @Body() dto: AssignStudyPlanSubjectsDto,
  ) {
    return this.academic.assignStudyPlanSubjects(id, dto);
  }

  @Post('subjects')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.academic.createSubject(dto);
  }
  @Patch('subjects/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  updateSubject(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.academic.updateSubject(id, dto);
  }
  @Delete('subjects/:id')
  @Permissions('ACADEMICO_CATALOGOS_GESTIONAR')
  deleteSubject(@Param('id') id: string) {
    return this.academic.deleteSubject(id);
  }
}
