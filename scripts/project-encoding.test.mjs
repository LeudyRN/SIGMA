import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { scanProjectEncoding } from './scan-project-encoding.mjs';

test('detects damaged source and invalid UTF-8, excludes real env secrets and test examples', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sigma-encoding-test-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    await writeFile(join(root, 'page.tsx'), "const title = 'InformÃ¡tica y Ética';\n");
    await writeFile(join(root, 'valid.ts'), "const title = 'Secretaría';\n");
    await writeFile(join(root, '.env.production'), 'SECRET=SecretarÃ­a');
    await writeFile(join(root, 'sample.test.ts'), "const fixture = 'CÃ¡lculo';");
    await writeFile(join(root, 'invalid.txt'), Uint8Array.from([0xff, 0xfe, 0x41]));
    const report = await scanProjectEncoding(root);
    assert.equal(report.findings.length, 2);
    assert.ok(!JSON.stringify(report).includes('SECRET='));
    assert.equal(
      report.findings.find((finding) => finding.file === 'page.tsx').after,
      "const title = 'Informática y Ética';",
    );
    assert.ok(report.findings.some((finding) => finding.file === 'invalid.txt' && !finding.line));
    assert.deepEqual(report.excluded, ['sample.test.ts']);
  } finally {
    if (dirname(root) !== resolve(tmpdir())) throw new Error('Directorio temporal inesperado.');
    await rm(root, { recursive: true, force: true });
  }
});
