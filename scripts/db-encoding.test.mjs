import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import mysql from 'mysql2/promise';
import { applyEncodingRepairs } from './apply-encoding-repairs.mjs';

test('repairs atomically and refuses stale reports using a temporary MySQL table', async () => {
  process.loadEnvFile(existsSync('apps/api/.env') ? 'apps/api/.env' : '.env');
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    charset: 'UTF8MB4_UNICODE_CI',
  });
  try {
    // The temporary table shadows the real table only in this connection.
    await connection.query(`CREATE TEMPORARY TABLE asignaturas (
      id_asignatura BIGINT PRIMARY KEY, codigo VARCHAR(30), nombre VARCHAR(180)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.execute('INSERT INTO asignaturas VALUES (1, ?, ?), (2, ?, ?)', [
      'TEST1',
      'CÃ¡lculo',
      'TEST2',
      'BioÃ©tica',
    ]);
    const [[{ databaseName }]] = await connection.query('SELECT DATABASE() AS databaseName');
    const changes = [
      { id: '1', code: 'TEST1', before: 'CÃ¡lculo', after: 'Cálculo' },
      { id: '2', code: 'TEST2', before: 'BioÃ©tica', after: 'Bioética' },
    ];
    await assert.rejects(
      applyEncodingRepairs(connection, {
        databaseName,
        changes: [changes[0], { ...changes[1], code: 'STALE' }],
      }),
      /cambió/,
    );
    const [[unchanged]] = await connection.query(
      'SELECT nombre FROM asignaturas WHERE id_asignatura = 1',
    );
    assert.equal(unchanged.nombre, 'CÃ¡lculo');
    await assert.rejects(
      applyEncodingRepairs(connection, {
        databaseName,
        changes: [{ ...changes[0], after: 'Incorrecto' }],
      }),
      /no verificable/,
    );
    await applyEncodingRepairs(connection, { databaseName, changes });
    const [rows] = await connection.query('SELECT nombre FROM asignaturas ORDER BY id_asignatura');
    assert.deepEqual(
      rows.map((row) => row.nombre),
      ['Cálculo', 'Bioética'],
    );
    await assert.rejects(applyEncodingRepairs(connection, { databaseName, changes }), /cambió/);
  } finally {
    await connection.end();
  }
});
