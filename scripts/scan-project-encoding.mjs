import { execFileSync } from 'node:child_process';
import { readFile, lstat } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import { inspectEncoding, repairTextEncoding } from './encoding-repair.mjs';

const TEXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.sql',
  '.md',
  '.txt',
  '.html',
  '.css',
  '.scss',
  '.svg',
  '.yml',
  '.yaml',
  '.toml',
  '.prisma',
  '.ps1',
  '.sh',
  '.example',
]);
export async function scanProjectEncoding(root) {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root },
  )
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  const result = { filesScanned: 0, findings: [], excluded: [] };
  for (const file of new Set(files)) {
    if (
      /(^|\/)(node_modules|generated|\.next|dist|\.git|\.tmp)\//.test(file) ||
      (/^\.env(?:\.|$)/.test(basename(file)) && !file.endsWith('.example')) ||
      /\.(pem|key|pfx)$/i.test(file)
    )
      continue;
    if (
      !TEXT.has(extname(file)) &&
      !['.editorconfig', '.gitignore', '.gitattributes'].includes(basename(file))
    )
      continue;
    // Encoding examples deliberately contain broken text; don't propose changing them.
    if (/\.(spec|test)\.[^.]+$/.test(file) || /^scripts\/.*encoding.*\.mjs$/.test(file)) {
      result.excluded.push(file);
      continue;
    }
    const path = resolve(root, file);
    let bytes;
    try {
      if (!(await lstat(path)).isFile()) continue;
      bytes = await readFile(path);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    result.filesScanned += 1;
    let content;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      result.findings.push({
        file,
        reason:
          'El archivo no es UTF-8 válido. Reabrir con su codificación original y guardar como UTF-8.',
      });
      continue;
    }
    content.split(/\r?\n/).forEach((line, index) => {
      if (
        file === 'README.md' &&
        (/ya se guardaron como/.test(line) || /bytes perdidos/.test(line))
      )
        return;
      if (inspectEncoding(line))
        result.findings.push({
          file,
          line: index + 1,
          before: line,
          after: repairTextEncoding(line),
          reason: file.startsWith('apps/api/prisma/migrations/')
            ? 'Migración histórica: no editar si ya fue aplicada.'
            : 'Revisar el texto en su contexto.',
        });
    });
  }
  return result;
}
