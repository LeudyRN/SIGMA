import {
  Body,
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
import { AuditService } from './audit.service';
import {
  CreateConfigurationDto,
  UpdateConfigurationDto,
} from './dto/audit.dto';

@ApiTags('Gobierno del sistema')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('GOBIERNO_GESTIONAR')
@Controller('governance')
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get('audit') audit(
    @Query('search') search?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({ search, action, entity, page, pageSize });
  }
  @Get('configurations') configurations() {
    return this.service.configurations();
  }
  @Post('configurations') create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConfigurationDto,
  ) {
    return this.service.createConfiguration(user.id, dto);
  }
  @Patch('configurations/:id') update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateConfigurationDto,
  ) {
    return this.service.updateConfiguration(user.id, id, dto);
  }
  @Delete('configurations/:id') remove(@Param('id') id: string) {
    return this.service.removeConfiguration(id);
  }
}
