import { MonographWorkspace } from '@/components/monograph/monograph-workspace';
import type { Metadata } from 'next';
import { ArrowLeft, Boxes, CheckCircle2, Clock3, Database, FileCode2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { allModules, findModuleBySlug } from '@/lib/module-catalog';
import { UsersPanel } from '@/components/identity/users-panel';
import { RolesPermissionsPanel } from '@/components/identity/roles-permissions-panel';
import { SessionsPanel } from '@/components/identity/sessions-panel';
import { AuditPanel } from '@/components/general/audit-panel';
import { ReportsPanel } from '@/components/general/reports-panel';
import { StudentsWorkspace } from '@/components/students/students-workspace';
import { AcademicStructurePanel } from '@/components/academic/academic-structure-panel';
import type { AcademicMode } from '@/components/academic/academic-structure-panel';
import { RoleAwareProcessPanel } from '@/components/app/role-aware-process-panel';
import { OperationsPanel, type OperationsMode } from '@/components/operations/operations-panel';

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
  if (
    !item ||
    ['resumen', 'configuraciones', 'estados-inscripcion', 'requisitos', 'modalidades'].includes(
      item.slug,
    )
  )
    notFound();

  if (item.slug === 'usuarios') return <UsersPanel />;
  if (item.slug === 'roles-permisos') return <RolesPermissionsPanel />;
  if (item.slug === 'sesiones') return <SessionsPanel />;
  if (item.slug === 'reportes') return <ReportsPanel />;
  if (item.slug === 'auditoria') return <AuditPanel />;
  if (item.slug === 'estudiantes') return <StudentsWorkspace mode="profiles" />;
  if (item.slug === 'estudiante-carreras') return <StudentsWorkspace mode="careers" />;
  if (item.slug === 'historial-academico') return <StudentsWorkspace mode="history" />;
  if (item.slug === 'elegibilidad') return <StudentsWorkspace mode="eligibility" />;
  const academicModes: Record<string, AcademicMode> = {
    recintos: 'campuses',
    facultades: 'faculties',
    escuelas: 'schools',
    carreras: 'careers',
    'recinto-carreras': 'campus-careers',
    'planes-estudio': 'study-plans',
    asignaturas: 'subjects',
  };
  const academicMode = academicModes[item.slug];
  if (academicMode) return <AcademicStructurePanel mode={academicMode} />;
  if (item.slug === 'ofertas') return <RoleAwareProcessPanel mode="offers" />;
  if (item.slug === 'inscripciones') return <RoleAwareProcessPanel mode="enrollments" />;
  if (item.slug === 'pagos') return <MonographWorkspace paymentsOnly />;
  if (item.slug === 'monograficos') return <MonographWorkspace />;
  if (item.slug === 'facturas') return <RoleAwareProcessPanel mode="invoices" />;
  const operationsModes = new Set<OperationsMode>([
    'modalidades',
    'periodos',
    'areas-investigacion',
    'requisitos',
    'sustentantes',
    'validaciones',
    'estados-inscripcion',
    'documentos',
    'cuentas-bancarias',
    'metodos-pago',
    'transacciones',
    'conciliaciones',
    'proyectos-grado',
    'docentes',
    'asesores-jurados',
    'configuraciones',
    'auditoria',
  ]);
  if (operationsModes.has(item.slug as OperationsMode)) {
    return <OperationsPanel mode={item.slug as OperationsMode} />;
  }

  const status = item.status === 'foundation' ? 'Base técnica preparada' : 'Planificado';
  return (
    <div className="w-full">
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
