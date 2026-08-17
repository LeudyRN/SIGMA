import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client';

config({ path: ['.env', '../../.env'] });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configure ${name} en el archivo .env.`);
  return value;
}

const matricula = required('SIGMA_USER_MATRICULA').toUpperCase();
const email = required('SIGMA_USER_EMAIL').toLowerCase();
const password = required('SIGMA_USER_PASSWORD');
const firstName = process.env.SIGMA_USER_FIRST_NAME?.trim() || 'Usuario';
const lastName = process.env.SIGMA_USER_LAST_NAME?.trim() || 'SIGMA';
const roleCode = (process.env.SIGMA_USER_ROLE || 'ADMIN').trim().toUpperCase();
const roleName = process.env.SIGMA_USER_ROLE_NAME?.trim() || 'Administrador';

if (!/^[A-Z0-9-]{5,30}$/.test(matricula)) {
  throw new Error(
    'SIGMA_USER_MATRICULA debe tener entre 5 y 30 letras, números o guiones.',
  );
}
if (password.length < 12) {
  throw new Error('SIGMA_USER_PASSWORD debe tener al menos 12 caracteres.');
}

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER ?? 'sigma_user',
  password: process.env.DATABASE_PASSWORD ?? '',
  database: process.env.DATABASE_NAME ?? 'sigma_ucotesis',
  connectionLimit: 2,
});
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (database) => {
    const userByMatricula = await database.usuarios.findUnique({
      where: { matricula },
    });
    const userByEmail = await database.usuarios.findUnique({
      where: { email },
    });

    if (
      userByMatricula &&
      userByEmail &&
      userByMatricula.id_usuario !== userByEmail.id_usuario
    ) {
      throw new Error(
        'La matrícula y el correo pertenecen a cuentas diferentes.',
      );
    }

    const existingUser = userByEmail ?? userByMatricula;
    const user = existingUser
      ? await database.usuarios.update({
          where: { id_usuario: existingUser.id_usuario },
          data: {
            apellidos: lastName,
            email,
            email_verificado_at: new Date(),
            estado: 'ACTIVO',
            matricula,
            nombres: firstName,
            password_hash: passwordHash,
          },
        })
      : await database.usuarios.create({
          data: {
            apellidos: lastName,
            email,
            email_verificado_at: new Date(),
            estado: 'ACTIVO',
            matricula,
            nombres: firstName,
            password_hash: passwordHash,
            uuid: randomUUID(),
          },
        });

    if (roleCode === 'ESTUDIANTE') {
      await database.estudiantes.upsert({
        where: { id_usuario: user.id_usuario },
        update: { matricula },
        create: { id_usuario: user.id_usuario, matricula },
      });
    }

    const role = await database.roles.upsert({
      where: { codigo: roleCode },
      update: { estado: 'ACTIVO', nombre: roleName },
      create: {
        codigo: roleCode,
        descripcion: `Rol ${roleName} creado para SIGMA`,
        estado: 'ACTIVO',
        nombre: roleName,
      },
    });

    await database.usuario_roles.upsert({
      where: {
        id_usuario_id_rol: { id_rol: role.id_rol, id_usuario: user.id_usuario },
      },
      update: {},
      create: { id_rol: role.id_rol, id_usuario: user.id_usuario },
    });
  });

  console.log(`Usuario preparado: ${matricula} (${roleCode})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
