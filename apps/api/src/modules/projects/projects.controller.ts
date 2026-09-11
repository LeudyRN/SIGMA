import {
  Body,
  GoneException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  AssignTeacherDto,
  CreateProjectDto,
  UpdateProjectDto,
  UpsertParticipationTypeDto,
} from './dto/projects.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Proyectos de grado')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}
  @Get() list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.list(user, { status, search });
  }
  @Get('catalogs') catalogs(@CurrentUser() user: AuthenticatedUser) {
    return this.service.catalogs(user);
  }
  @Post() create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.service.create(user, dto);
  }
  @Patch(':id') update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.service.update(user, id, dto);
  }
  @Post(':id/teachers') @Permissions('PROYECTOS_GESTIONAR') assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignTeacherDto,
  ) {
    void user;
    void id;
    void dto;
    throw new GoneException(
      'Realiza la asignación en Coordinación académica para validar perfil, disponibilidad y carga.',
    );
  }
  @Delete(':id/teachers/:teacherId/:typeId')
  @Permissions('PROYECTOS_GESTIONAR')
  removeAssignment(
    @Param('id') id: string,
    @Param('teacherId') teacherId: string,
    @Param('typeId') typeId: string,
  ) {
    return this.service.removeAssignment(id, teacherId, typeId);
  }
  @Post('participation-types') @Permissions('PROYECTOS_GESTIONAR') createType(
    @Body() dto: UpsertParticipationTypeDto,
  ) {
    return this.service.createParticipationType(dto);
  }
}
