import {
  columnPolicy,
  discoverEncodingSchema,
  quoteIdentifier as qi,
  isSensitiveEncodingField,
} from './database-encoding-schema.mjs';
import { inspectEncoding, repairTextEncoding } from './encoding-repair.mjs';

export async function scanDatabaseEncoding(connection, schema) {
  const tables = schema ?? (await discoverEncodingSchema(connection));
  const result = { version: 2, changes: [], unresolved: [], skipped: [], summary: [] };
  for (const table of tables) {
    let scanned = 0;
    let findings = 0;
    const columns = table.columns.filter((column) => {
      const policy = columnPolicy(table, column);
      if (policy.skip)
        result.skipped.push({ table: table.name, column: column.name, reason: policy.skip });
      return !policy.skip;
    });
    if (!columns.length) continue;
    const selected = [...new Set([...table.pk, ...columns.map((column) => column.name)])];
    // CAST preserves large and composite primary keys without JS number rounding.
    const select = selected
      .map((name) => `CAST(${qi(name)} AS CHAR CHARACTER SET utf8mb4) AS ${qi(name)}`)
      .join(', ');
    const order = table.pk.length ? ` ORDER BY ${table.pk.map(qi).join(', ')}` : '';
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const [rows] = await connection.query(
        `SELECT ${select} FROM ${qi(table.name)}${order} LIMIT ${pageSize} OFFSET ${offset}`,
      );
      for (const row of rows) {
        for (const column of columns) {
          const before = row[column.name];
          if (typeof before !== 'string') continue;
          scanned += 1;
          if (column.type === 'json') {
            const key = Object.fromEntries(table.pk.map((name) => [name, row[name]]));
            const inspectJson = (value, path = []) => {
              if (typeof value === 'string' && inspectEncoding(value)) {
                findings += 1;
                result.unresolved.push({
                  table: table.name,
                  column: column.name,
                  key,
                  jsonPath: path,
                  before: value,
                  after: repairTextEncoding(value),
                  reason:
                    'Texto dentro de JSON: revisar su contexto y conservar la auditoría original.',
                });
              } else if (value && typeof value === 'object') {
                for (const [name, child] of Object.entries(value)) {
                  if (!isSensitiveEncodingField(name)) inspectJson(child, [...path, name]);
                }
              }
            };
            try {
              inspectJson(JSON.parse(before));
            } catch {
              result.unresolved.push({
                table: table.name,
                column: column.name,
                key,
                reason: 'JSON no válido; revisar sin exportar su contenido.',
              });
            }
            continue;
          }
          if (!inspectEncoding(before)) continue;
          const after = repairTextEncoding(before);
          findings += 1;
          const change = {
            table: table.name,
            column: column.name,
            key: Object.fromEntries(table.pk.map((name) => [name, row[name]])),
            before,
            after,
          };
          const policy = columnPolicy(table, column);
          if (after && !policy.manual) result.changes.push(change);
          else
            result.unresolved.push({
              ...change,
              reason: policy.manual ?? 'No hay una conversión reversible inequívoca.',
            });
        }
      }
      if (rows.length < pageSize) break;
    }
    result.summary.push({ table: table.name, columns: columns.length, scanned, findings });
  }
  return result;
}
