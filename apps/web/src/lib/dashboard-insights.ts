import type { DashboardActivity } from './dashboard-activity';
export interface Breakdown {
  label: string;
  total: number;
}
export interface Series {
  date: string;
  enrollments: number;
  sessions: number;
  events: number;
}
export interface Insights {
  generatedAt: string;
  period: { from: string; to: string; days: number };
  scope: string;
  kpis: {
    enrollments: number;
    previousEnrollments: number;
    activeUsers: number;
    sessions: number;
    events: number;
    errors: number;
    approvedPayments: number;
  };
  series: Series[];
  states: Breakdown[];
  careers: Breakdown[];
  campuses: Breakdown[];
  teachingModes: Breakdown[];
  modules: Breakdown[];
  finances: {
    currency: string;
    cash: number;
    virtual: number;
    historical: number;
    pending: number;
  }[];
  pending: {
    total: number;
    intake: number;
    validation: number;
    debt: number;
    payment: number;
    items: { id: string; code: string; offer: string; since: string; step: string }[];
  };
  activity: DashboardActivity[];
  methodology: string;
}
export const number = (value: number) => new Intl.NumberFormat('es-DO').format(value);
export const money = (value: number, currency: string) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(
    value,
  );
const localDay = (d: Date) => new Date(d.getTime() - 4 * 3600000).toISOString().slice(0, 10);
export const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00-04:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' });
export function range(days: number) {
  const now = new Date();
  return { from: localDay(new Date(now.getTime() - (days - 1) * 86400000)), to: localDay(now) };
}
