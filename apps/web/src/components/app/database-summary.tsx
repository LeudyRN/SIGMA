'use client';

import { useQuery } from '@tanstack/react-query';
import { BadgeDollarSign, BookOpenCheck, KeyRound, ShieldCheck, UserCheck } from 'lucide-react';
import { apiFetch, readApiError } from '@/lib/api';

interface DashboardSummary {
  audience: string;
  generatedAt: string;
  metrics: Array<{ label: string; value: number; detail: string }>;
}

async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await apiFetch('/dashboard/summary');
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<DashboardSummary>;
}

export function DatabaseSummary() {
  const summary = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: getDashboardSummary,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (summary.isPending) {
    return (
      <section className="mt-8" aria-label="Cargando resumen operativo">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border bg-white" />
          ))}
        </div>
      </section>
    );
  }

  if (summary.isError) {
    return (
      <div
        role="alert"
        className="border-error/20 bg-error/5 text-error mt-8 rounded-2xl border p-5"
      >
        <p className="font-semibold">No fue posible consultar el resumen operativo.</p>
        <p className="mt-1 text-sm">{summary.error.message}</p>
      </div>
    );
  }

  const icons = [UserCheck, ShieldCheck, BookOpenCheck, BadgeDollarSign] as const;
  const cards = summary.data.metrics.map((metric, index) => ({
    ...metric,
    icon: icons[index % icons.length],
  }));

  return (
    <section className="mt-8" aria-labelledby="database-summary-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-primary text-xs font-bold tracking-[0.14em] uppercase">
            Datos operativos
          </p>
          <h2 id="database-summary-title" className="text-institutional mt-1 text-xl font-bold">
            Resumen operativo
          </h2>
        </div>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <KeyRound aria-hidden="true" className="size-3.5" /> Actualización automática
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ detail, icon: Icon, label, value }) => (
          <article key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="bg-primary-light text-primary grid size-10 place-items-center rounded-xl">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="text-institutional text-3xl font-bold tabular-nums">{value}</span>
            </div>
            <p className="text-foreground mt-4 text-sm font-semibold">{label}</p>
            <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
