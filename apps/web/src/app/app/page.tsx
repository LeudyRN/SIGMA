import { ArrowUpRight, CheckCircle2, Clock3, Layers3, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { DatabaseSummary } from '@/components/app/database-summary';
import { allModules, moduleCatalog } from '@/lib/module-catalog';

const statusStyles = {
  available: { label: 'Disponible', className: 'bg-success/10 text-success' },
  foundation: { label: 'Base preparada', className: 'bg-primary-light text-primary' },
  planned: { label: 'Planificado', className: 'bg-warning/10 text-warning' },
} as const;

export default function AppOverviewPage() {
  const prepared = allModules.filter((module) => module.status !== 'planned').length;
  return (
    <div className="mx-auto max-w-[96rem]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-primary text-sm font-bold tracking-[0.14em] uppercase">
            Plan maestro de SIGMA
          </p>
          <h1 className="text-institutional mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Todos los módulos del sistema
          </h1>
          <p className="text-muted-foreground mt-3 max-w-3xl leading-7">
            Este panel hace visible el alcance completo acordado para UCOTESIS. Los apartados
            planificados pueden abrirse para consultar su objetivo mientras el equipo los
            implementa.
          </p>
        </div>
        <span className="bg-success/10 text-success inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold">
          <CheckCircle2 aria-hidden="true" className="size-4" /> Sesión conectada
        </span>
      </div>

      <DatabaseSummary />

      <div className="mt-10 mb-4">
        <p className="text-primary text-xs font-bold tracking-[0.14em] uppercase">Planificación</p>
        <h2 className="text-institutional mt-1 text-xl font-bold">Cobertura del proyecto</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Layers3}
          label="Módulos identificados"
          value={String(allModules.length)}
          detail="Cobertura del modelo SQL"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Bases disponibles"
          value={String(prepared)}
          detail="Resumen y autenticación"
        />
        <SummaryCard
          icon={Clock3}
          label="Áreas funcionales"
          value={String(moduleCatalog.length)}
          detail="Planificación visible"
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Perfiles previstos"
          value="5"
          detail="Roles institucionales"
        />
      </div>

      <div className="mt-10 space-y-10">
        {moduleCatalog.map((group) => (
          <section key={group.key} aria-labelledby={`group-${group.key}`}>
            <div className="mb-4">
              <h2 id={`group-${group.key}`} className="text-institutional text-xl font-bold">
                {group.label}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">{group.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {group.modules.map((module) => {
                const status = statusStyles[module.status];
                const href = module.slug === 'resumen' ? '/app' : `/app/${module.slug}`;
                return (
                  <Link
                    key={module.slug}
                    href={href}
                    className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-institutional group-hover:text-primary font-bold">
                        {module.label}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-3 text-sm leading-6">
                      {module.description}
                    </p>
                    <span className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-semibold">
                      Abrir ficha <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof Layers3;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="bg-primary-light text-primary grid size-10 place-items-center rounded-xl">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <span className="text-institutional text-3xl font-bold">{value}</span>
      </div>
      <p className="text-foreground mt-4 text-sm font-semibold">{label}</p>
      <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
    </article>
  );
}
