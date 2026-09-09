import { insightPeriod } from './insights.service';
jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
describe('Report period', () => {
  it('includes the entire selected day in Santo Domingo', () => {
    const p = insightPeriod({ from: '2026-09-01', to: '2026-09-08' });
    expect(p.days).toBe(8);
    expect(p.start.toISOString()).toBe('2026-09-01T04:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-09-09T03:59:59.999Z');
    expect(p.previous.toISOString()).toBe('2026-08-24T04:00:00.000Z');
  });
  it('rejects invalid dates, reversed periods and unbounded exports', () => {
    for (const q of [
      { from: '2026-02-31', to: '2026-03-03' },
      { from: '2026-09-08', to: '2026-09-01' },
      { from: '2020-01-01', to: '2026-09-08' },
    ])
      expect(() => insightPeriod(q)).toThrow();
  });
});

import { activityOutcome } from './insights.service';
it('exposes the audit result without inventing success for legacy events', () => {
  expect(activityOutcome('CREAR', { outcome: 'ERROR' })).toBe('error');
  expect(activityOutcome('CREAR', { outcome: 'EXITO' })).toBe('success');
  expect(activityOutcome('CREAR', null)).toBe('unknown');
  expect(activityOutcome('REMITIR_NOTAS', {})).toBe('success');
  expect(
    activityOutcome('PAGAR_VIRTUAL_SIMULADO', { outcome: 'RECHAZADO' }),
  ).toBe('rejected');
});
