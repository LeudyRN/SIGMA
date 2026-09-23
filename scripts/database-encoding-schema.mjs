export const quoteIdentifier = (name) => `\`${name.replaceAll('`', '``')}\``;
const TEXT_TYPES = new Set([
  'char',
  'varchar',
  'tinytext',
  'text',
  'mediumtext',
  'longtext',
  'enum',
  'set',
  'json',
]);
export const isSensitiveEncodingField = (name) =>
  /password|passphrase|token|hash|secret|credential|credencial|api.?key|clave|authorization|cookie/i.test(
    name,
  );
const HISTORICAL = /^(auditoria|facturas|historial_estados_inscripcion|transacciones_pago)$/;

export function columnPolicy(table, column) {
  if (
    isSensitiveEncodingField(column.name) ||
    table.name === 'sesiones' ||
    (table.name === 'configuraciones' && column.name === 'valor')
  ) {
    return { skip: 'Dato sensible u opaco: no se exporta al informe.' };
  }
  if (!table.pk.length) return { manual: 'Tabla sin clave primaria.' };
  if (table.engine !== 'InnoDB') return { manual: 'Tabla sin transacciones InnoDB.' };
  if (HISTORICAL.test(table.name))
    return { manual: 'Documento histórico o auditoría: conservar el original.' };
  if (
    table.pk.includes(column.name) ||
    column.foreign ||
    column.generated ||
    ['enum', 'set', 'json'].includes(column.type) ||
    /^(codigo|clave|estado|email|correo|telefono|whatsapp|cedula|matricula|url|ruta|referencia)(_|$)/i.test(
      column.name,
    )
  ) {
    return { manual: 'Identificador, dato estructurado o restricción: requiere revisión.' };
  }
  return {};
}

export async function discoverEncodingSchema(connection) {
  const [rows] = await connection.query(`SELECT c.TABLE_NAME AS tableName,
    t.ENGINE AS engine, c.COLUMN_NAME AS name, c.DATA_TYPE AS type,
    c.COLUMN_KEY AS columnKey, c.EXTRA AS extra, c.CHARACTER_SET_NAME AS charset,
    EXISTS(SELECT 1 FROM information_schema.KEY_COLUMN_USAGE k
      WHERE (k.TABLE_SCHEMA=c.TABLE_SCHEMA AND k.TABLE_NAME=c.TABLE_NAME
      AND k.COLUMN_NAME=c.COLUMN_NAME AND k.REFERENCED_TABLE_NAME IS NOT NULL)
      OR (k.REFERENCED_TABLE_SCHEMA=c.TABLE_SCHEMA AND k.REFERENCED_TABLE_NAME=c.TABLE_NAME
      AND k.REFERENCED_COLUMN_NAME=c.COLUMN_NAME)) AS isForeign,
    (SELECT s.SEQ_IN_INDEX FROM information_schema.STATISTICS s
      WHERE s.TABLE_SCHEMA=c.TABLE_SCHEMA AND s.TABLE_NAME=c.TABLE_NAME
      AND s.COLUMN_NAME=c.COLUMN_NAME AND s.INDEX_NAME='PRIMARY') AS pkOrder
    FROM information_schema.COLUMNS c JOIN information_schema.TABLES t
      ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME
    WHERE c.TABLE_SCHEMA=DATABASE() AND t.TABLE_TYPE='BASE TABLE'
      AND c.TABLE_NAME <> '_prisma_migrations'
    ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`);
  const tables = new Map();
  for (const row of rows) {
    if (!tables.has(row.tableName))
      tables.set(row.tableName, { name: row.tableName, engine: row.engine, pk: [], columns: [] });
    const table = tables.get(row.tableName);
    if (row.pkOrder) table.pk.push({ name: row.name, order: row.pkOrder });
    if (TEXT_TYPES.has(row.type))
      table.columns.push({
        name: row.name,
        type: row.type,
        key: Boolean(row.columnKey),
        foreign: Boolean(row.isForeign),
        generated: /GENERATED/.test(row.extra),
        charset: row.charset,
      });
  }
  return [...tables.values()].map((table) => ({
    ...table,
    pk: table.pk.sort((a, b) => a.order - b.order).map((key) => key.name),
  }));
}
