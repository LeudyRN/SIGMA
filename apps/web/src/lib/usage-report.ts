import type { Insights } from './dashboard-insights';
import { activityModules } from './dashboard-activity';
import { humanizeSystemValue } from './humanize-system-value';

export type ReportTopic = 'enrollments' | 'usage' | 'payments';
const TITLES: Record<ReportTopic, string> = {
  enrollments: 'Inscripciones',
  usage: 'Uso de la plataforma',
  payments: 'Pagos',
};
export function usageReportCsv(data: Insights, topic: ReportTopic) {
  const rows: (string | number)[][] = [
    ['Reporte UCOTESIS', TITLES[topic]],
    ['Alcance', data.scope],
    ['Desde', data.period.from, 'Hasta', data.period.to],
    ['Generado', data.generatedAt],
    [],
  ];
  if (topic === 'enrollments') {
    rows.push(
      ['Solicitudes recibidas', data.kpis.enrollments],
      ['Solicitudes en el período anterior', data.kpis.previousEnrollments],
      ['Días en cada período', data.period.days],
      [],
      ['Fecha', 'Solicitudes recibidas'],
      ...data.series.map((x) => [x.date, x.enrollments]),
    );
    for (const [title, items] of [
      ['Carrera', data.careers],
      ['Recinto', data.campuses],
      ['Modalidad', data.teachingModes.map((x) => ({ ...x, label: humanizeSystemValue(x.label) }))],
      ['Estado actual', data.states],
    ] as const) {
      rows.push([], [title, 'Solicitudes'], ...items.map((x) => [x.label, x.total]));
    }
    rows.push(
      [],
      [
        'Criterio',
        'Solicitudes recibidas en las fechas elegidas. Los estados reflejan la situación actual, no un cierre histórico.',
      ],
    );
  } else if (topic === 'usage') {
    rows.push(
      ['Usuarios activos únicos', data.kpis.activeUsers],
      ['Sesiones iniciadas', data.kpis.sessions],
      ['Acciones registradas', data.kpis.events],
      ['Acciones con error', data.kpis.errors],
      [],
      ['Fecha', 'Sesiones iniciadas', 'Acciones registradas'],
      ...data.series.map((x) => [x.date, x.sessions, x.events]),
      [],
      ['Área', 'Acciones registradas'],
      ...activityModules(data.modules).map((x) => [x.label, x.total]),
      [],
      [
        'Criterio',
        'Actividad registrada en el período. No mide visitas, tiempo de conexión ni rendimiento del servidor.',
      ],
    );
  } else {
    rows.push(
      ['Pagos aprobados', data.kpis.approvedPayments],
      [],
      ['Moneda', 'Caja simulada', 'Virtual simulado', 'Total simulado', 'Histórico aprobado'],
      ...data.finances.map((x) => [
        x.currency,
        x.cash,
        x.virtual,
        x.cash + x.virtual,
        x.historical,
      ]),
      [],
      [
        'Criterio',
        'Pagos aprobados en el período. Caja y Virtual son simulaciones. El histórico no tiene marca de simulación.',
      ],
    );
  }
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""')}"`,
          )
          .join(','),
      )
      .join('\r\n')
  );
}
export function downloadUsageReport(data: Insights, topic: ReportTopic) {
  const url = URL.createObjectURL(
    new Blob([usageReportCsv(data, topic)], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `ucotesis-${topic}-${data.period.from}-${data.period.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
