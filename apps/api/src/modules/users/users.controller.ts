import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
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
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Identidad - Usuarios')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleCode.Admin)
@Permissions('IDENTIDAD_USUARIOS_GESTIONAR')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar usuarios y roles asignados' })
  list(@Query('search') search?: string) {
    return this.usersService.list(search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un usuario' })
  get(@Param('id') id: string) {
    return this.usersService.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un usuario institucional' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.create(dto, actor.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar los datos y estado de un usuario' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Put(':id/roles')
  @ApiOperation({ summary: 'Reemplazar los roles asignados a un usuario' })
  assignRoles(
    @Param('id') id: string,
    @Body() dto: AssignUserRolesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.assignRoles(id, dto.roleIds, actor.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un usuario y revocar sus sesiones' })
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.remove(id, actor.id);
  }
}
