'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, BookOpenCheck, Database, LogIn, ReceiptText, UsersRound } from 'lucide-react';
import { apiFetch, readApiError } from '@/lib/api';

interface BreakdownItem {
  label: string;
  total: number;
}

interface ReportsData {
  generatedAt: string;
  period: { from: string; to: string; days: number };
  actualUsage: {
    logins: number;
    activeSessions: number;
    students: number;
    enrollments: number;
    approvedPayments: number;
    publishedOffers: number;
  };
  enrollments: {
    byCampus: BreakdownItem[];
    byCareer: BreakdownItem[];
    byModality: BreakdownItem[];
    byTeachingMode: BreakdownItem[];
    byArea: BreakdownItem[];
  };
  apiDbConsumption: {
    totalOperations: number;
    source: string;
    items: Array<{ entity: string; action: string; operations: number }>;
  };
}

async function loadReports(): Promise<ReportsData> {
  const response = await apiFetch('/dashboard/reports');
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<ReportsData>;
}

export function ReportsPanel() {
  const report = useQuery({
    queryKey: ['dashboard', 'reports'],
    queryFn: loadReports,
    staleTime: 30_000,
  });

  if (report.isPending) {
    return (
      <p className="rounded-3xl border bg-white p-10 text-center">Cargando reportes reales…</p>
    );
  }
  if (report.isError) {
    return (
      <p role="alert" className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
        {report.error.message}
      </p>
    );
  }

  const usage = report.data.actualUsage;
  const cards = [
    { label: 'Accesos (30 días)', value: usage.logins, icon: LogIn },
    { label: 'Sesiones activas', value: usage.activeSessions, icon: Activity },
    { label: 'Estudiantes', value: usage.students, icon: UsersRound },
    { label: 'Inscripciones', value: usage.enrollments, icon: BookOpenCheck },
    { label: 'Pagos aprobados', value: usage.approvedPayments, icon: ReceiptText },
    { label: 'Ofertas publicadas', value: usage.publishedOffers, icon: Database },
  ];

  return (
    <section className="w-full space-y-4 sm:space-y-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-bold tracking-widest text-blue-700 uppercase">General</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Reportes de uso real</h1>
        <p className="mt-2 text-slate-600">
          Información calculada directamente desde la base de datos; no contiene cifras simuladas.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ icon: Icon, label, value }) => (
          <article key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <strong className="text-3xl text-slate-950 tabular-nums">{value}</strong>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-700">{label}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Breakdown title="Inscripciones por recinto" items={report.data.enrollments.byCampus} />
        <Breakdown title="Inscripciones por carrera" items={report.data.enrollments.byCareer} />
        <Breakdown
          title="Inscripciones por tipo de trabajo"
          items={report.data.enrollments.byModality}
        />
        <Breakdown
          title="Inscripciones por modalidad"
          items={report.data.enrollments.byTeachingMode ?? []}
        />
        <Breakdown title="Inscripciones por área" items={report.data.enrollments.byArea} />
      </div>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-widest text-blue-700 uppercase">API / DB</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Consumo registrado</h2>
          </div>
          <strong className="text-2xl tabular-nums">
            {report.data.apiDbConsumption.totalOperations}
          </strong>
        </div>
        {report.data.apiDbConsumption.items.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
            Aún no existen operaciones registradas en auditoría para el período.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="p-3">Entidad</th>
                  <th className="p-3">Acción</th>
                  <th className="p-3 text-right">Operaciones</th>
                </tr>
              </thead>
              <tbody>
                {report.data.apiDbConsumption.items.map((item) => (
                  <tr key={`${item.entity}-${item.action}`} className="border-t">
                    <td className="p-3 font-semibold">{item.entity}</td>
                    <td className="p-3 text-slate-600">{item.action}</td>
                    <td className="p-3 text-right font-bold tabular-nums">{item.operations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

function Breakdown({ title, items }: { title: string; items: BreakdownItem[] }) {
  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-950">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Sin inscripciones registradas.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"
            >
              <span className="text-sm font-medium text-slate-700">{item.label}</span>
              <strong className="tabular-nums">{item.total}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
