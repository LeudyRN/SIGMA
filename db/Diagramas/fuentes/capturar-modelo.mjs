import { loadEnvFile } from 'node:process';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const require = createRequire(new URL('apps/api/package.json', root));
const mysql = require('mysql2/promise');
if (!process.env.DATABASE_URL) loadEnvFile(fileURLToPath(new URL('apps/api/.env', root)));
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [tables] = await db.query(`SELECT TABLE_NAME,TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME <> '_prisma_migrations' ORDER BY TABLE_NAME`);
  const [columns] = await db.query(`SELECT TABLE_NAME,COLUMN_NAME,ORDINAL_POSITION,COLUMN_DEFAULT,IS_NULLABLE,DATA_TYPE,COLUMN_TYPE,EXTRA,COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME <> '_prisma_migrations' ORDER BY TABLE_NAME,ORDINAL_POSITION`);
  const [keys] = await db.query(`SELECT k.TABLE_NAME,k.CONSTRAINT_NAME,t.CONSTRAINT_TYPE,k.COLUMN_NAME,k.ORDINAL_POSITION,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.UPDATE_RULE,r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.TABLE_CONSTRAINTS t ON k.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND k.TABLE_NAME=t.TABLE_NAME AND k.CONSTRAINT_NAME=t.CONSTRAINT_NAME LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON k.CONSTRAINT_SCHEMA=r.CONSTRAINT_SCHEMA AND k.TABLE_NAME=r.TABLE_NAME AND k.CONSTRAINT_NAME=r.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME <> '_prisma_migrations' ORDER BY k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION`);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo' }).format(new Date());
  writeFileSync(new URL('modelo-fisico.json', import.meta.url), JSON.stringify({ source: 'Metadatos de MySQL: information_schema (sin datos de usuarios)', date, tables, columns, keys }, null, 2));
  const base = new Set(tables.filter(t => t.TABLE_TYPE === 'BASE TABLE').map(t => t.TABLE_NAME));
  console.log(JSON.stringify({ tables: base.size, columns: columns.filter(c => base.has(c.TABLE_NAME)).length, views: tables.filter(t => t.TABLE_TYPE === 'VIEW').length, foreignKeys: new Set(keys.filter(k => k.CONSTRAINT_TYPE === 'FOREIGN KEY').map(k => `${k.TABLE_NAME}.${k.CONSTRAINT_NAME}`)).size }));
} finally {
  await db.end();
}
