import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  AcademicPolicyDto,
  ChannelDto,
  ContactDto,
  CourseGroupDto,
  GradeDto,
  RemitDto,
  ReviewFileDto,
  SimulatePaymentDto,
} from './monograph.dto';
import { MonographService } from './monograph.service';
@Controller('monograph')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('MONOGRAFICO_LEER')
export class MonographController {
  constructor(private readonly service: MonographService) {}
  @Get() workspace(@CurrentUser() user: AuthenticatedUser) {
    return this.service.workspace(user);
  }
  @Patch('contact') contact(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ContactDto,
  ) {
    return this.service.confirmContact(user, dto);
  }
  @Post('enrollments/:id/receive') @Permissions('MONOGRAFICO_RECIBIR') receive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.receive(user, id);
  }
  @Post('enrollments/:id/validate')
  @Permissions('MONOGRAFICO_VALIDAR')
  validate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewFileDto,
  ) {
    return this.service.validate(user, id, dto);
  }
  @Post('enrollments/:id/debt') @Permissions('MONOGRAFICO_VALIDAR') debt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.openDebt(user, id);
  }
  @Patch('enrollments/:id/channel') channel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ChannelDto,
  ) {
    return this.service.chooseChannel(user, id, dto.channel);
  }
  @Post('enrollments/:id/simulate') simulate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SimulatePaymentDto,
  ) {
    return this.service.simulate(user, id, dto);
  }
  @Patch('plans/:id') @Permissions('MONOGRAFICO_REGLAS') policy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AcademicPolicyDto,
  ) {
    return this.service.policy(user, id, dto);
  }
  @Patch('groups/:id') @Permissions('MONOGRAFICO_GRUPOS') group(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CourseGroupDto,
  ) {
    return this.service.group(user, id, dto);
  }
  @Post('enrollments/:id/grade') @Permissions('MONOGRAFICO_NOTAS') grade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GradeDto,
  ) {
    return this.service.grade(user, id, dto);
  }
  @Post('groups/:id/remit') @Permissions('MONOGRAFICO_GRUPOS') remit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() _dto: RemitDto,
  ) {
    if (!_dto.confirmed) throw new BadRequestException('Confirma la remisión.');
    return this.service.remit(user, id);
  }
}
