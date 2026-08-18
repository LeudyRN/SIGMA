import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { SessionsService } from './sessions.service';

@ApiTags('Identidad - Sesiones')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar sesiones propias o todas si es administrador',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.list(user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revocar una sesión' })
  revoke(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.revoke(id, user);
  }

  @Delete()
  @ApiOperation({ summary: 'Revocar las demás sesiones del usuario actual' })
  revokeOthers(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.revokeOthers(user);
  }
}
