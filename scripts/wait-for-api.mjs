import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';

try {
  loadEnvFile(resolve('apps/api/.env'));
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
    throw error;
  }
}

const configuredApiUrl =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  `http://127.0.0.1:${process.env.API_PORT ?? '3001'}`;
const apiOrigin = configuredApiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
const healthUrl = `${apiOrigin}/api/health`;
const timeoutMs = Number(process.env.API_WAIT_TIMEOUT_MS ?? 90_000);
const startedAt = Date.now();

if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
  throw new Error('API_WAIT_TIMEOUT_MS debe ser un número mayor que cero.');
}

while (Date.now() - startedAt < timeoutMs) {
  try {
    const response = await fetch(healthUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1_500),
    });

    if (response.ok) {
      process.stdout.write(`API disponible en ${healthUrl}. Iniciando frontend.\n`);
      process.exit(0);
    }
  } catch {
    // La API puede estar compilando o conectándose a la base de datos.
  }

  await new Promise((resolveWait) => setTimeout(resolveWait, 350));
}

process.stderr.write(
  `La API no respondió en ${healthUrl} después de ${timeoutMs} ms. ` +
    'Revise el proceso API y su configuración de base de datos.\n',
);
process.exit(1);
