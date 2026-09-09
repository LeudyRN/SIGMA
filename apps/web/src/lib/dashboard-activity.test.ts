import { describe, expect, it } from 'vitest';
import {
  activityMessage,
  groupRecentActivity,
  activityArea,
  type DashboardActivity,
} from './dashboard-activity';
const event: DashboardActivity = {
  id: '1',
  actor: 'Leudy Nolasco',
  actorId: '10',
  action: 'CREAR',
  entity: 'payments/reconciliations',
  date: '2026-09-09T03:24:00Z',
  outcome: 'success',
};
it('describes a reconciliation without technical codes or routes', () => {
  expect(activityMessage(event)).toBe('Leudy Nolasco creó una conciliación de pagos');
  expect(activityArea(event.entity)).toBe('Conciliaciones de pagos');
});
it('never presents a failed or unknown operation as successful', () => {
  expect(activityMessage({ ...event, outcome: 'error' })).toBe(
    'Leudy Nolasco no pudo crear una conciliación de pagos',
  );
  expect(activityMessage({ ...event, outcome: 'unknown' })).not.toContain('creó');
  expect(
    activityMessage({ ...event, entity: 'unknown/resource', action: 'INTERNAL_ACTION' }),
  ).not.toMatch(/unknown|INTERNAL/);
});
it('distinguishes a completed simulation with a declined payment', () => {
  expect(activityMessage({ ...event, action: 'PAGAR_VIRTUAL_SIMULADO', outcome: 'rejected' })).toBe(
    'Leudy Nolasco simuló un pago rechazado por el canal virtual',
  );
});
describe('recent activity grouping', () => {
  it('combines repeated nearby actions and preserves the interval', () => {
    const grouped = groupRecentActivity([
      event,
      { ...event, id: '2', date: '2026-09-09T03:23:00Z' },
      { ...event, id: '3', date: '2026-09-09T03:21:00Z' },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      count: 3,
      firstDate: '2026-09-09T03:21:00Z',
      date: event.date,
    });
  });
  it('keeps different actors, results, and distant events separate', () => {
    expect(
      groupRecentActivity([
        event,
        { ...event, id: '2', outcome: 'error' },
        { ...event, id: '3', actorId: '20' },
        { ...event, id: '4', date: '2026-09-09T03:10:00Z' },
      ]),
    ).toHaveLength(4);
  });
});
