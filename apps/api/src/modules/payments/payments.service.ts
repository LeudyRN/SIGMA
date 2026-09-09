import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  Prisma,
  cuentas_bancarias,
  pagos_estado,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CloseReconciliationDto,
  CreateBankAccountDto,
  CreateReconciliationDto,
  CreateTransferDto,
  ReviewTransferDto,
  UpdateBankAccountDto,
  UpsertPaymentMethodDto,
} from './dto/payments.dto';
import { InvoicePdfService } from './invoice-pdf.service';

export interface UploadedProof {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly pdf: InvoicePdfService,
  ) {}
  async bankAccounts(onlyActive: boolean) {
    const rows = await this.prisma.cuentas_bancarias.findMany({
      where: onlyActive ? { estado: 'ACTIVO' } : undefined,
      orderBy: [{ estado: 'asc' }, { banco: 'asc' }],
    });
    return { items: rows.map(mapAccount) };
  }
  async createBankAccount(userId: string, dto: CreateBankAccountDto) {
    try {
      return mapAccount(
        await this.prisma.cuentas_bancarias.create({
          data: accountData(dto, parseId(userId)),
        }),
      );
    } catch {
      throw new ConflictException('Ya existe una cuenta con ese número.');
    }
  }
  async updateBankAccount(id: string, dto: UpdateBankAccountDto) {
    try {
      const row = await this.prisma.cuentas_bancarias.update({
        where: { id_cuenta_bancaria: parseId(id) },
        data: {
          ...(dto.bank && { banco: dto.bank.trim() }),
          ...(dto.accountNumber && { numero_cuenta: dto.accountNumber.trim() }),
          ...(dto.accountType && { tipo_cuenta: dto.accountType }),
          ...(dto.documentType && { tipo_documento: dto.documentType }),
          ...(dto.holderDocument && {
            documento_titular: dto.holderDocument.trim(),
          }),
          ...(dto.holderName && { nombre_titular: dto.holderName.trim() }),
          ...(dto.currency && { moneda: dto.currency }),
          ...(dto.instructions !== undefined && {
            instrucciones: dto.instructions?.trim() || null,
          }),
          ...(dto.status && { estado: dto.status }),
        },
      });
      return mapAccount(row);
    } catch {
      throw new ConflictException(
        'No fue posible actualizar la cuenta bancaria.',
      );
    }
  }
  async removeBankAccount(id: string) {
    const accountId = parseId(id);
    const linked = await this.prisma.pagos.count({
      where: { id_cuenta_bancaria: accountId },
    });
    if (linked)
      throw new ConflictException(
        'La cuenta tiene pagos vinculados; inactívala para preservar la auditoría.',
      );
    await this.prisma.cuentas_bancarias
      .delete({ where: { id_cuenta_bancaria: accountId } })
      .catch(() => {
        throw new NotFoundException('Cuenta bancaria no encontrada.');
      });
    return { deleted: true };
  }
  async catalogs() {
    const [methods, accounts] = await Promise.all([
      this.prisma.metodos_pago.findMany({ orderBy: { nombre: 'asc' } }),
      this.bankAccounts(false),
    ]);
    return {
      methods: methods.map((x) => ({
        id: x.id_metodo_pago.toString(),
        code: x.codigo,
        name: x.nombre,
        status: x.estado,
      })),
      accounts: accounts.items,
    };
  }
  async createMethod(dto: UpsertPaymentMethodDto) {
    try {
      const row = await this.prisma.metodos_pago.create({
        data: {
          codigo: dto.code.trim().toUpperCase(),
          nombre: dto.name.trim(),
          estado: dto.status ?? 'ACTIVO',
        },
      });
      return { id: row.id_metodo_pago.toString() };
    } catch {
      throw new ConflictException('El método de pago ya existe.');
    }
  }
  async updateMethod(id: string, dto: UpsertPaymentMethodDto) {
    try {
      const row = await this.prisma.metodos_pago.update({
        where: { id_metodo_pago: parseId(id) },
        data: {
          codigo: dto.code.trim().toUpperCase(),
          nombre: dto.name.trim(),
          estado: dto.status ?? 'ACTIVO',
        },
      });
      return { id: row.id_metodo_pago.toString() };
    } catch {
      throw new ConflictException('No fue posible actualizar el método.');
    }
  }
  async list(filters: { status?: string; search?: string }) {
    const search = filters.search?.trim();
    const rows = await this.prisma.pagos.findMany({
      where: {
        ...(filters.status && {
          estado: filters.status.toUpperCase() as pagos_estado,
        }),
        ...(search && {
          OR: [
            { referencia: { contains: search } },
            {
              inscripciones: {
                OR: [
                  { codigo: { contains: search } },
                  {
                    inscripcion_estudiantes: {
                      some: {
                        estudiantes: {
                          OR: [
                            { matricula: { contains: search } },
                            {
                              usuarios: {
                                OR: [
                                  { nombres: { contains: search } },
                                  { apellidos: { contains: search } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
        }),
      },
      include: paymentInclude,
      orderBy: { created_at: 'desc' },
    });
    return { items: rows.map(mapPayment) };
  }
  async createTransfer(
    userId: string,
    dto: CreateTransferDto,
    file?: UploadedProof,
  ) {
    validateProof(file);
    const user = parseId(userId);
    const enrollmentId = parseId(dto.enrollmentId);
    const accountId = parseId(dto.bankAccountId);
    const paidAt = new Date(dto.paidAt);
    if (paidAt.getTime() > Date.now() + 5 * 60 * 1000)
      throw new BadRequestException(
        'La fecha de la transferencia no puede estar en el futuro.',
      );
    const [enrollment, account, method, processingState] = await Promise.all([
      this.prisma.inscripciones.findFirst({
        where: {
          id_inscripcion: enrollmentId,
          inscripcion_estudiantes: {
            some: { estudiantes: { id_usuario: user } },
          },
          estados_inscripcion: {
            codigo: { in: ['ELEGIBLE', 'PENDIENTE_PAGO', 'PAGO_PROCESANDO'] },
          },
        },
        include: {
          estados_inscripcion: true,
          pagos: {
            where: {
              estado: { in: ['PENDIENTE', 'PROCESANDO', 'APROBADO'] },
            },
            select: { id_pago: true, estado: true },
            take: 1,
          },
        },
      }),
      this.prisma.cuentas_bancarias.findFirst({
        where: { id_cuenta_bancaria: accountId, estado: 'ACTIVO' },
      }),
      this.prisma.metodos_pago.findFirst({
        where: {
          codigo: { in: ['TRANSFERENCIA', 'TRANSFERENCIA_BANCARIA'] },
          estado: 'ACTIVO',
        },
      }),
      this.prisma.estados_inscripcion.findFirst({
        where: { codigo: 'PAGO_PROCESANDO', estado: 'ACTIVO' },
      }),
    ]);
    if (!enrollment)
      throw new NotFoundException(
        'Inscripción pendiente de pago no encontrada.',
      );
    if (!account || !method)
      throw new BadRequestException(
        'La cuenta o el método de transferencia no está disponible.',
      );
    if (!processingState)
      throw new ConflictException(
        'El estado PAGO_PROCESANDO no está configurado.',
      );
    if (enrollment.pagos.length)
      throw new ConflictException(
        'La inscripción ya tiene un pago pendiente o aprobado.',
      );
    const digest = createHash('sha256').update(file.buffer).digest('hex');
    try {
      const payment = await this.prisma.$transaction(async (db) => {
        const row = await db.pagos.create({
          data: {
            id_inscripcion: enrollmentId,
            id_metodo_pago: method.id_metodo_pago,
            id_cuenta_bancaria: accountId,
            referencia: dto.reference.trim().toUpperCase(),
            idempotency_key: `TRANSFER-${enrollmentId}-${digest}`,
            monto: enrollment.monto_aplicado,
            moneda: enrollment.moneda,
            estado: 'PENDIENTE',
            fecha_pago: paidAt,
            comprobantes_transferencia: {
              create: {
                nombre_archivo: file.originalname.slice(0, 255),
                mime_type: file.mimetype,
                tamano_bytes: file.size,
                hash_sha256: digest,
                contenido: Uint8Array.from(file.buffer),
              },
            },
          },
        });
        await db.transacciones_pago.create({
          data: {
            id_pago: row.id_pago,
            proveedor: method.codigo,
            proveedor_transaccion_id: dto.reference.trim().toUpperCase(),
            tipo: 'VENTA',
            estado: 'PENDIENTE',
            request_reference: row.referencia,
            request_payload: {
              bankAccountId: accountId.toString(),
              paidAt: paidAt.toISOString(),
              proofName: file.originalname.slice(0, 255),
            },
          },
        });
        await db.inscripciones.update({
          where: { id_inscripcion: enrollmentId },
          data: {
            id_estado: processingState.id_estado,
            version_lock: { increment: 1 },
          },
        });
        if (enrollment.id_estado !== processingState.id_estado)
          await db.historial_estados_inscripcion.create({
            data: {
              id_inscripcion: enrollmentId,
              id_estado_anterior: enrollment.id_estado,
              id_estado_nuevo: processingState.id_estado,
              cambiado_por: user,
              motivo: 'Comprobante de transferencia enviado.',
            },
          });
        return row;
      });
      return {
        id: payment.id_pago.toString(),
        reference: payment.referencia,
        status: payment.estado,
      };
    } catch {
      throw new ConflictException(
        'La referencia o el comprobante ya fue utilizado.',
      );
    }
  }
  async reviewTransfer(userId: string, id: string, dto: ReviewTransferDto) {
    const paymentId = parseId(id);
    const reviewer = parseId(userId);
    const payment = await this.prisma.pagos.findUnique({
      where: { id_pago: paymentId },
      include: paymentReviewInclude,
    });
    if (!payment?.comprobantes_transferencia)
      throw new NotFoundException('Comprobante pendiente no encontrado.');
    if (payment.estado !== 'PENDIENTE')
      throw new ConflictException('Este pago ya fue revisado.');
    const userIds = payment.inscripciones.inscripcion_estudiantes.map((x) =>
      x.estudiantes.id_usuario.toString(),
    );
    if (dto.decision === 'RECHAZADO') {
      const pendingState = await this.prisma.estados_inscripcion.findFirst({
        where: { codigo: 'PENDIENTE_PAGO', estado: 'ACTIVO' },
      });
      if (!pendingState)
        throw new ConflictException(
          'El estado PENDIENTE_PAGO no está configurado.',
        );
      await this.prisma.$transaction(async (db) => {
        await db.pagos.update({
          where: { id_pago: paymentId },
          data: { estado: 'RECHAZADO', rechazado_at: new Date() },
        });
        await db.comprobantes_transferencia.update({
          where: { id_pago: paymentId },
          data: {
            estado: 'RECHAZADO',
            observacion: dto.observation?.trim() || 'Comprobante rechazado.',
            revisado_por: reviewer,
            revisado_at: new Date(),
          },
        });
        await db.transacciones_pago.updateMany({
          where: { id_pago: paymentId, estado: 'PENDIENTE' },
          data: {
            estado: 'RECHAZADA',
            response_code: 'RECHAZADO_REVISION',
            response_message:
              dto.observation?.trim() || 'Comprobante rechazado.',
          },
        });
        await db.inscripciones.update({
          where: { id_inscripcion: payment.id_inscripcion },
          data: {
            id_estado: pendingState.id_estado,
            version_lock: { increment: 1 },
          },
        });
        await db.historial_estados_inscripcion.create({
          data: {
            id_inscripcion: payment.id_inscripcion,
            id_estado_anterior: payment.inscripciones.id_estado,
            id_estado_nuevo: pendingState.id_estado,
            cambiado_por: reviewer,
            motivo: dto.observation?.trim() || 'Pago rechazado.',
          },
        });
      });
      await this.notifications.create({
        userIds,
        type: 'PAGO',
        title: 'Transferencia rechazada',
        message:
          dto.observation?.trim() ||
          'Revisa el comprobante y vuelve a enviarlo.',
        url: '/app/pagos',
      });
      return { id, status: 'RECHAZADO' };
    }
    const confirmed = await this.prisma.estados_inscripcion.findFirst({
      where: { codigo: 'CONFIRMADA', estado: 'ACTIVO' },
    });
    if (!confirmed)
      throw new ConflictException('El estado CONFIRMADA no está configurado.');
    const issuedAt = new Date();
    const token = randomUUID();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const suffix = `${issuedAt.getFullYear()}-${paymentId.toString().padStart(8, '0')}`;
    const invoice = await this.prisma.$transaction(async (db) => {
      await db.pagos.update({
        where: { id_pago: paymentId },
        data: { estado: 'APROBADO', aprobado_at: issuedAt },
      });
      await db.comprobantes_transferencia.update({
        where: { id_pago: paymentId },
        data: {
          estado: 'VALIDADO',
          observacion: dto.observation?.trim() || null,
          revisado_por: reviewer,
          revisado_at: issuedAt,
        },
      });
      await db.transacciones_pago.updateMany({
        where: { id_pago: paymentId, estado: 'PENDIENTE' },
        data: {
          estado: 'APROBADA',
          authorization_code: `SIGMA-${paymentId.toString()}`,
          response_code: 'VALIDADO',
          response_message: 'Transferencia validada por Tesorería.',
        },
      });
      const principal =
        payment.inscripciones.inscripcion_estudiantes.find(
          (x) => x.es_principal,
        ) ?? payment.inscripciones.inscripcion_estudiantes[0];
      const created = await db.facturas.create({
        data: {
          id_pago: paymentId,
          numero_factura: `SIGMA-${suffix}`,
          numero_recibo: `REC-${suffix}`,
          recinto_nombre:
            payment.inscripciones.ofertas.recinto_carreras.recintos.nombre,
          matricula: principal.estudiantes.matricula,
          estudiante_nombre: `${principal.estudiantes.usuarios.nombres} ${principal.estudiantes.usuarios.apellidos}`,
          descripcion: payment.inscripciones.ofertas.titulo,
          monto: payment.monto,
          moneda: payment.moneda,
          metodo_pago_nombre: payment.metodos_pago.nombre,
          qr_token: token,
          qr_hash: tokenHash,
          pdf_url: `/api/payments/invoices/${paymentId.toString()}/pdf`,
          fecha_emision: issuedAt,
        },
      });
      await db.inscripciones.update({
        where: { id_inscripcion: payment.id_inscripcion },
        data: {
          id_estado: confirmed.id_estado,
          fecha_confirmacion: issuedAt,
          version_lock: { increment: 1 },
        },
      });
      await db.historial_estados_inscripcion.create({
        data: {
          id_inscripcion: payment.id_inscripcion,
          id_estado_anterior: payment.inscripciones.id_estado,
          id_estado_nuevo: confirmed.id_estado,
          cambiado_por: reviewer,
          motivo: 'Transferencia validada y factura emitida.',
        },
      });
      return created;
    });
    await this.notifications.create({
      userIds,
      type: 'PAGO',
      title: 'Pago aprobado e inscripción confirmada',
      message: `Factura ${invoice.numero_factura} disponible.`,
      url: '/app/facturas',
    });
    return {
      id,
      status: 'APROBADO',
      invoice: {
        id: invoice.id_factura.toString(),
        number: invoice.numero_factura,
      },
    };
  }
  async downloadProof(user: AuthenticatedUser, id: string, response: Response) {
    const row = await this.prisma.pagos.findUnique({
      where: { id_pago: parseId(id) },
      include: {
        comprobantes_transferencia: true,
        inscripciones: {
          include: {
            inscripcion_estudiantes: { include: { estudiantes: true } },
          },
        },
      },
    });
    if (!row?.comprobantes_transferencia)
      throw new NotFoundException('Comprobante no encontrado.');
    assertPaymentAccess(
      user,
      row.inscripciones.inscripcion_estudiantes.map(
        (x) => x.estudiantes.id_usuario,
      ),
    );
    response.setHeader(
      'Content-Type',
      row.comprobantes_transferencia.mime_type,
    );
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${safeFileName(row.comprobantes_transferencia.nombre_archivo)}"`,
    );
    response.send(Buffer.from(row.comprobantes_transferencia.contenido));
  }
  async downloadInvoice(
    user: AuthenticatedUser,
    id: string,
    response: Response,
    origin: string,
  ) {
    const row = await this.prisma.facturas.findUnique({
      where: { id_pago: parseId(id) },
      include: {
        pagos: {
          include: {
            metodos_pago: true,
            inscripciones: {
              include: {
                ofertas: {
                  include: {
                    recinto_carreras: { include: { recintos: true } },
                  },
                },
                inscripcion_estudiantes: { include: { estudiantes: true } },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Factura no encontrada.');
    assertPaymentAccess(
      user,
      row.pagos.inscripciones.inscripcion_estudiantes.map(
        (x) => x.estudiantes.id_usuario,
      ),
    );
    const pdf = await this.pdf.render({
      simulated: row.pagos.es_simulado,
      number: row.numero_factura,
      receipt: row.numero_recibo,
      campus: row.recinto_nombre,
      registration: row.matricula,
      student: row.estudiante_nombre,
      description: row.descripcion,
      amount: Number(row.monto),
      currency: row.moneda,
      method: row.metodo_pago_nombre,
      issuedAt: row.fecha_emision,
      verificationUrl: `${origin}/api/invoices/verify/${row.qr_token}`,
    });
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="factura-${safeFileName(row.numero_factura)}.pdf"`,
    );
    response.send(pdf);
  }
  async verifyInvoice(token: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const row = await this.prisma.facturas.findFirst({
      where: { qr_token: token, qr_hash: hash },
      select: {
        pagos: { select: { es_simulado: true } },
        numero_factura: true,
        numero_recibo: true,
        matricula: true,
        estudiante_nombre: true,
        descripcion: true,
        monto: true,
        moneda: true,
        fecha_emision: true,
        anulada_at: true,
      },
    });
    if (!row) throw new NotFoundException('Factura no válida.');
    return {
      valid: !row.anulada_at,
      simulated: row.pagos.es_simulado,
      notice: row.pagos.es_simulado ? 'SIMULACIÓN SIN VALIDEZ FISCAL' : null,
      invoice: row.numero_factura,
      receipt: row.numero_recibo,
      registration: row.matricula,
      student: row.estudiante_nombre,
      description: row.descripcion,
      amount: Number(row.monto),
      currency: row.moneda,
      issuedAt: row.fecha_emision,
      voidedAt: row.anulada_at,
    };
  }
  async transactions() {
    const rows = await this.prisma.transacciones_pago.findMany({
      include: { pagos: { include: { inscripciones: true } } },
      orderBy: { created_at: 'desc' },
      take: 500,
    });
    return {
      items: rows.map((x) => ({
        id: x.id_transaccion.toString(),
        paymentId: x.id_pago.toString(),
        enrollment: x.pagos.inscripciones.codigo,
        paymentReference: x.pagos.referencia,
        provider: x.proveedor,
        providerId: x.proveedor_transaccion_id,
        type: x.tipo,
        status: x.estado,
        authorizationCode: x.authorization_code,
        responseCode: x.response_code,
        responseMessage: x.response_message,
        createdAt: x.created_at,
      })),
    };
  }
  async reconciliations() {
    const rows = await this.prisma.conciliaciones_pago.findMany({
      include: {
        usuarios: true,
        conciliacion_detalles: { include: { pagos: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    return {
      items: rows.map((x) => ({
        id: x.id_conciliacion.toString(),
        code: x.codigo,
        provider: x.proveedor,
        from: x.fecha_desde,
        to: x.fecha_hasta,
        records: x.total_registros,
        amount: Number(x.total_monto),
        status: x.estado,
        processedAt: x.procesada_at,
        processedBy: x.usuarios
          ? `${x.usuarios.nombres} ${x.usuarios.apellidos}`
          : null,
        differences: x.conciliacion_detalles.filter((d) => !d.coincide).length,
        details: x.conciliacion_detalles.map((detail) => ({
          paymentId: detail.id_pago.toString(),
          reference: detail.pagos.referencia,
          paymentAmount: Number(detail.pagos.monto),
          reportedAmount: detail.monto_reportado
            ? Number(detail.monto_reportado)
            : null,
          matches: detail.coincide,
          observation: detail.observacion,
        })),
      })),
    };
  }
  async createReconciliation(userId: string, dto: CreateReconciliationDto) {
    const from = new Date(dto.from);
    const to = new Date(dto.to);
    if (to <= from)
      throw new BadRequestException(
        'La fecha final debe ser posterior a la inicial.',
      );
    const provider = dto.provider.trim().toUpperCase();
    const method = await this.prisma.metodos_pago.findFirst({
      where: {
        estado: 'ACTIVO',
        OR: [
          { codigo: provider },
          ...(/^\d+$/.test(provider)
            ? [{ id_metodo_pago: BigInt(provider) }]
            : []),
        ],
      },
      select: { id_metodo_pago: true, codigo: true },
    });
    if (!method)
      throw new BadRequestException('Selecciona un método de pago activo.');
    const payments = await this.prisma.pagos.findMany({
      where: {
        id_metodo_pago: method.id_metodo_pago,
        estado: 'APROBADO',
        fecha_pago: { gte: from, lte: to },
      },
      include: {
        transacciones_pago: {
          where: { estado: 'APROBADA' },
          select: { id_transaccion: true },
        },
      },
    });
    if (!payments.length)
      throw new BadRequestException(
        'No existen pagos aprobados para el método y el período seleccionados.',
      );
    const total = payments.reduce((sum, x) => sum + Number(x.monto), 0);
    const differences = payments.filter(
      (payment) => payment.transacciones_pago.length === 0,
    ).length;
    const row = await this.prisma.conciliaciones_pago.create({
      data: {
        codigo: `CON-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        proveedor: method.codigo,
        fecha_desde: from,
        fecha_hasta: to,
        total_registros: payments.length,
        total_monto: total,
        estado: differences ? 'CON_DIFERENCIAS' : 'PROCESADA',
        procesada_por: parseId(userId),
        procesada_at: new Date(),
        conciliacion_detalles: {
          create: payments.map((x) => ({
            id_pago: x.id_pago,
            monto_reportado: x.monto,
            coincide: x.transacciones_pago.length > 0,
            observacion:
              x.transacciones_pago.length > 0
                ? null
                : 'El pago no tiene una transacción aprobada asociada.',
          })),
        },
      },
    });
    return { id: row.id_conciliacion.toString(), code: row.codigo };
  }
  async closeReconciliation(
    userId: string,
    id: string,
    dto: CloseReconciliationDto,
  ) {
    const row = await this.prisma.conciliaciones_pago
      .update({
        where: { id_conciliacion: parseId(id) },
        data: {
          estado: dto.status ?? 'CERRADA',
          procesada_por: parseId(userId),
          procesada_at: new Date(),
        },
      })
      .catch(() => {
        throw new NotFoundException('Conciliación no encontrada.');
      });
    return { id: row.id_conciliacion.toString(), status: row.estado };
  }
}

const paymentInclude = {
  metodos_pago: true,
  cuentas_bancarias: true,
  comprobantes_transferencia: {
    select: {
      estado: true,
      observacion: true,
      nombre_archivo: true,
      mime_type: true,
      created_at: true,
    },
  },
  facturas: true,
  inscripciones: {
    include: {
      estados_inscripcion: true,
      ofertas: {
        include: {
          modalidades: true,
          recinto_carreras: { include: { recintos: true, carreras: true } },
        },
      },
      inscripcion_estudiantes: {
        include: { estudiantes: { include: { usuarios: true } } },
      },
    },
  },
} as const;
const paymentReviewInclude = {
  metodos_pago: true,
  comprobantes_transferencia: true,
  inscripciones: {
    include: {
      ofertas: {
        include: { recinto_carreras: { include: { recintos: true } } },
      },
      inscripcion_estudiantes: {
        include: { estudiantes: { include: { usuarios: true } } },
      },
    },
  },
} as const;
type PaymentRecord = Prisma.pagosGetPayload<{ include: typeof paymentInclude }>;
function mapPayment(x: PaymentRecord) {
  const principal =
    x.inscripciones.inscripcion_estudiantes.find((item) => item.es_principal) ??
    x.inscripciones.inscripcion_estudiantes[0];
  return {
    id: x.id_pago.toString(),
    reference: x.referencia,
    status: x.estado,
    amount: Number(x.monto),
    currency: x.moneda,
    paidAt: x.fecha_pago,
    createdAt: x.created_at,
    enrollment: {
      id: x.id_inscripcion.toString(),
      code: x.inscripciones.codigo,
      status: x.inscripciones.estados_inscripcion.codigo,
      offer: x.inscripciones.ofertas.titulo,
      teachingMode: x.inscripciones.ofertas.modalidad_ensenanza,
    },
    student: principal
      ? {
          registration: principal.estudiantes.matricula,
          name: `${principal.estudiantes.usuarios.nombres} ${principal.estudiantes.usuarios.apellidos}`,
        }
      : null,
    method: x.metodos_pago.nombre,
    account: x.cuentas_bancarias ? mapAccount(x.cuentas_bancarias) : null,
    proof: x.comprobantes_transferencia
      ? {
          status: x.comprobantes_transferencia.estado,
          name: x.comprobantes_transferencia.nombre_archivo,
          mimeType: x.comprobantes_transferencia.mime_type,
          observation: x.comprobantes_transferencia.observacion,
          uploadedAt: x.comprobantes_transferencia.created_at,
        }
      : null,
    invoice: x.facturas
      ? {
          id: x.facturas.id_factura.toString(),
          number: x.facturas.numero_factura,
          receipt: x.facturas.numero_recibo,
          pdfUrl: `/api/payments/invoices/${x.id_pago.toString()}/pdf`,
        }
      : null,
  };
}
function mapAccount(x: cuentas_bancarias) {
  return {
    id: x.id_cuenta_bancaria.toString(),
    bank: x.banco,
    accountNumber: x.numero_cuenta,
    accountType: x.tipo_cuenta,
    documentType: x.tipo_documento,
    holderDocument: x.documento_titular,
    holderName: x.nombre_titular,
    currency: x.moneda,
    instructions: x.instrucciones,
    status: x.estado,
  };
}
function accountData(dto: CreateBankAccountDto, userId: bigint) {
  return {
    banco: dto.bank.trim(),
    numero_cuenta: dto.accountNumber.trim(),
    tipo_cuenta: dto.accountType,
    tipo_documento: dto.documentType,
    documento_titular: dto.holderDocument.trim(),
    nombre_titular: dto.holderName.trim(),
    moneda: dto.currency ?? 'DOP',
    instrucciones: dto.instructions?.trim() || null,
    created_by: userId,
  };
}
function validateProof(file?: UploadedProof): asserts file is UploadedProof {
  if (!file)
    throw new BadRequestException(
      'Debes adjuntar el comprobante de la transferencia.',
    );
  if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.mimetype))
    throw new BadRequestException('El comprobante debe ser PNG, JPG o PDF.');
  if (!file.size || file.size > 8 * 1024 * 1024)
    throw new BadRequestException('El comprobante no puede superar 8 MB.');
}
function assertPaymentAccess(user: AuthenticatedUser, ownerIds: bigint[]) {
  const staff = user.roles.some((x) =>
    [
      'ADMIN',
      'TESORERIA',
      'COORDINADOR',
      'SECRETARIA',
      'ENCARGADO',
      'CAJA',
    ].includes(x),
  );
  if (!staff && !ownerIds.some((x) => x.toString() === user.id))
    throw new ForbiddenException('No puedes consultar este comprobante.');
}
function safeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}
function parseId(value: string) {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador inválido.');
  }
}
