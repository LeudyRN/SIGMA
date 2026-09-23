import assert from 'node:assert/strict';
import test from 'node:test';
import { repairEncoding } from './encoding-repair.mjs';

test('recovers Spanish subject names without losing accents', () => {
  for (const name of [
    'Investigación de Operaciones',
    'Cálculo II',
    'Estadística Básica',
    'Ingeniería de Software',
    'Bioética',
    'Inglés Técnico',
  ]) {
    const broken = Buffer.from(name, 'utf8').toString('latin1');
    assert.equal(repairEncoding(broken), name);
    assert.equal(repairEncoding(Buffer.from(broken).toString('latin1')), name);
    assert.equal(repairEncoding(name), null);
  }
});

test('handles Windows-1252 punctuation as well as Latin-1', () => {
  assert.equal(repairEncoding('BioÃ©tica â€“ InglÃ©s'), 'Bioética – Inglés');
});

test('does not guess mixed, truncated or already valid Unicode', () => {
  for (const value of [
    'Cálculo',
    'AÑO',
    'Ã',
    'C�lculo',
    'C?lculo',
    'CÃ¡lculo y Ética',
    '中文 😀',
  ]) {
    assert.equal(repairEncoding(value), null);
  }
});
