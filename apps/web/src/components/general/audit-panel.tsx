'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityDialog } from '@/components/ui/entity-dialog';
import { Pagination } from '@/components/ui/pagination';
import { apiJson } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

type AuditData = Record<string, unknown>;
interface AuditEvent {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  user: { name: string; employeeCode: string | null; registration: string | null } | null;
  ip: string | null;
  requestId: string | null;
  createdAt: string;
  userAgent: string | null;
  data: unknown;
  previousData: unknown;
}
interface AuditResponse {
  items: AuditEvent[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
  filters: { actions: string[]; entities: string[] };
}
const ACTIONS: Record<string, string> = {
  CREAR: 'Crear',
  ACTUALIZAR: 'Actualizar',
  ELIMINAR: 'Eliminar',
  INICIAR_SESION: 'Iniciar sesión',
  RENOVAR_SESION: 'Renovar sesión',
  CERRAR_SESION: 'Cerrar sesión',
  REVISAR: 'Revisar',
  CAMBIAR_ESTADO: 'Cambiar estado',
  VALIDAR_REQUISITO: 'Validar requisito',
  SOLICITAR_DOCUMENTO: 'Solicitar documento',
  CARGAR_DOCUMENTO: 'Cargar documento',
  REVISAR_DOCUMENTO: 'Revisar documento',
  ASIGNAR_DOCENTE: 'Asignar docente',
  RETIRAR_ASIGNACION: 'Retirar asignación',
};
const MODULES: Record<string, string> = {
  sistema: 'Sin módulo identificado',
  auth: 'Autenticación',
  users: 'Usuarios',
  roles: 'Roles',
  sessions: 'Sesiones',
  students: 'Estudiantes',
  projects: 'Proyectos de grado',
  payments: 'Pagos',
  academic: 'Estructura académica',
  enrollments: 'Inscripciones',
  governance: 'Gobierno del sistema',
  'student-portal': 'Portal estudiantil',
  'ucotesis/offers': 'Ofertas',
  'ucotesis/periods': 'Períodos',
  'ucotesis/catalogs/modalities': 'Tipos de trabajo',
  'ucotesis/catalogs/areas': 'Áreas de investigación',
  'ucotesis/catalogs/requirements': 'Requisitos',
  'enrollments/document-requests': 'Solicitudes documentales',
  'enrollments/documents': 'Documentos',
  'student-portal/documents': 'Documentos',
  'student-portal/enrollments': 'Inscripciones',
};
function moduleLabel(value: string) {
  return MODULES[value] ?? MODULES[value.split('/')[0]] ?? value;
}
function actionLabel(value: string) {
  return ACTIONS[value] ?? value.replaceAll('_', ' ');
}
function record(value: unknown): AuditData | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AuditData) : null;
}
function date(value: string) {
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Santo_Domingo',
  }).format(new Date(value));
}
function resultLabel(event: AuditEvent) {
  const outcome = record(event.data)?.outcome;
  return outcome === 'EXITO'
    ? 'Completada'
    : outcome === 'ERROR'
      ? 'No completada'
      : 'No registrado';
}
const EMPTY_FILTERS = { search: '', action: '', entity: '', from: '', to: '' };
export function AuditPanel() {
  const userId = useAuthStore((s) => s.user?.id);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const source = useQuery({
    queryKey: ['audit', userId, filters, page, pageSize],
    queryFn: () => {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      for (const [key, value] of Object.entries(filters))
        if (value.trim()) query.set(key, value.trim());
      return apiJson<AuditResponse>(`/governance/audit?${query}`);
    },
  });
  const inputClass =
    'mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-600';
  return (
    <section className="w-full space-y-5">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-xs font-bold tracking-widest text-blue-700 uppercase">
          Gobierno del sistema
        </p>
        <h1 className="mt-2 text-2xl font-bold">Auditoría</h1>
        <p className="mt-2 text-sm text-slate-600">
          Consulta quién realizó una operación, en qué módulo y cuál fue su resultado.
        </p>
      </header>
      <form
        className="grid gap-4 rounded-3xl border bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ ...draft });
          setPage(1);
        }}
      >
        <label className="text-sm font-semibold">
          Buscar evento
          <input
            type="search"
            className={inputClass}
            value={draft.search}
            onChange={(e) => setDraft({ ...draft, search: e.target.value })}
            placeholder="Usuario, matrícula, registro, IP o solicitud"
          />
        </label>
        <label className="text-sm font-semibold">
          Acción
          <select
            className={inputClass}
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
          >
            <option value="">Todas las acciones</option>
            {source.data?.filters.actions.map((a) => (
              <option key={a} value={a}>
                {actionLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Módulo
          <select
            className={inputClass}
            value={draft.entity}
            onChange={(e) => setDraft({ ...draft, entity: e.target.value })}
          >
            <option value="">Todos los módulos</option>
            {source.data?.filters.entities.map((a) => (
              <option key={a} value={a}>
                {moduleLabel(a)} ({a})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Desde
          <input
            type="date"
            className={inputClass}
            value={draft.from}
            max={draft.to || undefined}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
          />
        </label>
        <label className="text-sm font-semibold">
          Hasta
          <input
            type="date"
            className={inputClass}
            value={draft.to}
            min={draft.from || undefined}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit">
            <Search className="size-4" /> Filtrar
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
          >
            Limpiar
          </Button>
          <Button
            variant="outline"
            type="button"
            disabled={source.isFetching}
            onClick={() => void source.refetch()}
          >
            <RefreshCw className="size-4" /> Actualizar
          </Button>
        </div>
      </form>
      <p className="px-1 text-xs text-slate-600">
        Fechas en hora de República Dominicana. Algunos eventos antiguos no incluyen usuario o
        módulo; se conserva su registro original.
      </p>
      <div
        className="overflow-hidden rounded-3xl border bg-white shadow-sm"
        aria-busy={source.isFetching}
      >
        {source.isPending ? (
          <p className="p-10 text-center" role="status">
            Cargando auditoría…
          </p>
        ) : source.isError ? (
          <p role="alert" className="p-6 text-red-700">
            No fue posible consultar la auditoría. {source.error.message}
          </p>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
                  <tr>
                    {[
                      'Fecha',
                      'Acción',
                      'Módulo',
                      'Registro',
                      'Usuario',
                      'Resultado',
                      'IP',
                      'Detalle',
                    ].map((name) => (
                      <th key={name} scope="col" className="px-4 py-3">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {source.data.items.map((event) => (
                    <tr key={event.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-4 whitespace-nowrap">{date(event.createdAt)}</td>
                      <td className="px-4 py-4">{actionLabel(event.action)}</td>
                      <td className="px-4 py-4">{moduleLabel(event.entity)}</td>
                      <td className="px-4 py-4">{event.entityId ?? 'No registrado'}</td>
                      <td className="px-4 py-4">
                        <p>{event.user?.name ?? 'No registrado'}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {event.user?.employeeCode ?? event.user?.registration}
                        </p>
                      </td>
                      <td className="px-4 py-4">{resultLabel(event)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{event.ip ?? 'No registrada'}</td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Ver evento ${event.id}`}
                          onClick={() => setSelected(event)}
                        >
                          <Eye className="size-4" /> Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!source.data.items.length && (
              <p className="p-10 text-center text-sm text-slate-500">
                No hay eventos para los filtros seleccionados.
              </p>
            )}
            <Pagination
              page={source.data.pagination.page}
              pageSize={pageSize}
              total={source.data.pagination.total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
      <EntityDialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Evento de auditoría #${selected.id}` : 'Evento de auditoría'}
        description="Información conservada de la operación. Esta consulta no modifica el historial."
      >
        {selected && (
          <div className="space-y-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ['Fecha', date(selected.createdAt)],
                ['Usuario', selected.user?.name ?? 'No registrado'],
                ['Acción', actionLabel(selected.action)],
                ['Módulo', moduleLabel(selected.entity)],
                ['Registro', selected.entityId ?? 'No registrado'],
                ['Resultado', resultLabel(selected)],
                ['IP', selected.ip ?? 'No registrada'],
                ['Solicitud', selected.requestId ?? 'No registrada'],
                ['Método', record(selected.data)?.method],
                ['Ruta', record(selected.data)?.path],
                ['Respuesta HTTP', record(selected.data)?.statusCode],
                ['Navegador', selected.userAgent],
              ]
                .filter(([, value]) => value !== null && value !== undefined)
                .map(([label, value]) => (
                  <div key={String(label)} className="min-w-0">
                    <dt className="font-semibold text-slate-500">{String(label)}</dt>
                    <dd className="mt-1 break-words">{String(value)}</dd>
                  </div>
                ))}
            </dl>
            <AuditValues
              title="Datos enviados"
              value={
                record(selected.data)?.outcome ? record(selected.data)?.changes : selected.data
              }
            />
            {selected.previousData != null && (
              <AuditValues title="Datos anteriores" value={selected.previousData} />
            )}
          </div>
        )}
      </EntityDialog>
    </section>
  );
}
function AuditValues({ title, value }: { title: string; value: unknown }) {
  return (
    <section>
      <h3 className="mb-2 font-semibold">{title}</h3>
      {value == null || (record(value) && !Object.keys(value as object).length) ? (
        <p className="text-sm text-slate-500">Sin datos adicionales registrados.</p>
      ) : (
        <pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-4 text-xs break-words whitespace-pre-wrap">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </section>
  );
}
