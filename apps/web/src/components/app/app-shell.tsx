'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpenCheck,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  CircleUserRound,
  ClipboardList,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { allModules, canAccessModule, moduleCatalog } from '@/lib/module-catalog';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import type { AuthUser } from '@/store/auth-store';
import { NotificationCenter } from './notification-center';

const groupIcons = {
  general: LayoutDashboard,
  identidad: ShieldCheck,
  estudiantes: Users,
  academico: Building2,
  ucotesis: BookOpenCheck,
  inscripciones: ClipboardList,
  finanzas: CircleDollarSign,
  proyectos: GraduationCap,
  gobierno: Settings,
} as const;

async function loadCurrentUser(): Promise<AuthUser> {
  let response = await apiFetch('/auth/me');

  if (response.status === 401) {
    const refresh = await apiFetch('/auth/refresh', {
      method: 'POST',
    });

    if (refresh.ok) {
      response = await apiFetch('/auth/me');
    }
  }

  if (!response.ok) {
    throw new Error('No active session');
  }

  return response.json() as Promise<AuthUser>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const activeSlug = pathname === '/app' ? 'resumen' : pathname.split('/').at(-1);

  const activeModule = allModules.find((module) => module.slug === activeSlug);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const [expandedGroups, setExpandedGroups] = useState<string[]>(() =>
    activeModule?.groupKey ? [activeModule.groupKey] : ['general'],
  );

  const { setUser, user } = useAuthStore();

  const session = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: loadCurrentUser,
    retry: false,
    staleTime: 60_000,
  });

  const visibleGroups = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase('es');
    const allowedGroups = user
      ? moduleCatalog
          .map((group) => ({
            ...group,
            modules: group.modules.filter((module) => canAccessModule(module.slug, user)),
          }))
          .filter((group) => group.modules.length > 0)
      : [];

    if (!search) {
      return allowedGroups;
    }

    return allowedGroups
      .map((group) => ({
        ...group,
        modules: group.modules.filter((module) =>
          `${module.label} ${module.description}`.toLocaleLowerCase('es').includes(search),
        ),
      }))
      .filter((group) => group.modules.length > 0);
  }, [searchTerm, user]);

  useEffect(() => {
    if (session.data) {
      setUser(session.data);
    }
  }, [session.data, setUser]);

  useEffect(() => {
    if (session.isError) {
      setUser(null);
      queryClient.clear();
      router.replace('/login');
    }
  }, [queryClient, router, session.isError, setUser]);

  async function logout(): Promise<void> {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      await queryClient.cancelQueries();
      queryClient.clear();
      setUser(null);
      router.replace('/login');
      router.refresh();
    }
  }

  function toggleGroup(groupKey: string): void {
    setExpandedGroups((current) =>
      current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey],
    );
  }

  if (session.isError) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
        <p className="font-semibold text-slate-900">Redirigiendo al inicio de sesión...</p>
      </main>
    );
  }

  if (session.isPending || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
        <div className="text-center">
          <LoaderCircle aria-hidden="true" className="mx-auto size-8 animate-spin text-blue-600" />

          <p className="mt-4 text-sm font-semibold text-slate-900">Validando tu sesión...</p>
        </div>
      </main>
    );
  }

  const activeModuleAllowed = !activeModule || canAccessModule(activeModule.slug, user);
  const workspaceLabel = getWorkspaceLabel(user);

  return (
    <div className="min-h-screen bg-[#F5F7FB] lg:grid lg:grid-cols-[21rem_minmax(0,1fr)]">
      {/* MOBILE OVERLAY */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* =========================================================
          SIDEBAR
      ========================================================= */}
      <aside
        className={cn(
          `fixed inset-y-0 left-0 z-50 flex w-[21rem] -translate-x-full flex-col overflow-hidden bg-[#123A5A] text-white shadow-[16px_0_40px_rgba(15,23,42,0.12)] transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none`,
          mobileMenuOpen && 'translate-x-0',
        )}
      >
        {/* =====================================================
            BRAND
        ===================================================== */}
        <div className="flex h-[88px] shrink-0 items-center justify-between px-5">
          <Link
            href="/app"
            onClick={() => setMobileMenuOpen(false)}
            className="group flex items-center gap-3.5"
          >
            <span className="grid size-11 place-items-center rounded-[14px] bg-white/[0.10] shadow-[0_6px_18px_rgba(0,0,0,0.08)] transition group-hover:bg-white/[0.14]">
              <GraduationCap aria-hidden="true" className="size-[22px] text-white" />
            </span>

            <span>
              <span className="block text-[17px] leading-none font-extrabold tracking-[0.18em] text-white">
                SIGMA
              </span>

              <span className="mt-1.5 block text-[10px] font-semibold tracking-[0.14em] text-white uppercase">
                {workspaceLabel}
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Cerrar menú"
            className="grid size-9 place-items-center rounded-xl text-white transition hover:bg-white/[0.10] lg:hidden"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {/* =====================================================
            SEARCH
        ===================================================== */}
        <div className="shrink-0 px-4 pt-2 pb-3">
          <label
            htmlFor="module-search"
            className="mb-2.5 block px-1 text-[10px] font-bold tracking-[0.14em] text-white uppercase"
          >
            Buscar en SIGMA
          </label>

          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-slate-400"
            />

            <input
              id="module-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar módulo..."
              className="h-11 w-full rounded-xl border-0 bg-white pr-4 pl-11 text-[13px] font-medium text-slate-900 shadow-[0_6px_20px_rgba(7,24,41,0.15)] transition-all outline-none placeholder:font-normal placeholder:text-slate-400 hover:bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-300/20"
            />
          </div>
        </div>

        {/* =====================================================
            NAVIGATION
        ===================================================== */}
        <nav
          aria-label="Módulos de SIGMA"
          className="mt-1 flex-1 [scrollbar-width:none] overflow-y-auto px-3 pb-6 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {visibleGroups.length === 0 && (
            <div className="mx-1 mt-4 rounded-2xl bg-white/[0.06] px-4 py-8 text-center">
              <Search aria-hidden="true" className="mx-auto size-6 text-white/50" />

              <p className="mt-3 text-[13px] leading-5 text-white">
                No encontramos módulos con ese nombre.
              </p>
            </div>
          )}

          <div className="space-y-1">
            {visibleGroups.map((group) => {
              const Icon = groupIcons[group.key as keyof typeof groupIcons] ?? FileBarChart;

              const expanded = searchTerm.length > 0 || expandedGroups.includes(group.key);

              const groupContainsActive = group.modules.some(
                (module) => module.slug === activeSlug,
              );

              return (
                <section key={group.key} className="overflow-hidden rounded-xl">
                  {/* GROUP */}
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`menu-group-${group.key}`}
                    onClick={() => toggleGroup(group.key)}
                    className={cn(
                      `group relative flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 hover:bg-white/[0.08]`,
                      groupContainsActive && `bg-white/[0.06]`,
                    )}
                  >
                    <span
                      className={cn(
                        `grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-white transition-all group-hover:bg-white/[0.12]`,
                        groupContainsActive && `bg-white/[0.12] text-white`,
                      )}
                    >
                      <Icon aria-hidden="true" className="size-[17px]" />
                    </span>

                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">
                      {group.label}
                    </span>

                    <span className="flex min-w-7 justify-center rounded-full bg-white/[0.09] px-2 py-[3px] text-[10px] font-bold text-white">
                      {group.modules.length}
                    </span>

                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        `size-[15px] shrink-0 text-white transition-transform duration-200`,
                        expanded && 'rotate-180',
                      )}
                    />
                  </button>

                  {/* SUBMODULES */}
                  {expanded && (
                    <div
                      id={`menu-group-${group.key}`}
                      className="mt-1 space-y-1 pr-1 pb-2 pl-[3.65rem]"
                    >
                      {group.modules.map((module) => {
                        const href = module.slug === 'resumen' ? '/app' : `/app/${module.slug}`;

                        const active = pathname === href;

                        return (
                          <Link
                            key={module.slug}
                            href={href}
                            onClick={() => setMobileMenuOpen(false)}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              `group/item flex min-h-[40px] items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] leading-5 font-medium text-white transition-all duration-150 hover:bg-white/[0.09]`,
                              active &&
                                `bg-white/[0.16] font-semibold text-white shadow-[0_4px_14px_rgba(5,19,32,0.12)]`,
                            )}
                          >
                            <span className="min-w-0 flex-1">{getModuleLabel(module, user)}</span>

                            <ChevronRight
                              aria-hidden="true"
                              className={cn(
                                `group-hover/item: size-3.5 shrink-0 translate-x-0.5 text-white/75 transition-all`,
                                active && 'translate-x-0.5 text-white',
                              )}
                            />
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </nav>

        {/* =====================================================
            USER PROFILE
        ===================================================== */}
        <div className="shrink-0 bg-[#103551] p-3.5">
          <div className="rounded-2xl bg-white/[0.07] p-3.5 shadow-[0_8px_24px_rgba(3,17,29,0.10)]">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.12] text-[12px] font-bold text-white">
                <CircleUserRound aria-hidden="true" className="size-6" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white">{user.name}</p>

                <p className="mt-0.5 truncate text-[11px] font-medium text-white">
                  {user.employeeCode
                    ? `Empleado ${user.employeeCode}`
                    : user.matricula
                      ? `Matrícula ${user.matricula}`
                      : 'Cuenta institucional'}
                </p>

                <p className="mt-0.5 truncate text-[10.5px] font-medium text-white">
                  {user.roles.map((role) => role.name).join(', ')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="mt-3.5 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.11] text-[12px] font-bold text-white shadow-sm transition-all hover:bg-white/[0.17] hover:shadow-md"
            >
              <LogOut aria-hidden="true" className="size-[15px] text-white" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* =========================================================
          PAGE AREA
      ========================================================= */}
      <div className="min-w-0">
        {/* TOPBAR */}
        <header className="sticky top-0 z-30 flex h-[74px] items-center gap-3 bg-white/95 px-4 shadow-[0_1px_0_rgba(148,163,184,0.18)] backdrop-blur sm:px-6 lg:px-8 xl:px-10">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 lg:hidden"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>

          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.16em] text-blue-600 uppercase">SIGMA</p>

            <p className="mt-0.5 truncate text-[16px] font-semibold text-slate-900">
              {activeModule ? getModuleLabel(activeModule, user) : workspaceLabel}
            </p>
          </div>

          <NotificationCenter />
        </header>

        {/* PAGE CONTENT */}
        <main className="min-h-[calc(100vh-74px)] bg-[#F5F7FB] px-4 py-7 sm:px-6 sm:py-8 lg:px-8 xl:px-10 xl:py-9">
          <div className="mx-auto w-full max-w-[1540px]">
            {activeModuleAllowed ? (
              children
            ) : (
              <section className="rounded-3xl border bg-white p-10 text-center shadow-sm">
                <ShieldCheck className="mx-auto size-10 text-slate-400" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-bold text-slate-950">Acceso no autorizado</h1>
                <p className="mt-2 text-slate-600">
                  Tu rol no tiene permisos para consultar este módulo.
                </p>
                <Link href="/app" className="mt-5 inline-flex font-bold text-blue-700">
                  Volver al resumen
                </Link>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function getWorkspaceLabel(user: AuthUser): string {
  const codes = new Set(user.roles.map((role) => role.code));
  if (codes.has('ESTUDIANTE')) return 'Portal estudiantil';
  if (codes.has('DOCENTE')) return 'Portal docente';
  if (codes.has('TESORERIA')) return 'Panel de tesorería';
  if (codes.has('COORDINADOR')) return 'Panel UCOTESIS';
  return 'Administración';
}

function getModuleLabel(module: { slug: string; label: string }, user: AuthUser): string {
  if (!user.roles.some((role) => role.code === 'ESTUDIANTE')) return module.label;
  const studentLabels: Record<string, string> = {
    estudiantes: 'Mi perfil',
    'estudiante-carreras': 'Mis carreras',
    'historial-academico': 'Mi historial académico',
    elegibilidad: 'Mi elegibilidad',
    ofertas: 'Oferta disponible',
    inscripciones: 'Mi inscripción',
    documentos: 'Mis documentos',
    pagos: 'Mis pagos',
    facturas: 'Mis facturas',
    'proyectos-grado': 'Mi proyecto de grado',
    'asesores-jurados': 'Mis asesores y jurados',
  };
  return studentLabels[module.slug] ?? module.label;
}
