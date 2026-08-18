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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RoleCode } from '../auth/roles';
import { AssignRolePermissionsDto } from './dto/assign-role-permissions.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('Identidad - Roles y permisos')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleCode.Admin)
@Permissions('IDENTIDAD_ROLES_GESTIONAR')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar roles con sus permisos' })
  list() {
    return this.rolesService.list();
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Consultar catálogo de permisos' })
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un rol' })
  get(@Param('id') id: string) {
    return this.rolesService.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un rol' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un rol' })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un rol sin usuarios asignados' })
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Put(':id/permissions')
  @ApiOperation({ summary: 'Reemplazar los permisos asignados a un rol' })
  assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignRolePermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.assignPermissions(id, dto.permissionIds, actor.id);
  }
}
