import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RoleCode } from '../auth/roles';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsService } from './permissions.service';

@ApiTags('Identidad - Permisos')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleCode.Admin)
@Permissions('IDENTIDAD_ROLES_GESTIONAR')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar permisos' })
  list() {
    return this.permissionsService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un permiso' })
  get(@Param('id') id: string) {
    return this.permissionsService.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un permiso' })
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un permiso' })
  update(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissionsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un permiso' })
  remove(@Param('id') id: string) {
    return this.permissionsService.remove(id);
  }
}
