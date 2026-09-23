import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { scanProjectEncoding } from './scan-project-encoding.mjs';

const report = await scanProjectEncoding(process.cwd());
await mkdir('.tmp', { recursive: true });
const path = resolve('.tmp', `files-encoding-${Date.now()}.json`);
await writeFile(path, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
console.log(
  `${report.filesScanned} archivos de texto revisados; ${report.findings.length} hallazgos; ${report.excluded.length} archivos de pruebas y ejemplos excluidos.`,
);
console.table(report.findings.map(({ file, line, reason }) => ({ file, line, reason })));
console.log(`Informe de archivos (solo diagnóstico): ${path}`);
if (process.argv.includes('--check') && report.findings.length) process.exitCode = 1;
