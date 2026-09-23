import { repairEncoding } from './encoding-repair.mjs';

export async function applyEncodingRepairs(connection, report) {
  const [[{ databaseName }]] = await connection.query('SELECT DATABASE() AS databaseName');
  if (report.databaseName !== databaseName || !Array.isArray(report.changes)) {
    throw new Error('El informe no corresponde a esta base de datos.');
  }
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
