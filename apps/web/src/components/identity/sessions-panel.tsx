'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, LoaderCircle, LogOut, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { FilterSelect, TableFilters } from '@/components/ui/table-filters';
import { apiFetch, readApiError } from '@/lib/api';
import { humanizeSystemValue } from '@/lib/humanize-system-value';

interface SessionItem {
  id: string;
  isCurrent: boolean;
  status: 'ACTIVA' | 'REVOCADA' | 'EXPIRADA';
  ip: string | null;
  userAgent: string | null;
  expiresAt: string;
  createdAt: string;
  user: { name: string; matricula: string | null; employeeCode: string | null };
}

export function SessionsPanel() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const sessions = useQuery({
    queryKey: ['identity', 'sessions'],
    queryFn: async () => {
      const response = await apiFetch('/sessions');
      if (!response.ok) throw new Error(await readApiError(response));
      return response.json() as Promise<{ items: SessionItem[]; total: number }>;
    },
  });
  const revoke = useMutation({
    mutationFn: async (id?: string) => {
      const response = await apiFetch(id ? `/sessions/${id}` : '/sessions', { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiError(response));
    },
    onSuccess: () => {
      toast.success('Sesión revocada.');
      void client.invalidateQueries({ queryKey: ['identity', 'sessions'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const filteredSessions =
    sessions.data?.items.filter(
      (session) =>
        (!statusFilter || session.status === statusFilter) &&
        `${session.user.name} ${session.user.employeeCode ?? ''} ${session.user.matricula ?? ''} ${session.ip ?? ''} ${session.userAgent ?? ''}`
          .toLocaleLowerCase('es')
          .includes(search.trim().toLocaleLowerCase('es')),
    ) ?? [];
  const pagination = usePagination(filteredSessions);

  return (
    <section className="w-full space-y-4 sm:space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold tracking-widest text-blue-700 uppercase">
            Identidad y acceso
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Actividad de acceso</h1>
          <p className="mt-2 text-slate-600">
            Consulta dispositivos y sesiones según el alcance autorizado para tu cuenta.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => revoke.mutate(undefined)}
          disabled={revoke.isPending}
        >
          <ShieldAlert className="size-4" /> Revocar mis otras sesiones
        </Button>
      </header>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
        <TableFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Usuario, código, IP o dispositivo"
          totalLabel={`${filteredSessions.length} sesiones`}
          hasActiveFilters={Boolean(search || statusFilter)}
          onClear={() => {
            setSearch('');
            setStatusFilter('');
          }}
        >
          <FilterSelect
            label="Estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'ACTIVA', label: 'Activa' },
              { value: 'EXPIRADA', label: 'Expirada' },
              { value: 'REVOCADA', label: 'Revocada' },
            ]}
          />
        </TableFilters>
        <div className="grid gap-3 p-3 sm:p-5">
          {pagination.pageItems.map((session) => (
            <article
              key={session.id}
              className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                <Laptop className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-slate-900">{session.user.name}</h2>
                  {session.isCurrent && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
                      Sesión actual
                    </span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">
                    {humanizeSystemValue(session.status)}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-600">
                  {session.userAgent ?? 'Dispositivo no identificado'}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  Código: {session.user.employeeCode ?? 'No asignado'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  IP {session.ip ?? 'no disponible'} · inicio{' '}
                  {new Intl.DateTimeFormat('es-DO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(session.createdAt))}{' '}
                  · vence{' '}
                  {new Intl.DateTimeFormat('es-DO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(session.expiresAt))}
                </p>
              </div>
              {session.status === 'ACTIVA' && !session.isCurrent && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => revoke.mutate(session.id)}
                  disabled={revoke.isPending}
                >
                  <LogOut className="size-4" /> Revocar
                </Button>
              )}
            </article>
          ))}
          {sessions.isLoading && (
            <div className="grid min-h-32 place-items-center">
              <LoaderCircle className="size-6 animate-spin" />
            </div>
          )}
          {sessions.isError && (
            <p className="rounded-2xl border bg-white p-8 text-center text-red-700">
              No fue posible cargar las sesiones.
            </p>
          )}
        </div>
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={filteredSessions.length}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </section>
    </section>
  );
}
