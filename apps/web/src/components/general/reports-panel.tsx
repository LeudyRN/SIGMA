'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowLeft,
  RefreshCw,
  FileBarChart,
  GraduationCap,
  Activity,
  Wallet,
} from 'lucide-react';
import { apiJson } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { humanizeSystemValue } from '@/lib/humanize-system-value';
import { activityModules } from '@/lib/dashboard-activity';
import {
  number,
  money,
  dayLabel,
  range,
  type Insights,
  type Breakdown,
} from '@/lib/dashboard-insights';
import { TrendChart } from './analytics-charts';
import { downloadUsageReport, type ReportTopic } from '@/lib/usage-report';

const TOPICS = [
  {
    id: 'enrollments',
    title: 'Inscripciones',
    description: 'Demanda y distribución',
    icon: GraduationCap,
  },
  {
    id: 'usage',
    title: 'Uso de la plataforma',
    description: 'Usuarios, sesiones y acciones',
    icon: Activity,
  },
  { id: 'payments', title: 'Pagos', description: 'Aprobaciones e importes', icon: Wallet },
] as const;

export function ReportsPanel() {
  const user = useAuthStore((s) => s.user);
  const [topic, setTopic] = useState<ReportTopic>('enrollments');
  const [period, setPeriod] = useState(() => range(30));
  const [preset, setPreset] = useState('30');
  const [draft, setDraft] = useState(period);
  const [distribution, setDistribution] = useState<
    'careers' | 'campuses' | 'teachingModes' | 'states'
  >('careers');
  const [metric, setMetric] = useState<'sessions' | 'events'>('sessions');
  const query = useQuery({
    queryKey: ['reports', 'insights', user?.id, period],
    queryFn: () => apiJson<Insights>(`/dashboard/report-insights?${new URLSearchParams(period)}`),
    enabled: !!user,
    staleTime: 30000,
  });
  const data = query.data;
  const selected = TOPICS.find((item) => item.id === topic)!;
  const difference = data ? data.kpis.enrollments - data.kpis.previousEnrollments : 0;
  const change =
    data && data.kpis.previousEnrollments > 0
      ? `${difference > 0 ? '+' : ''}${Math.round((difference / data.kpis.previousEnrollments) * 100)}%`
      : 'Sin base de comparación';
  return (
    <main className="min-w-0 space-y-6 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div>
          <Link
            href="/app"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-700"
          >
            <ArrowLeft className="size-3.5" /> Volver al resumen
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Reportes de uso real
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Elige qué analizar, delimita las fechas y descarga los resultados.
          </p>
        </div>
        <span className="rounded-lg border bg-white px-3 py-2 text-xs font-medium text-slate-600">
          {data?.scope ?? 'Consultando alcance…'}
        </span>
      </header>
      <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Tipo de reporte">
        {TOPICS.map(({ id, title, description, icon: Icon }) => (
          <button
            key={id}
            aria-pressed={topic === id}
            onClick={() => setTopic(id)}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${topic === id ? 'border-blue-700 bg-blue-50 ring-1 ring-blue-700' : 'bg-white hover:border-blue-300'}`}
          >
            <Icon
              className={`size-5 shrink-0 ${topic === id ? 'text-blue-700' : 'text-slate-400'}`}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">{title}</span>
              <span className="mt-1 block text-xs text-slate-500">{description}</span>
            </span>
          </button>
        ))}
      </div>
      <section aria-label="Fechas del reporte" className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-slate-600">
              Período
              <select
                aria-label="Período del reporte"
                value={preset}
                onChange={(e) => {
                  setPreset(e.target.value);
                  if (e.target.value !== 'custom') {
                    const next = range(Number(e.target.value));
                    setPeriod(next);
                    setDraft(next);
                  }
                }}
                className="ml-2 rounded-lg border bg-white px-3 py-2.5 text-sm"
              >
                <option value="7">Últimos 7 días</option>
                <option value="30">Últimos 30 días</option>
                <option value="90">Últimos 90 días</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>
            <span className="text-xs text-slate-500">
              {dayLabel(period.from)} — {dayLabel(period.to)} · {period.to.slice(0, 4)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              aria-label="Actualizar reporte"
              disabled={query.isFetching}
              onClick={() => query.refetch()}
            >
              <RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              disabled={!data || query.isFetching || query.isError}
              onClick={() => data && downloadUsageReport(data, topic)}
            >
              <ArrowDownToLine className="size-4" /> Exportar CSV
            </Button>
          </div>
        </div>
        {preset === 'custom' && (
          <form
            className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              setPeriod(draft);
            }}
          >
            <label className="text-xs font-semibold">
              Desde
              <input
                type="date"
                required
                value={draft.from}
                max={draft.to}
                onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                className="mt-1 block rounded-lg border p-2"
              />
            </label>
            <label className="text-xs font-semibold">
              Hasta
              <input
                type="date"
                required
                value={draft.to}
                min={draft.from}
                onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                className="mt-1 block rounded-lg border p-2"
              />
            </label>
            <Button>Aplicar período</Button>
            <p className="text-xs text-slate-500">Hasta 366 días · hora de Santo Domingo</p>
          </form>
        )}
      </section>
      {query.isPending && (
        <p role="status" className="rounded-xl border bg-white p-8">
          Preparando reporte…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-800">
          {query.error.message}
        </p>
      )}
      {data && !query.isError && (
        <article
          className="min-w-0 overflow-hidden rounded-2xl border bg-white"
          aria-label={`Reporte de ${selected.title}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5 sm:p-6">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-blue-700 uppercase">
                INFORME / {data.period.days} DÍAS
              </p>
              <h2 className="mt-2 text-xl font-semibold">{selected.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                Del {data.period.from} al {data.period.to} · {data.scope}
              </p>
            </div>
            <FileBarChart className="size-8 text-slate-300" />
          </div>
          {topic === 'enrollments' && (
            <>
              <div className="grid gap-6 border-b bg-slate-50/60 p-5 sm:grid-cols-3 sm:p-6">
                <ReportStat
                  label="Solicitudes recibidas"
                  value={number(data.kpis.enrollments)}
                  detail="Registradas dentro de las fechas elegidas"
                />
                <ReportStat
                  label="Período anterior"
                  value={number(data.kpis.previousEnrollments)}
                  detail={`Los ${data.period.days} días inmediatamente anteriores`}
                />
                <ReportStat
                  label="Variación de solicitudes"
                  value={change}
                  detail={`${difference > 0 ? '+' : ''}${number(difference)} solicitudes frente al período anterior`}
                />
              </div>
              <div className="grid min-w-0 gap-6 p-5 sm:p-6 lg:grid-cols-2">
                <section className="min-w-0">
                  <h3 className="text-sm font-semibold">Evolución de la demanda</h3>
                  <p className="mt-1 text-xs text-slate-500">Solicitudes recibidas por día</p>
                  <TrendChart items={data.series} metric="enrollments" />
                </section>
                <section className="min-w-0">
                  <label className="text-sm font-semibold">
                    Distribución por
                    <select
                      aria-label="Distribución de inscripciones"
                      value={distribution}
                      onChange={(e) => setDistribution(e.target.value as typeof distribution)}
                      className="ml-2 rounded-lg border px-2 py-2 text-xs"
                    >
                      <option value="careers">Carrera</option>
                      <option value="campuses">Recinto</option>
                      <option value="teachingModes">Modalidad</option>
                      <option value="states">Estado</option>
                    </select>
                  </label>
                  <p className="mt-2 mb-4 text-xs text-slate-500">
                    {distribution === 'states'
                      ? 'Estado actual de las solicitudes recibidas en estas fechas.'
                      : 'Participación sobre las solicitudes del período.'}
                  </p>
                  <DistributionTable
                    items={data[distribution].map((x) => ({
                      ...x,
                      label:
                        distribution === 'teachingModes' ? humanizeSystemValue(x.label) : x.label,
                    }))}
                    label="Categoría"
                  />
                </section>
              </div>
              <div className="border-t p-5 sm:p-6">
                <h3 className="mb-4 text-sm font-semibold">Detalle diario de solicitudes</h3>
                <DataTable
                  headers={['Fecha', 'Solicitudes recibidas']}
                  rows={data.series.map((x) => [x.date, number(x.enrollments)])}
                />
              </div>
            </>
          )}
          {topic === 'usage' && (
            <>
              <div className="grid gap-6 border-b bg-slate-50/60 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
                <ReportStat
                  label="Usuarios activos"
                  value={number(data.kpis.activeUsers)}
                  detail="Personas con sesión o acción registrada"
                />
                <ReportStat
                  label="Sesiones iniciadas"
                  value={number(data.kpis.sessions)}
                  detail="Inicios de sesión dentro del período"
                />
                <ReportStat
                  label="Acciones registradas"
                  value={number(data.kpis.events)}
                  detail="Eventos guardados en auditoría"
                />
                <ReportStat
                  label="Acciones con error"
                  value={number(data.kpis.errors)}
                  detail={`${data.kpis.events ? ((data.kpis.errors / data.kpis.events) * 100).toFixed(1) : '0'}% de los eventos auditados`}
                />
              </div>
              <div className="grid min-w-0 gap-6 p-5 sm:p-6 lg:grid-cols-2">
                <section className="min-w-0">
                  <label className="text-sm font-semibold">
                    Evolución diaria
                    <select
                      aria-label="Serie del reporte de uso"
                      value={metric}
                      onChange={(e) => setMetric(e.target.value as typeof metric)}
                      className="ml-2 rounded-lg border px-2 py-2 text-xs"
                    >
                      <option value="sessions">Sesiones</option>
                      <option value="events">Acciones</option>
                    </select>
                  </label>
                  <TrendChart items={data.series} metric={metric} />
                </section>
                <section className="min-w-0">
                  <h3 className="text-sm font-semibold">Uso por área</h3>
                  <p className="mt-2 mb-4 text-xs text-slate-500">
                    Acciones auditadas; no mide visitas a las pantallas.
                  </p>
                  <DistributionTable items={activityModules(data.modules)} label="Área" />
                </section>
              </div>
              <div className="border-t p-5 sm:p-6">
                <h3 className="mb-4 text-sm font-semibold">Detalle diario de uso</h3>
                <DataTable
                  headers={['Fecha', 'Sesiones iniciadas', 'Acciones registradas']}
                  rows={data.series.map((x) => [x.date, number(x.sessions), number(x.events)])}
                />
              </div>
            </>
          )}
          {topic === 'payments' && (
            <>
              <div className="grid gap-6 border-b bg-slate-50/60 p-5 sm:grid-cols-2 sm:p-6">
                <ReportStat
                  label="Pagos aprobados"
                  value={number(data.kpis.approvedPayments)}
                  detail="Aprobados dentro de las fechas elegidas"
                />
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Los importes de Caja y Virtual son pagos simulados. El histórico reúne los pagos
                  sin marca de simulación.
                </div>
              </div>
              <section className="p-5 sm:p-6">
                <h3 className="text-sm font-semibold">Importes aprobados por moneda y canal</h3>
                <p className="mt-2 mb-5 text-xs text-slate-500">
                  Se muestran por separado para conservar la moneda original y distinguir las
                  simulaciones.
                </p>
                <DataTable
                  headers={[
                    'Moneda',
                    'Caja · simulado',
                    'Virtual · simulado',
                    'Total simulado',
                    'Histórico aprobado',
                  ]}
                  rows={data.finances.map((x) => [
                    x.currency,
                    money(x.cash, x.currency),
                    money(x.virtual, x.currency),
                    money(x.cash + x.virtual, x.currency),
                    money(x.historical, x.currency),
                  ])}
                />
              </section>
            </>
          )}
          <footer className="border-t bg-slate-50/50 p-5 text-xs leading-6 text-slate-500 sm:px-6">
            <p>
              Generado el{' '}
              {new Date(data.generatedAt).toLocaleString('es-DO', {
                timeZone: 'America/Santo_Domingo',
              })}
              . El CSV corresponde al tema y período seleccionados.
            </p>
            <p>
              {topic === 'enrollments'
                ? 'Las fechas filtran la recepción de solicitudes. Sus estados reflejan la situación actual; no reconstruyen un cierre histórico.'
                : topic === 'usage'
                  ? 'Las sesiones y acciones se filtran por su fecha de registro. Un usuario se cuenta una sola vez en el período. No representa tiempo de conexión ni rendimiento del servidor.'
                  : 'Las fechas filtran la aprobación del pago. Los saldos pendientes actuales se consultan en el seguimiento de expedientes.'}
            </p>
          </footer>
        </article>
      )}
    </main>
  );
}

function ReportStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}
function DistributionTable({ items, label }: { items: Breakdown[]; label: string }) {
  const total = items.reduce((sum, item) => sum + item.total, 0);
  return (
    <DataTable
      headers={[label, 'Cantidad', 'Participación']}
      rows={items.map((item) => [
        item.label,
        number(item.total),
        `${total ? ((item.total / total) * 100).toFixed(1) : '0'}%`,
      ])}
    />
  );
}
function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div
      className="max-h-96 overflow-auto rounded-lg border"
      tabIndex={0}
      role="region"
      aria-label={`Tabla: ${headers.join(', ')}`}
    >
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-slate-50 text-slate-500">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50/60">
                {row.map((cell, col) => (
                  <td key={col} className="px-4 py-3 text-slate-700 tabular-nums">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="p-6 text-center text-slate-500">
                Sin registros en el período elegido.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
