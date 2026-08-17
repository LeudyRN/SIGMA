'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BookOpenCheck,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
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
import { allModules, moduleCatalog } from '@/lib/module-catalog';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import type { AuthUser } from '@/store/auth-store';

const groupIcons = {
  general: LayoutDashboard,
  identidad: ShieldCheck,
  estudiantes: Users,
  academico: Building2,
  ucotesis: BookOpenCheck,
  inscripciones: ClipboardList,
  finanzas: CircleDollarSign,
  proyectos: GraduationCap,
  comunicacion: Bell,
  gobierno: Settings,
} as const;

async function loadCurrentUser(): Promise<AuthUser> {
  let response = await apiFetch('/auth/me');
  if (response.status === 401) {
    const refresh = await apiFetch('/auth/refresh', { method: 'POST' });
    if (refresh.ok) response = await apiFetch('/auth/me');
  }
  if (!response.ok) throw new Error('No active session');
  return response.json() as Promise<AuthUser>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeSlug = pathname === '/app' ? 'resumen' : pathname.split('/').at(-1);
  const activeModule = allModules.find((module) => module.slug === activeSlug);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([
    activeModule?.groupKey ?? 'general',
  ]);
  const { setUser, user } = useAuthStore();
  const session = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: loadCurrentUser,
    retry: false,
    staleTime: 60_000,
  });

  const visibleGroups = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase('es');
    if (!search) return moduleCatalog;

    return moduleCatalog
      .map((group) => ({
        ...group,
        modules: group.modules.filter((module) =>
          `${module.label} ${module.description}`.toLocaleLowerCase('es').includes(search),
        ),
      }))
      .filter((group) => group.modules.length > 0);
  }, [searchTerm]);

  useEffect(() => {
    if (session.data) setUser(session.data);
  }, [session.data, setUser]);

  useEffect(() => {
    if (session.isError) {
      setUser(null);
      router.replace('/login');
    }
  }, [router, session.isError, setUser]);

  async function logout(): Promise<void> {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    router.push('/login');
    router.refresh();
  }

  function toggleGroup(groupKey: string): void {
    setExpandedGroups((groups) =>
      groups.includes(groupKey) ? groups.filter((key) => key !== groupKey) : [...groups, groupKey],
    );
  }

  if (session.isError) {
    return (
      <main className="bg-surface grid min-h-screen place-items-center px-6">
        <p className="text-institutional font-semibold">Redirigiendo al inicio de sesión...</p>
      </main>
    );
  }

  if (session.isPending || !user) {
    return (
      <main className="bg-surface grid min-h-screen place-items-center px-6">
        <div className="text-center">
          <LoaderCircle aria-hidden="true" className="text-primary mx-auto size-8 animate-spin" />
          <p className="text-institutional mt-4 font-semibold">Validando tu sesión...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="bg-surface min-h-screen lg:grid lg:grid-cols-[19rem_1fr]">
      {menuOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          'bg-institutional fixed inset-y-0 left-0 z-50 flex w-[19rem] -translate-x-full flex-col text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none',
          menuOpen && 'translate-x-0',
        )}
      >
        <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link href="/app" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
            <span className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <GraduationCap aria-hidden="true" className="size-6" />
            </span>
            <span>
              <span className="block text-lg leading-none font-bold tracking-[0.18em]">SIGMA</span>
              <span className="mt-1 block text-[0.62rem] tracking-[0.12em] text-blue-100 uppercase">
                Panel institucional
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-blue-100 hover:bg-white/10 lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="shrink-0 px-4 pt-4">
          <label htmlFor="module-search" className="sr-only">
            Buscar un módulo
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-blue-200"
            />
            <input
              id="module-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar módulo..."
              className="h-10 w-full rounded-lg border border-white/15 bg-white/10 pr-3 pl-9 text-sm text-white outline-none placeholder:text-blue-200 focus:border-white/40 focus:ring-2 focus:ring-white/15"
            />
          </div>
        </div>

        <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-4" aria-label="Módulos de SIGMA">
          {visibleGroups.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-blue-200">
              No encontramos módulos con ese nombre.
            </p>
          )}

          {visibleGroups.map((group) => {
            const Icon = groupIcons[group.key as keyof typeof groupIcons] ?? FileBarChart;
            const expanded =
              searchTerm.length > 0 ||
              activeModule?.groupKey === group.key ||
              expandedGroups.includes(group.key);
            return (
              <section key={group.key} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={expanded}
                  aria-controls={`menu-group-${group.key}`}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-blue-100 transition hover:bg-white/10 hover:text-white"
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{group.label}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] text-blue-100">
                    {group.modules.length}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn('size-4 shrink-0 transition-transform', expanded && 'rotate-180')}
                  />
                </button>

                {expanded && (
                  <div id={`menu-group-${group.key}`} className="mt-0.5 space-y-0.5 pb-2 pl-3">
                    {group.modules.map((module) => {
                      const href = module.slug === 'resumen' ? '/app' : `/app/${module.slug}`;
                      const active = pathname === href;
                      return (
                        <Link
                          key={module.slug}
                          href={href}
                          onClick={() => setMenuOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex min-h-9 items-center gap-2 rounded-lg border-l-2 border-transparent px-3 py-2 text-[0.82rem] leading-5 text-blue-100 transition hover:bg-white/10 hover:text-white',
                            active && 'border-white bg-white/15 font-semibold text-white',
                          )}
                        >
                          <span className="min-w-0 flex-1">{module.label}</span>
                          <ChevronRight
                            aria-hidden="true"
                            className="size-3.5 shrink-0 opacity-55"
                          />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="mt-1 truncate text-xs text-blue-200">Matrícula {user.matricula}</p>
            <p className="mt-1 truncate text-xs text-blue-200">
              {user.roles.map((role) => role.name).join(', ')}
            </p>
            <button
              type="button"
              onClick={logout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-blue-100 hover:bg-white/10 hover:text-white"
            >
              <LogOut aria-hidden="true" className="size-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-border bg-background sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            className="text-institutional grid size-10 shrink-0 place-items-center rounded-lg border lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              SIGMA
            </p>
            <p className="text-institutional truncate text-sm font-bold sm:text-base">
              {activeModule?.label ?? 'Panel institucional'}
            </p>
          </div>
          <span className="bg-warning/10 text-warning ml-auto shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold">
            En desarrollo
          </span>
        </header>
        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">{children}</main>
      </div>
    </div>
  );
}
