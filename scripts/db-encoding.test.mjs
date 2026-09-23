import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import mysql from 'mysql2/promise';
import { applyEncodingRepairs } from './apply-encoding-repairs.mjs';
import { scanDatabaseEncoding } from './scan-database-encoding.mjs';
import { discoverEncodingSchema, columnPolicy } from './database-encoding-schema.mjs';

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

test('scans multiple tables, preserves secrets, supports composite keys and rolls back a stale batch', async () => {
  process.loadEnvFile(existsSync('apps/api/.env') ? 'apps/api/.env' : '.env');
  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    charset: 'UTF8MB4_UNICODE_CI',
  });
  const textColumn = (name, extras = {}) => ({ name, type: 'varchar', ...extras });
  const schema = [
    {
      name: 'encoding_people',
      engine: 'InnoDB',
      pk: ['tenant', 'id'],
      columns: [
        textColumn('nombre'),
        textColumn('password_hash'),
        textColumn('codigo'),
        textColumn('notas'),
        textColumn('metadata', { type: 'json' }),
      ],
    },
    { name: 'encoding_careers', engine: 'InnoDB', pk: ['id'], columns: [textColumn('nombre')] },
  ];
  try {
    const discovered = await discoverEncodingSchema(connection);
    const roles = discovered.find((table) => table.name === 'roles');
    assert.deepEqual(
      columnPolicy(
        roles,
        roles.columns.find((column) => column.name === 'nombre'),
      ),
      {},
    );
    const careers = discovered.find((table) => table.name === 'carreras');
    assert.deepEqual(
      columnPolicy(
        careers,
        careers.columns.find((column) => column.name === 'nombre'),
      ),
      {},
    );
    assert.ok(
      columnPolicy({ name: 'auditoria', pk: ['id'], engine: 'InnoDB' }, textColumn('accion'))
        .manual,
    );
    await connection.query(`CREATE TEMPORARY TABLE encoding_people (
      tenant INT, id BIGINT, nombre VARCHAR(100), password_hash VARCHAR(100), codigo VARCHAR(100), notas TEXT, metadata JSON,
      PRIMARY KEY (tenant,id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TEMPORARY TABLE encoding_careers (
      id INT PRIMARY KEY, nombre VARCHAR(100) UNIQUE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.execute(
      'INSERT INTO encoding_people VALUES (1, 9007199254740993, ?, ?, ?, NULL, ?)',
      [
        'SecretarÃ­a UCOTESIS',
        'SECRET-CÃ¡lculo',
        'CÃ“DIGO',
        JSON.stringify({ name: 'InformÃ¡tica', nested: { password_hash: 'HIDDEN-CÃ¡lculo' } }),
      ],
    );
    await connection.execute('INSERT INTO encoding_careers VALUES (1, ?)', [
      'InformÃ¡tica y Ética',
    ]);
    const [[{ databaseName }]] = await connection.query('SELECT DATABASE() AS databaseName');
    const scan = await scanDatabaseEncoding(connection, schema);
    assert.equal(scan.changes.length, 2);
    assert.equal(scan.unresolved.length, 2);
    assert.equal(scan.skipped.length, 1);
    assert.ok(!JSON.stringify(scan).includes('SECRET-'));
    assert.ok(!JSON.stringify(scan).includes('HIDDEN-'));
    assert.equal(scan.changes[0].key.id, '9007199254740993');
    const stale = structuredClone(scan);
    stale.changes[1].key.id = '999';
    await assert.rejects(
      applyEncodingRepairs(connection, { databaseName, ...stale }, schema),
      /cambió/,
    );
    const [[original]] = await connection.query('SELECT nombre FROM encoding_people');
    assert.equal(original.nombre, 'SecretarÃ­a UCOTESIS');
    const tampered = structuredClone(scan);
    tampered.changes[0].column = 'password_hash';
    await assert.rejects(
      applyEncodingRepairs(connection, { databaseName, ...tampered }, schema),
      /protegido/,
    );
    await connection.execute('INSERT INTO encoding_careers VALUES (2, ?)', ['Informática y Ética']);
    await assert.rejects(applyEncodingRepairs(connection, { databaseName, ...scan }, schema), {
      code: 'ER_DUP_ENTRY',
    });
    const [[rolledBack]] = await connection.query('SELECT nombre FROM encoding_people');
    assert.equal(rolledBack.nombre, 'SecretarÃ­a UCOTESIS');
    await connection.query('DELETE FROM encoding_careers WHERE id = 2');
    await applyEncodingRepairs(connection, { databaseName, ...scan }, schema);
    const after = await scanDatabaseEncoding(connection, schema);
    assert.equal(after.changes.length, 0);
    const [[fixed]] = await connection.query('SELECT nombre, password_hash FROM encoding_people');
    assert.equal(fixed.nombre, 'Secretaría UCOTESIS');
    assert.equal(fixed.password_hash, 'SECRET-CÃ¡lculo');
  } finally {
    await connection.end();
  }
});
