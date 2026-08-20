import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  CloseReconciliationDto,
  CreateBankAccountDto,
  CreateReconciliationDto,
  CreateTransferDto,
  ReviewTransferDto,
  UpdateBankAccountDto,
  UpsertPaymentMethodDto,
} from './dto/payments.dto';
import { PaymentsService, type UploadedProof } from './payments.service';

@ApiTags('Pagos y facturación')
@ApiCookieAuth('sigma_access_token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Get() @Permissions('PAGOS_GESTIONAR') list(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.list({ status, search });
  }
  @Get('catalogs') @Permissions('PAGOS_GESTIONAR') catalogs() {
    return this.service.catalogs();
  }
  @Get('bank-accounts') @Permissions('PAGOS_GESTIONAR') bankAccounts() {
    return this.service.bankAccounts(false);
  }
  @Get('bank-accounts/public')
  @Permissions('PAGOS_PROPIOS_GESTIONAR')
  publicBankAccounts() {
    return this.service.bankAccounts(true);
  }
  @Post('bank-accounts') @Permissions('PAGOS_GESTIONAR') createBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.service.createBankAccount(user.id, dto);
  }
  @Patch('bank-accounts/:id') @Permissions('PAGOS_GESTIONAR') updateBankAccount(
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.service.updateBankAccount(id, dto);
  }
  @Delete('bank-accounts/:id')
  @Permissions('PAGOS_GESTIONAR')
  removeBankAccount(@Param('id') id: string) {
    return this.service.removeBankAccount(id);
  }
  @Post('transfers')
  @Permissions('PAGOS_PROPIOS_GESTIONAR')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('proof', { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  createTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransferDto,
    @UploadedFile() file?: UploadedProof,
  ) {
    return this.service.createTransfer(user.id, dto, file);
  }
  @Patch(':id/review') @Permissions('PAGOS_GESTIONAR') review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewTransferDto,
  ) {
    return this.service.reviewTransfer(user.id, id, dto);
  }
  @Get(':id/proof') downloadProof(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    return this.service.downloadProof(user, id, response);
  }
  @Get('invoices/:id/pdf') downloadInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.service.downloadInvoice(
      user,
      id,
      response,
      requestOrigin(request),
    );
  }
  @Post('methods') @Permissions('PAGOS_GESTIONAR') createMethod(
    @Body() dto: UpsertPaymentMethodDto,
  ) {
    return this.service.createMethod(dto);
  }
  @Patch('methods/:id') @Permissions('PAGOS_GESTIONAR') updateMethod(
    @Param('id') id: string,
    @Body() dto: UpsertPaymentMethodDto,
  ) {
    return this.service.updateMethod(id, dto);
  }
  @Get('transactions') @Permissions('PAGOS_GESTIONAR') transactions() {
    return this.service.transactions();
  }
  @Get('reconciliations') @Permissions('PAGOS_GESTIONAR') reconciliations() {
    return this.service.reconciliations();
  }
  @Post('reconciliations') @Permissions('PAGOS_GESTIONAR') createReconciliation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReconciliationDto,
  ) {
    return this.service.createReconciliation(user.id, dto);
  }
  @Patch('reconciliations/:id')
  @Permissions('PAGOS_GESTIONAR')
  closeReconciliation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CloseReconciliationDto,
  ) {
    return this.service.closeReconciliation(user.id, id, dto);
  }
}

function requestOrigin(request: Request) {
  const forwardedProtocol = request.headers['x-forwarded-proto'];
  const protocol = String(
    (Array.isArray(forwardedProtocol)
      ? forwardedProtocol[0]
      : forwardedProtocol) || request.protocol,
  )
    .split(',')[0]
    .trim();
  const forwardedHost = request.headers['x-forwarded-host'];
  const host = String(
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ||
      request.get('host') ||
      '',
  )
    .split(',')[0]
    .trim();
  return `${protocol}://${host}`;
}

@ApiTags('Verificación pública de facturas')
@Controller('invoices')
export class InvoiceVerificationController {
  constructor(private readonly service: PaymentsService) {}
  @Get('verify/:token') verify(@Param('token') token: string) {
    return this.service.verifyInvoice(token);
  }
}
