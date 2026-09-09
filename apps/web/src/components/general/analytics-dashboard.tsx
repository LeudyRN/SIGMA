'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, RefreshCw, ChevronRight, Clock3 } from 'lucide-react';
import { activityMessage, activityDate, groupRecentActivity } from '@/lib/dashboard-activity';
import { number, range, type Insights } from '@/lib/dashboard-insights';
import { apiJson } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { canAccessModule } from '@/lib/module-catalog';
import { Button } from '@/components/ui/button';
import { TrendChart, Empty } from './analytics-charts';

export function AnalyticsDashboard() {
  const user = useAuthStore((s) => s.user);
  const [period] = useState(() => range(7));
  const query = useQuery({
    queryKey: ['dashboard', 'insights', user?.id, period],
    queryFn: () => apiJson<Insights>(`/dashboard/insights?${new URLSearchParams(period)}`),
    enabled: !!user,
    staleTime: 30000,
  });
  const access = (slug: string) => !!user && canAccessModule(slug, user);
  const data = query.data;
  return (
    <main className="min-w-0 space-y-6 pb-6">
      <header className="rounded-3xl bg-[#102c46] p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-[11px] font-bold tracking-[0.22em] text-sky-300 uppercase">
              SIGMA / TU JORNADA
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Resumen general</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Lo que necesita atención y los próximos pasos de UCOTESIS.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            disabled={query.isFetching}
            onClick={() => query.refetch()}
            aria-label="Actualizar resumen"
          >
            <RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-5">
          <p className="text-sm text-sky-100">
            {data?.scope ?? 'Tu espacio de trabajo'} ·{' '}
            {data
              ? `Actualizado a las ${new Date(data.generatedAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santo_Domingo' })}`
              : 'Consultando datos…'}
          </p>
          {access('reportes') && (
            <Link
              href="/app/reportes"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white underline-offset-4 hover:underline"
            >
              Analizar resultados <ArrowUpRight className="size-4" />
            </Link>
          )}
        </div>
      </header>
      {query.isPending && (
        <p role="status" className="rounded-2xl border bg-white p-8">
          Cargando tu resumen…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="rounded-2xl bg-red-50 p-5 text-red-800">
          {query.error.message}
        </p>
      )}
      {data && (
        <>
          <section aria-labelledby="pending-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 id="pending-heading" className="flex items-center gap-2 font-bold">
                <Clock3 className="size-4 text-amber-600" /> Pendientes actuales
              </h2>
              <span className="text-sm text-slate-500">
                {number(data.pending.total)} expedientes por completar
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: 'Por recibir',
                  count: data.pending.intake,
                  detail: 'Recibir la solicitud y sus documentos.',
                },
                {
                  label: 'Por validar',
                  count: data.pending.validation,
                  detail: 'Revisar el expediente en Secretaría.',
                },
                {
                  label: 'Por abrir deuda',
                  count: data.pending.debt,
                  detail: 'Habilitar el pago tras la validación.',
                },
                {
                  label: 'Por pagar',
                  count: data.pending.payment,
                  detail: 'Completar el pago de la inscripción.',
                },
              ].map((step, i) => (
                <article key={step.label} className="rounded-2xl border bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-600">{step.label}</h3>
                    <span className="grid size-6 place-items-center rounded-full bg-sky-50 text-xs font-bold text-sky-700">
                      {i + 1}
                    </span>
                  </div>
                  <p className="mt-3 text-4xl font-semibold text-slate-900 tabular-nums">
                    {number(step.count)}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{step.detail}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Prioridad de atención</h2>
              <span className="text-xs text-slate-500">Los expedientes más antiguos primero</span>
            </div>
            {data.pending.items.length ? (
              <div className="mt-4 divide-y">
                {data.pending.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{item.offer}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.code} · solicitado {new Date(item.since).toLocaleDateString('es-DO')}
                      </p>
                    </div>
                    <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                      {item.step}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="No hay expedientes pendientes de atención." />
            )}
          </section>
          <nav aria-label="Accesos de trabajo" className="flex flex-wrap gap-3">
            {[
              ['ofertas', 'Ofertas de cursos'],
              ['monograficos', 'Gestión de monográficos'],
              ['documentos', 'Documentos'],
              ['pagos', 'Deudas y pagos'],
              ['estudiantes', 'Expedientes estudiantiles'],
            ]
              .filter(([slug]) => access(slug))
              .map(([slug, label]) => (
                <Link
                  key={slug}
                  href={`/app/${slug}`}
                  className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-blue-300"
                >
                  {label}
                  <ArrowUpRight className="size-3.5 text-blue-600" />
                </Link>
              ))}
          </nav>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
            <section className="min-w-0 rounded-2xl border bg-white p-5 sm:p-6">
              <h2 className="font-bold">Nuevas solicitudes esta semana</h2>
              <p className="mt-1 text-xs text-slate-500">Últimos 7 días, incluido hoy</p>
              <TrendChart items={data.series} metric="enrollments" />
            </section>
            <section className="rounded-2xl border bg-sky-50/60 p-5 sm:p-6">
              <h2 className="font-bold">Continúa tu trabajo</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Abre el seguimiento para consultar cada expediente y completar el paso que te
                corresponde.
              </p>
              {access('monograficos') && (
                <Link
                  href="/app/monograficos"
                  className="mt-5 flex items-center justify-between rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white"
                >
                  Abrir seguimiento <ChevronRight className="size-4" />
                </Link>
              )}
              <p className="mt-6 text-xs leading-5 text-slate-500">
                Los pendientes muestran el estado actual de los expedientes a los que tienes acceso.
                El gráfico y la actividad reciente abarcan los últimos 7 días.
              </p>
            </section>
          </div>
          <section className="rounded-2xl border bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">Actividad reciente</h2>
              {access('auditoria') && (
                <Link href="/app/auditoria" className="text-xs font-semibold text-blue-700">
                  Consultar auditoría →
                </Link>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Últimos 7 días. Las acciones consecutivas iguales de una misma persona se agrupan
              durante un máximo de 5 minutos. El detalle completo permanece en auditoría.
            </p>
            {data.activity.length ? (
              <ol className="mt-5 grid gap-x-8 gap-y-4 lg:grid-cols-2">
                {groupRecentActivity(data.activity).map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${event.outcome === 'error' || event.outcome === 'rejected' ? 'bg-amber-500' : event.outcome === 'success' ? 'bg-teal-500' : 'bg-slate-400'}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{activityMessage(event)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        <time dateTime={event.date}>{activityDate(event.date)}</time>
                        {event.count > 1 && (
                          <>
                            {' '}
                            · {event.count} {event.outcome === 'error' ? 'intentos' : 'registros'}{' '}
                            entre{' '}
                            {new Date(event.firstDate).toLocaleTimeString('es-DO', {
                              hour: 'numeric',
                              minute: '2-digit',
                              timeZone: 'America/Santo_Domingo',
                            })}{' '}
                            y{' '}
                            {new Date(event.date).toLocaleTimeString('es-DO', {
                              hour: 'numeric',
                              minute: '2-digit',
                              timeZone: 'America/Santo_Domingo',
                            })}
                          </>
                        )}
                      </p>
                      <span
                        className={`mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${event.outcome === 'error' || event.outcome === 'rejected' ? 'bg-amber-50 text-amber-800' : event.outcome === 'success' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {event.outcome === 'error'
                          ? 'No se completó'
                          : event.outcome === 'rejected'
                            ? 'Pago simulado rechazado'
                            : event.outcome === 'success'
                              ? 'Completado'
                              : 'Resultado no registrado'}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty text="No hay actividad registrada en los últimos 7 días." />
            )}
          </section>
        </>
      )}
    </main>
  );
}
