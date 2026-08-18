import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RoleCode } from '../auth/roles';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {
  NotificationsService,
  NotificationStreamEvent,
} from './notifications.service';

@ApiTags('Notificaciones')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar notificaciones del usuario actual' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.list(user.id);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Sse('stream')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('X-Accel-Buffering', 'no')
  stream(
    @CurrentUser() user: AuthenticatedUser,
  ): Observable<NotificationStreamEvent> {
    return this.notificationsService.stream(user.id);
  }

  @Post()
  @Roles(RoleCode.Admin)
  @Permissions('NOTIFICACIONES_ENVIAR')
  @ApiOperation({ summary: 'Enviar una notificación a usuarios o roles' })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.remove(id, user.id);
  }

  @Delete()
  removeAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.removeAll(user.id);
  }
}
