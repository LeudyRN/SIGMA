import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  LockKeyhole,
  ReceiptText,
  Users,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const capabilities = [
  {
    icon: BookOpenCheck,
    title: 'Oferta académica clara',
    description: 'Consulta modalidades, requisitos, fechas y cupos por recinto y carrera.',
  },
  {
    icon: ClipboardCheck,
    title: 'Validación académica',
    description: 'Comprueba el cumplimiento del plan de estudios antes de iniciar el proceso.',
  },
  {
    icon: Users,
    title: 'Inscripción integrada',
    description: 'Registra sustentantes y da seguimiento a cada etapa desde un solo lugar.',
  },
  {
    icon: ReceiptText,
    title: 'Pagos y comprobantes',
    description: 'Gestiona pagos con trazabilidad y conserva la facturación digital.',
  },
] as const;

const steps = [
  ['01', 'Verifica tu elegibilidad', 'El sistema revisa tus requisitos académicos.'],
  ['02', 'Selecciona tu modalidad', 'Elige una oferta disponible de tesis o monográfico.'],
  [
    '03',
    'Completa tu inscripción',
    'Registra sustentantes, realiza el pago y recibe confirmación.',
  ],
] as const;

export default function Home() {
  return (
    <main className="bg-background min-h-screen overflow-hidden">
      <header className="bg-institutional relative z-20 border-b border-white/10 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <a
            href="#inicio"
            className="flex items-center gap-3 rounded-md"
            aria-label="SIGMA, inicio"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <GraduationCap aria-hidden="true" className="size-6" />
            </span>
            <span>
              <span className="block text-lg leading-none font-bold tracking-[0.18em]">SIGMA</span>
              <span className="mt-1 block text-[0.65rem] font-medium tracking-[0.12em] text-blue-100 uppercase">
                UCOTESIS
              </span>
            </span>
          </a>

          <nav
            className="hidden items-center gap-7 text-sm font-medium text-blue-100 md:flex"
            aria-label="Principal"
          >
            <a className="transition hover:text-white" href="#servicios">
              Servicios
            </a>
            <a className="transition hover:text-white" href="#proceso">
              Cómo funciona
            </a>
            <a className="transition hover:text-white" href="#seguridad">
              Seguridad
            </a>
          </nav>

          <a
            href="#acceso"
            className="text-institutional inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold transition hover:bg-blue-50"
          >
            Acceder <ChevronRight aria-hidden="true" className="size-4" />
          </a>
        </div>
      </header>

      <section id="inicio" className="bg-institutional relative text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-40 -right-32 size-[32rem] rounded-full border border-white/10" />
          <div className="absolute -top-20 -right-10 size-80 rounded-full border border-white/10" />
          <div className="absolute bottom-0 left-0 h-28 w-full bg-gradient-to-t from-black/10 to-transparent" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:px-12 lg:py-24">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-[0.14em] text-blue-100 uppercase">
              <Building2 aria-hidden="true" className="size-4" />
              UASD Recinto Santiago
            </div>
            <h1 className="max-w-3xl text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Sistema de Gestión e Inscripción Virtual de{' '}
              <span className="text-blue-200">Tesis y Monográficos</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg sm:leading-8">
              Un proceso de grado más claro, accesible y conectado. Consulta requisitos, valida tu
              condición académica y gestiona tu inscripción con UCOTESIS.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#servicios"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'text-institutional bg-white hover:bg-blue-50',
                )}
              >
                Conocer la plataforma <ArrowRight aria-hidden="true" className="size-4" />
              </a>
              <a
                href="#proceso"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'border-white/30 bg-white/5 text-white hover:bg-white/10',
                )}
              >
                Ver el proceso
              </a>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-blue-100">
              <BadgeCheck aria-hidden="true" className="size-4 text-emerald-300" />
              UCOTESIS - UASD Recinto Santiago
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
            <div
              className="absolute -inset-5 rounded-[2rem] bg-blue-400/10 blur-2xl"
              aria-hidden="true"
            />
            <div className="text-foreground relative overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl shadow-black/20">
              <div className="bg-surface flex items-center justify-between border-b px-5 py-4 sm:px-6">
                <div>
                  <p className="text-institutional text-sm font-semibold">
                    Resumen de elegibilidad
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Vista previa del proceso estudiantil
                  </p>
                </div>
                <span className="bg-primary-light text-primary rounded-full px-3 py-1 text-xs font-semibold">
                  En validación
                </span>
              </div>
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <span className="bg-primary-light text-primary grid size-12 place-items-center rounded-xl">
                    <FileCheck2 aria-hidden="true" className="size-6" />
                  </span>
                  <div>
                    <p className="font-semibold">Licenciatura en Informática</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Plan de estudios • Recinto Santiago
                    </p>
                  </div>
                </div>

                <div className="mt-7 space-y-4" aria-label="Estado de requisitos">
                  {[
                    'Identidad verificada',
                    'Plan de estudios completado',
                    'Sin asignaturas pendientes',
                  ].map((label) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-4 rounded-xl border bg-white px-4 py-3"
                    >
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-success grid size-7 shrink-0 place-items-center rounded-full bg-emerald-50">
                        <Check aria-hidden="true" className="size-4" />
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-institutional mt-6 rounded-xl p-4 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium tracking-wider text-blue-200 uppercase">
                        Resultado
                      </p>
                      <p className="mt-1 font-semibold">Elegible para continuar</p>
                    </div>
                    <CircleDollarSign aria-hidden="true" className="size-8 text-blue-200" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="servicios" className="bg-surface py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="text-primary text-sm font-bold tracking-[0.16em] uppercase">
              Una plataforma integrada
            </p>
            <h2 className="text-institutional mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Todo tu proceso de grado, en un solo lugar
            </h2>
            <p className="text-muted-foreground mt-4 leading-7">
              SIGMA reduce traslados y tareas repetidas al conectar información académica,
              inscripción y gestión administrativa.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(({ description, icon: Icon, title }) => (
              <article
                key={title}
                className="rounded-2xl border bg-white p-6 shadow-sm shadow-slate-200/50 transition hover:-translate-y-1 hover:shadow-md"
              >
                <span className="bg-primary-light text-primary grid size-11 place-items-center rounded-xl">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <h3 className="text-institutional mt-5 text-lg font-bold">{title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="proceso" className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div>
              <p className="text-primary text-sm font-bold tracking-[0.16em] uppercase">
                Proceso guiado
              </p>
              <h2 className="text-institutional mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Tres pasos para avanzar con claridad
              </h2>
              <p className="text-muted-foreground mt-4 leading-7">
                Cada etapa mantiene al estudiante informado y ofrece a UCOTESIS trazabilidad para
                gestionar excepciones y seguimiento.
              </p>
            </div>
            <ol className="space-y-4">
              {steps.map(([number, title, description]) => (
                <li
                  key={number}
                  className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border bg-white p-5 sm:gap-6 sm:p-6"
                >
                  <span className="bg-institutional grid size-11 place-items-center rounded-xl text-sm font-bold text-white">
                    {number}
                  </span>
                  <div>
                    <h3 className="text-institutional font-bold sm:text-lg">{title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-6 sm:text-base">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="seguridad" className="bg-primary-light/60 border-y">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 sm:flex-row sm:items-center sm:px-8 lg:px-12">
          <span className="text-primary grid size-12 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
            <LockKeyhole aria-hidden="true" className="size-6" />
          </span>
          <div className="flex-1">
            <h2 className="text-institutional text-xl font-bold">
              Seguridad y trazabilidad desde el inicio
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-6 sm:text-base">
              Control de acceso por roles, validación de datos, pagos idempotentes y registro de
              auditoría para proteger cada operación.
            </p>
          </div>
          <span className="text-success text-sm font-semibold">Base preparada</span>
        </div>
      </section>

      <section id="acceso" className="bg-institutional py-14 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-blue-200 uppercase">SIGMA</p>
            <h2 className="mt-2 max-w-2xl text-2xl font-bold sm:text-3xl">
              Una base digital para acompañar el proceso de grado
            </h2>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/5 px-5 py-4 text-sm text-blue-100">
            Versión inicial en preparación • UCOTESIS
          </div>
        </div>
      </section>

      <footer className="bg-[#071f3a] text-blue-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p className="font-semibold text-white">SIGMA • UCOTESIS</p>
          <p>Universidad Autónoma de Santo Domingo, Recinto Santiago</p>
        </div>
      </footer>
    </main>
  );
}
