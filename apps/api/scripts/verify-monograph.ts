import { InsightsService } from '../src/modules/dashboard/insights.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { EnrollmentsService } from '../src/modules/enrollments/enrollments.service';
import type { NotificationsService } from '../src/modules/notifications/notifications.service';
/** Integration verification: all fixtures and mutations run inside one transaction that is always rolled back. */
import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/modules/auth/interfaces/jwt-payload.interface';
import type { AuthService } from '../src/modules/auth/auth.service';
import { StudentsService } from '../src/modules/students/students.service';
import { StudentProcessService } from '../src/modules/students/student-process.service';
import { MonographService } from '../src/modules/monograph/monograph.service';
import { InvoicePdfService } from '../src/modules/payments/invoice-pdf.service';
loadEnvFile(existsSync('.env') ? '.env' : '../../.env');
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});
const rollback = new Error('ROLLBACK_VERIFICATION');
async function main() {
  let verified = false;
  try {
    await prisma.$transaction(
      async (db) => {
        const suffix = randomUUID().slice(0, 8);
        const campus = await db.recinto_carreras.findFirstOrThrow({
          where: { estado: 'ACTIVO' },
        });
        const modality = await db.modalidades.findUniqueOrThrow({
          where: { codigo: 'MONOGRAFICO' },
        });
        const period = await db.periodos_academicos.findFirstOrThrow();
        const makeUser = (kind: string) =>
          db.usuarios.create({
            data: {
              uuid: randomUUID(),
              nombres: `Prueba ${kind}`,
              apellidos: 'Rollback',
              email: `${kind}-${suffix}@example.invalid`,
              password_hash: 'disabled-test-account',
              estado: 'ACTIVO',
            },
          });
        const actor = await makeUser('secretaria');
        const learner = await makeUser('estudiante');
        const teacher = await makeUser('docente');
        const teacherRole = await db.roles.findUniqueOrThrow({
          where: { codigo: 'COORDINADOR_MONOGRAFICO' },
        });
        await db.usuario_roles.create({
          data: { id_usuario: teacher.id_usuario, id_rol: teacherRole.id_rol },
        });
        const student = await db.estudiantes.create({
          data: { id_usuario: learner.id_usuario, matricula: `TEST-${suffix}` },
        });
        const plan = await db.planes_estudio.create({
          data: {
            codigo: `TEST-${suffix}`,
            nombre: 'Plan verificación',
            id_carrera: campus.id_carrera,
            anio_inicio: 2026,
          },
        });
        const subject = await db.asignaturas.create({
          data: {
            codigo: `TEST-${suffix}`,
            nombre: 'Metodología previa',
            creditos: 3,
          },
        });
        await db.plan_estudio_asignaturas.create({
          data: {
            id_plan_estudio: plan.id_plan_estudio,
            id_asignatura: subject.id_asignatura,
            semestre: 8,
            obligatoria: true,
            tipo: 'REGULAR',
          },
        });
        const career = await db.estudiante_carreras.create({
          data: {
            id_estudiante: student.id_estudiante,
            id_plan_estudio: plan.id_plan_estudio,
            id_recinto_carrera: campus.id_recinto_carrera,
          },
        });
        await db.historial_academico.create({
          data: {
            id_estudiante_carrera: career.id_estudiante_carrera,
            id_asignatura: subject.id_asignatura,
            periodo_codigo: '2026-1',
            estado_asignatura: 'APROBADA',
            calificacion: 90,
          },
        });
        const proxy = new Proxy(db, {
          get: (target, key) =>
            key === '$transaction'
              ? (fn: (client: typeof db) => unknown) => fn(db)
              : Reflect.get(target, key),
        }) as unknown as PrismaService;
        const academics = new StudentsService(proxy, {} as AuthService);
        const process = new StudentProcessService(proxy, academics);
        const flow = new MonographService(proxy, academics);
        const documents = new EnrollmentsService(proxy, {
          create: () => Promise.resolve({}),
        } as unknown as NotificationsService);
        const auth = (
          id: bigint,
          permissions: string[],
        ): AuthenticatedUser => ({
          id: id.toString(),
          permissions,
          roles: [],
          email: 'test@example.invalid',
          matricula: '',
          codigoEmpleado: '',
          sessionId: 'test',
        });
        const secretary = auth(actor.id_usuario, ['*']);
        const own = auth(learner.id_usuario, ['MONOGRAFICO_LEER']);
        const lecturer = auth(teacher.id_usuario, [
          'MONOGRAFICO_LEER',
          'MONOGRAFICO_NOTAS',
        ]);
        await flow.confirmContact(own, {
          phone: '+18095551234',
          confirmed: true,
        });
        for (const channel of ['VIRTUAL', 'CAJA'] as const) {
          const offer = await db.ofertas.create({
            data: {
              codigo: `TEST-${channel}-${suffix}`,
              id_recinto_carrera: campus.id_recinto_carrera,
              id_modalidad: modality.id_modalidad,
              id_periodo: period.id_periodo,
              titulo: `Monográfico prueba ${channel}`,
              modalidad_ensenanza: 'SEMIPRESENCIAL',
              fecha_inicio_inscripcion: new Date(Date.now() - 86400000),
              fecha_fin_inscripcion: new Date(Date.now() + 86400000),
              cupo_total: 10,
              monto: 10000,
              estado: 'PUBLICADA',
              created_by: actor.id_usuario,
            },
          });
          const registered = await process.requestEnrollment(own.id, {
            offerId: offer.id_oferta.toString(),
          });
          assert.equal(registered.status, 'VALIDANDO');
          const enrollmentId = registered.id;
          await assert.rejects(
            flow.openDebt(secretary, enrollmentId),
            /validar/,
          );
          await flow.receive(secretary, enrollmentId);
          const request = await documents.requestDocument(secretary.id, {
            enrollmentId,
            type: 'Identidad',
            instructions: 'Copia legible',
          });
          await assert.rejects(
            flow.validate(secretary, enrollmentId, {
              documentsComplete: true,
              observation: '',
            }),
            /documentos/,
          );
          const document = await documents.uploadReceivedDocument(
            { enrollmentId, type: 'Identidad', requestId: request.id },
            {
              buffer: Buffer.from('%PDF-1.4 prueba'),
              size: 15,
              originalname: 'identidad.pdf',
              mimetype: 'application/pdf',
            },
          );
          await documents.validateDocument(secretary.id, document.id, {
            status: 'VALIDO',
          });
          await flow.validate(secretary, enrollmentId, {
            documentsComplete: true,
            observation: 'Expediente verificado',
          });
          await flow.openDebt(secretary, enrollmentId);
          await assert.rejects(
            documents.requestDocument(secretary.id, {
              enrollmentId,
              type: 'Cambio tardío',
              instructions: 'No debe modificar un expediente con deuda activa',
            }),
            /deuda activa/,
          );
          await flow.chooseChannel(own, enrollmentId, channel);
          const input = {
            channel,
            idempotencyKey: randomUUID(),
            outcome: 'RECHAZADO' as const,
            simulationAcknowledged: true,
          };
          const payer = channel === 'VIRTUAL' ? own : secretary;
          await flow.simulate(payer, enrollmentId, input);
          const approved = {
            ...input,
            idempotencyKey: randomUUID(),
            outcome: 'APROBADO' as const,
          };
          const payment = await flow.simulate(payer, enrollmentId, approved);
          assert.equal(
            (await flow.simulate(payer, enrollmentId, approved)).id,
            payment.id,
          );
          await assert.rejects(
            flow.simulate(payer, enrollmentId, {
              ...approved,
              idempotencyKey: randomUUID(),
            }),
          );
          assert.equal(
            await db.pagos.count({
              where: {
                id_inscripcion: BigInt(enrollmentId),
                estado: 'APROBADO',
              },
            }),
            1,
          );
          await flow.group(secretary, offer.id_oferta.toString(), {
            coordinatorId: teacher.id_usuario.toString(),
            whatsappUrl: 'https://chat.whatsapp.com/TestGroup',
            teachingBudget: 2000,
            materialsBudget: 500,
          });
          await assert.rejects(
            flow.grade(secretary, enrollmentId, {
              studentId: student.id_estudiante.toString(),
              grade: 95,
            }),
          );
          await flow.grade(lecturer, enrollmentId, {
            studentId: student.id_estudiante.toString(),
            grade: 95,
            observation: 'Curso completado',
          });
          await flow.remit(secretary, offer.id_oferta.toString());
          await assert.rejects(
            flow.grade(lecturer, enrollmentId, {
              studentId: student.id_estudiante.toString(),
              grade: 96,
            }),
          );
          const workspace = await flow.workspace(own);
          const current = workspace.items.find((r) => r.id === enrollmentId)!;
          assert.equal(current.paid, true);
          assert.equal(
            current.whatsappUrl,
            'https://chat.whatsapp.com/TestGroup',
          );
          assert.equal(current.participants[0].grade, 95);
          const method = await db.metodos_pago.findUniqueOrThrow({
            where: { codigo: 'SIMULACION' },
          });
          const finance = new PaymentsService(
            proxy,
            {} as NotificationsService,
            new InvoicePdfService(),
          );
          const reconciliation = await finance.createReconciliation(
            secretary.id,
            {
              provider: method.id_metodo_pago.toString(),
              from: new Date(Date.now() - 86400000).toISOString(),
              to: new Date(Date.now() + 86400000).toISOString(),
            },
          );
          assert.ok(reconciliation.id);
          const insights = await new InsightsService(proxy).load(own, {});
          assert.ok(insights.kpis.enrollments >= 1);
          assert.ok(insights.finances.some((f) => f.cash + f.virtual >= 10000));
          const receipt = await db.facturas.findUniqueOrThrow({
            where: { id_pago: BigInt(payment.id) },
          });
          const pdf = await new InvoicePdfService().render({
            simulated: true,
            number: receipt.numero_factura,
            receipt: receipt.numero_recibo,
            campus: receipt.recinto_nombre,
            registration: receipt.matricula,
            student: receipt.estudiante_nombre,
            description: receipt.descripcion,
            amount: Number(receipt.monto),
            currency: receipt.moneda,
            method: receipt.metodo_pago_nombre,
            issuedAt: receipt.fecha_emision,
            verificationUrl: 'https://example.invalid/demo',
          });
          mkdirSync('../../.tmp/verification', { recursive: true });
          writeFileSync(`../../.tmp/verification/recibo-${channel}.pdf`, pdf);
          const trace = await db.auditoria.count({
            where: {
              id_usuario: {
                in: [actor.id_usuario, learner.id_usuario, teacher.id_usuario],
              },
              entidad: 'monografico',
            },
          });
          assert.ok(trace > 5);
        }
        verified = true;
        throw rollback;
      },
      { timeout: 60000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
  assert.equal(verified, true);
  console.log(
    'PASS: validación académica real, recepción, deuda, ambos canales, rechazo/reintento, idempotencia, recibos, grupo, notas, remisión y auditoría. Fixtures revertidos.',
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
