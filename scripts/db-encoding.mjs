import { loadEnvFile } from 'node:process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';
import { applyEncodingRepairs } from './apply-encoding-repairs.mjs';
import { scanDatabaseEncoding } from './scan-database-encoding.mjs';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--apply')) {
  throw new Error('Uso: pnpm db:encoding [--apply ruta-del-informe.json]');
}
try {
  loadEnvFile(resolve('apps/api/.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  try {
    loadEnvFile(resolve('.env'));
  } catch (fallbackError) {
    if (fallbackError.code !== 'ENOENT') throw fallbackError;
  }
}
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL.');

let connection;
try {
  connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    charset: 'UTF8MB4_UNICODE_CI',
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
  const [[settings]] = await connection.query(`SELECT DATABASE() AS databaseName,
    @@character_set_client AS client, @@character_set_connection AS connection,
    @@character_set_results AS results, @@character_set_database AS databaseCharset`);
  const [columns] = await connection.query(`SELECT TABLE_NAME AS tableName,
    COLUMN_NAME AS columnName, CHARACTER_SET_NAME AS charset
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND CHARACTER_SET_NAME IS NOT NULL AND CHARACTER_SET_NAME <> 'utf8mb4'`);
  console.table([settings]);
  if (columns.length) {
    console.log('Columnas que no usan utf8mb4 (requieren revisión de esquema):');
    console.table(columns);
  }

  if (args[0] === '--apply') {
    const report = JSON.parse(await readFile(resolve(args[1]), 'utf8'));
    await applyEncodingRepairs(connection, report);
    console.log(
      `Corregidos ${report.changes.length} campos de texto. El informe conserva los valores originales.`,
    );
  } else {
    const scan = await scanDatabaseEncoding(connection);
    await mkdir(resolve('.tmp'), { recursive: true });
    const reportPath = resolve('.tmp', `encoding-${Date.now()}.json`);
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          databaseName: settings.databaseName,
          createdAt: new Date().toISOString(),
          settings,
          columns,
          ...scan,
        },
        null,
        2,
      ) + '\n',
      { encoding: 'utf8', flag: 'wx' },
    );
    console.table(scan.summary);
    console.log(
      `${scan.summary.length} tablas revisadas; ${scan.changes.length} campos reparables; ${scan.unresolved.length} requieren revisión manual; ${scan.skipped.length} campos protegidos excluidos.`,
    );
    console.log(`Informe y respaldo de valores originales: ${reportPath}`);
    console.log('No se modificó la base de datos.');
    if (scan.changes.length)
      console.log(
        `Para aplicar las correcciones revisadas:\npnpm db:encoding --apply "${reportPath}"`,
      );
    console.log(
      'Después de aplicar: pnpm db:encoding. Cierre sesión y vuelva a entrar para renovar nombres y roles.',
    );
  }
} catch (error) {
  if (connection) await connection.rollback().catch(() => {});
  // Driver errors may contain connection details; never print the URL or credentials.
  console.error(
    error.code ? `MySQL: ${error.code}. Revise la conexión y los permisos.` : error.message,
  );
  process.exitCode = 1;
} finally {
  if (connection) await connection.end();
}
