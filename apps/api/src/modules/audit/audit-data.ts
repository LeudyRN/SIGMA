const SENSITIVE_KEY =
  /password|contrase[nñ]a|token|secret|authorization|cookie|contenido|buffer|hash|credential/i;
export function sanitizeAuditData(value: unknown): unknown {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return undefined;
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizeAuditData);
  const record = value as Record<string, unknown>;
  const secretConfiguration = [record.key, record.clave].some(
    (key) => typeof key === 'string' && SENSITIVE_KEY.test(key),
  );
  return Object.fromEntries(
    Object.entries(record)
      .filter(
        ([key]) =>
          !SENSITIVE_KEY.test(key) &&
          !(secretConfiguration && ['value', 'valor'].includes(key)),
      )
      .map(([key, item]) => [key, sanitizeAuditData(item)]),
  );
}
