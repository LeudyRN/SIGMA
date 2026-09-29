import 'reflect-metadata';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import type { Prisma } from '../src/generated/prisma/client';
import type { AuthenticatedUser } from '../src/modules/auth/interfaces/jwt-payload.interface';
import { ProjectAdvisorsService } from '../src/modules/coordination/project-advisors.service';

loadEnvFile(existsSync('.env') ? '.env' : '../../.env');
const prisma = new PrismaService(new ConfigService());
const rollback = new Error('ROLLBACK_ADVISOR_VERIFICATION');
async function main() {
  let verified = false;
  try {
    await prisma.$transaction(
      async (tx) => {
        const project = await tx.proyectos_grado.findFirstOrThrow();
        const account = await tx.usuarios.findFirstOrThrow({
          where: { estado: 'ACTIVO', deleted_at: null },
        });
        const beforeUsers = await tx.usuarios.count();
        const database = new Proxy(tx, {
          get: (target, key) =>
            key === '$transaction'
              ? (callback: (db: Prisma.TransactionClient) => unknown) =>
                  callback(tx)
              : Reflect.get(target, key),
        }) as unknown as PrismaService;
        const service = new ProjectAdvisorsService(database);
        const coordinator = {
          id: account.id_usuario.toString(),
          roles: ['COORDINADOR'],
        } as AuthenticatedUser;
        const secretary = { ...coordinator, roles: ['SECRETARIA'] };
        const data = {
          name: 'Verificación asesor sin cuenta',
          participation: 'ASESOR',
          email: 'verification@example.invalid',
          phone: '8095550100',
        };
        const result = await service.save(
          coordinator,
          project.id_proyecto.toString(),
          data,
        );
        const row = (await service.list(secretary)).projects.find(
          (entry) => entry.id === project.id_proyecto.toString(),
        )!;
        assert.equal(row.canManage, false);
        assert.ok(
          row.advisors.some(
            (entry) => entry.id === result.id && entry.email === data.email,
          ),
        );
        await assert.rejects(service.save(secretary, row.id, data));
        await assert.rejects(
          service.list({ ...coordinator, roles: ['ASESOR'] }),
        );
        await service.save(
          coordinator,
          row.id,
          {
            ...data,
            name: 'Verificación asesor actualizado',
            active: false,
            version: 1,
          },
          result.id,
        );
        await assert.rejects(
          service.save(
            coordinator,
            row.id,
            { ...data, active: true, version: 1 },
            result.id,
          ),
        );
        const saved = await tx.asesores_proyecto.findUniqueOrThrow({
          where: { id_asesor: BigInt(result.id) },
        });
        assert.equal(saved.activo, false);
        assert.equal(saved.version, 2);
        assert.equal(await tx.usuarios.count(), beforeUsers);
        assert.equal(
          await tx.auditoria.count({
            where: { entidad: 'asesores_proyecto', entidad_id: result.id },
          }),
          2,
        );
        verified = true;
        throw rollback;
      },
      { timeout: 30000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }
  assert.ok(verified);
  console.log(
    'Verificado en MySQL: registro sin cuenta, consulta de Secretaría, permisos, edición, auditoría y conservación del registro. Todos los datos de prueba fueron revertidos.',
  );
}
void main();
