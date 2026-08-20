import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

const envPath = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
].find(existsSync);
if (envPath) loadEnvFile(envPath);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: requireDatabaseUrl(),
  },
});

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL es obligatorio para ejecutar Prisma.');
  }
  return url;
}
