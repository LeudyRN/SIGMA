import assert from 'node:assert/strict';
import test from 'node:test';
import { repairEncoding, repairTextEncoding } from './encoding-repair.mjs';

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

test('repairs mixed Unicode, roles, careers and repeated encoding', () => {
  for (const name of [
    'Secretaría UCOTESIS',
    'Licenciatura en Informática 40601',
    'Álgebra y Ética',
  ]) {
    const broken = Buffer.from(name).toString('latin1');
    assert.equal(repairTextEncoding(broken), name);
    assert.equal(repairTextEncoding(Buffer.from(broken).toString('latin1')), name);
  }
  assert.equal(repairTextEncoding('CÃ¡lculo y Ética 😀'), 'Cálculo y Ética 😀');
  assert.equal(repairTextEncoding('BioÃ©tica â€“ Español'), 'Bioética – Español');
  for (const valid of [
    'Secretaría',
    'Informática',
    'AÑO',
    '中文 😀',
    'Ã',
    'C�lculo',
    'CÃ¡lculo �',
  ]) {
    assert.equal(repairTextEncoding(valid), null);
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
