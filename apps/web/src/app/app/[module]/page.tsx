import type { Metadata } from 'next';
import { ArrowLeft, Boxes, CheckCircle2, Clock3, Database, FileCode2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { allModules, findModuleBySlug } from '@/lib/module-catalog';

interface ModulePageProps {
  params: Promise<{ module: string }>;
}

export function generateStaticParams() {
  return allModules
    .filter((module) => module.slug !== 'resumen')
    .map((module) => ({ module: module.slug }));
}

export async function generateMetadata({ params }: ModulePageProps): Promise<Metadata> {
  const item = findModuleBySlug((await params).module);
  if (!item) return {};
  const description = `${item.description} Módulo planificado para SIGMA UCOTESIS.`;
  return {
    title: item.label,
    description,
    openGraph: { title: `${item.label} | SIGMA`, description, images: [] },
    twitter: { title: `${item.label} | SIGMA`, description, images: [] },
  };
}

export default async function ModulePlanningPage({ params }: ModulePageProps) {
  const item = findModuleBySlug((await params).module);
  if (!item || item.slug === 'resumen') notFound();

  const status = item.status === 'foundation' ? 'Base técnica preparada' : 'Planificado';
  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/app"
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Volver a todos los módulos
      </Link>
      <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm sm:p-8 lg:p-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-primary text-sm font-bold tracking-[0.14em] uppercase">
              {item.groupLabel}
            </p>
            <h1 className="text-institutional mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {item.label}
            </h1>
            <p className="text-muted-foreground mt-4 max-w-3xl text-lg leading-8">
              {item.description}
            </p>
          </div>
          <span className="bg-warning/10 text-warning inline-flex shrink-0 items-center gap-2 self-start rounded-full px-3 py-2 text-xs font-bold">
            <Clock3 aria-hidden="true" className="size-4" />
            {status}
          </span>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <PlanningCard
            icon={Boxes}
            title="Alcance funcional"
            text="Interfaz, reglas y operaciones del módulo documentadas antes de desarrollar."
          />
          <PlanningCard
            icon={Database}
            title="Persistencia"
            text="Alineado con las entidades y relaciones existentes en el modelo MySQL de SIGMA."
          />
          <PlanningCard
            icon={FileCode2}
            title="Integración"
            text="API NestJS tipada y consumo desde Next.js con permisos según el rol."
          />
        </div>

        <section className="bg-surface mt-10 rounded-2xl border p-6">
          <h2 className="text-institutional text-lg font-bold">Criterios para implementación</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              'Validar entradas y reglas del dominio.',
              'Aplicar autorización por roles.',
              'Mantener auditoría de operaciones sensibles.',
              'Diseñar vista responsive y accesible.',
              'Agregar pruebas unitarias y de integración.',
              'Actualizar documentación y contratos OpenAPI.',
            ].map((criterion) => (
              <li key={criterion} className="flex items-start gap-3 text-sm leading-6">
                <CheckCircle2 aria-hidden="true" className="text-success mt-0.5 size-4 shrink-0" />
                {criterion}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function PlanningCard({
  icon: Icon,
  text,
  title,
}: {
  icon: typeof Boxes;
  text: string;
  title: string;
}) {
  return (
    <article className="rounded-2xl border p-5">
      <span className="bg-primary-light text-primary grid size-10 place-items-center rounded-xl">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="text-institutional mt-4 font-bold">{title}</h2>
      <p className="text-muted-foreground mt-2 text-sm leading-6">{text}</p>
    </article>
  );
}
