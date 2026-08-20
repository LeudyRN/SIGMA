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
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  CreateCatalogDto,
  CreateOfferDto,
  CreatePeriodDto,
  UpdateCatalogDto,
  UpdateOfferDto,
  UpdatePeriodDto,
} from './dto/ucotesis.dto';
import { UcotesisService, type CatalogKind } from './ucotesis.service';

@ApiTags('UCOTESIS y oferta')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('UCOTESIS_OFERTAS_GESTIONAR')
@Controller('ucotesis')
export class UcotesisController {
  constructor(private readonly service: UcotesisService) {}

  @Get('catalogs') catalogs() {
    return this.service.catalogs();
  }
  @Get('catalogs/:kind') listCatalog(@Param('kind') kind: CatalogKind) {
    return this.service.listCatalog(kind);
  }
  @Post('catalogs/:kind') createCatalog(
    @Param('kind') kind: CatalogKind,
    @Body() dto: CreateCatalogDto,
  ) {
    return this.service.createCatalog(kind, dto);
  }
  @Patch('catalogs/:kind/:id') updateCatalog(
    @Param('kind') kind: CatalogKind,
    @Param('id') id: string,
    @Body() dto: UpdateCatalogDto,
  ) {
    return this.service.updateCatalog(kind, id, dto);
  }
  @Delete('catalogs/:kind/:id') removeCatalog(
    @Param('kind') kind: CatalogKind,
    @Param('id') id: string,
  ) {
    return this.service.removeCatalog(kind, id);
  }

  @Get('periods') periods() {
    return this.service.periods();
  }
  @Post('periods') createPeriod(@Body() dto: CreatePeriodDto) {
    return this.service.createPeriod(dto);
  }
  @Patch('periods/:id') updatePeriod(
    @Param('id') id: string,
    @Body() dto: UpdatePeriodDto,
  ) {
    return this.service.updatePeriod(id, dto);
  }
  @Delete('periods/:id') removePeriod(@Param('id') id: string) {
    return this.service.removePeriod(id);
  }

  @Get('offers') offers() {
    return this.service.offers();
  }
  @Post('offers') createOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOfferDto,
  ) {
    return this.service.createOffer(user.id, dto);
  }
  @Patch('offers/:id') updateOffer(
    @Param('id') id: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.service.updateOffer(id, dto);
  }
  @Delete('offers/:id') removeOffer(@Param('id') id: string) {
    return this.service.removeOffer(id);
  }
}
