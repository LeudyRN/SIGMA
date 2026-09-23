import { repairEncoding, repairTextEncoding } from './encoding-repair.mjs';
import {
  columnPolicy,
  discoverEncodingSchema,
  quoteIdentifier as qi,
} from './database-encoding-schema.mjs';

export async function applyEncodingRepairs(connection, report, schema) {
  const [[{ databaseName }]] = await connection.query('SELECT DATABASE() AS databaseName');
  if (report.databaseName !== databaseName || !Array.isArray(report.changes)) {
    throw new Error('El informe no corresponde a esta base de datos.');
  }
  if (report.version === 2) return applyAllTextRepairs(connection, report, schema);
  if (report.version !== undefined) throw new Error('Versión de informe no compatible.');
  await connection.beginTransaction();
  try {
    for (const change of report.changes) {
      if (
        !/^\d+$/.test(change.id) ||
        typeof change.before !== 'string' ||
        typeof change.after !== 'string' ||
        repairEncoding(change.before) !== change.after
      ) {
        throw new Error('El informe contiene una conversión no verificable.');
      }
      const [[current]] = await connection.execute(
        'SELECT codigo, nombre FROM asignaturas WHERE id_asignatura = ? FOR UPDATE',
        [change.id],
      );
      if (!current || current.codigo !== change.code || current.nombre !== change.before) {
        throw new Error(`La asignatura ${change.id} cambió. Genere otro informe.`);
      }
      await connection.execute('UPDATE asignaturas SET nombre = ? WHERE id_asignatura = ?', [
        change.after,
        change.id,
      ]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function applyAllTextRepairs(connection, report, schema) {
  const tables = schema ?? (await discoverEncodingSchema(connection));
  await connection.beginTransaction();
  try {
    for (const change of report.changes) {
      const table = tables.find((entry) => entry.name === change.table);
      const column = table?.columns.find((entry) => entry.name === change.column);
      const policy = column && columnPolicy(table, column);
      if (
        !column ||
        policy.skip ||
        policy.manual ||
        typeof change.before !== 'string' ||
        typeof change.after !== 'string' ||
        repairTextEncoding(change.before) !== change.after ||
        !change.key ||
        Object.keys(change.key).length !== table.pk.length ||
        !table.pk.every((name) => typeof change.key[name] === 'string')
      ) {
        throw new Error('El informe contiene un campo protegido o una conversión no verificable.');
      }
      const where = table.pk.map((name) => `${qi(name)} = ?`).join(' AND ');
      const keys = table.pk.map((name) => change.key[name]);
      const [rows] = await connection.execute(
        `SELECT ${qi(column.name)} AS value FROM ${qi(table.name)} WHERE ${where} FOR UPDATE`,
        keys,
      );
      if (rows.length !== 1 || rows[0].value !== change.before) {
        throw new Error(`El dato de ${table.name}.${column.name} cambió. Genere otro informe.`);
      }
      await connection.execute(
        `UPDATE ${qi(table.name)} SET ${qi(column.name)} = ? WHERE ${where}`,
        [change.after, ...keys],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
