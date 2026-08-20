'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Download,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EntityDialog } from '@/components/ui/entity-dialog';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { apiFetch, apiJson, readApiError } from '@/lib/api';
import { findModuleBySlug } from '@/lib/module-catalog';
import { useAuthStore } from '@/store/auth-store';

export type OperationsMode =
  | 'modalidades'
  | 'periodos'
  | 'areas-investigacion'
  | 'requisitos'
  | 'ofertas'
  | 'inscripciones'
  | 'sustentantes'
  | 'validaciones'
  | 'estados-inscripcion'
  | 'documentos'
  | 'cuentas-bancarias'
  | 'metodos-pago'
  | 'pagos'
  | 'transacciones'
  | 'conciliaciones'
  | 'facturas'
  | 'proyectos-grado'
  | 'docentes'
  | 'asesores-jurados'
  | 'configuraciones'
  | 'auditoria';

type Item = Record<string, unknown> & { id?: string };
interface DataSet {
  items?: Item[];
  states?: Item[];
  methods?: Item[];
  teachers?: Item[];
  campusCareers?: Item[];
  modalities?: Item[];
  periods?: Item[];
  areas?: Item[];
  requirements?: Item[];
  enrollments?: Item[];
  participationTypes?: Item[];
  students?: Item[];
}
type Option = { label: string; value: string };
type RowAction =
  | 'view'
  | 'edit'
  | 'status'
  | 'delete'
  | 'remove-participant'
  | 'remove-assignment'
  | 'validate-document'
  | 'reject-document'
  | 'close-reconciliation';
interface Field {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'datetime-local' | 'textarea' | 'select';
  required?: boolean;
  options?: Option[];
  multiple?: boolean;
}
interface Editor {
  title: string;
  description: string;
  fields: Field[];
  submitLabel: string;
  endpoint: (item: Item | null) => string;
  method: 'POST' | 'PATCH';
}
interface RowOperation {
  path: string;
  body?: object;
  method?: 'PATCH' | 'DELETE';
  confirm?: string;
}

const CATALOG_KIND = {
  modalidades: 'modalities',
  'areas-investigacion': 'areas',
  requisitos: 'requirements',
} as const;

export function OperationsPanel({ mode }: { mode: OperationsMode }) {
  const moduleItem = findModuleBySlug(mode);
  const user = useAuthStore((state) => state.user);
  const isStudent = user?.roles.some((role) => role.code === 'ESTUDIANTE') ?? false;
  const canManage = canManageMode(
    mode,
    user?.roles.map((role) => role.code) ?? [],
    user?.permissions ?? [],
  );
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editorItem, setEditorItem] = useState<Item | null | undefined>();
  const [viewItem, setViewItem] = useState<Item | undefined>();
  const [form, setForm] = useState<Record<string, string | string[]>>({});
  const source = useQuery({
    queryKey: ['operations', mode, isStudent],
    queryFn: () => loadMode(mode, isStudent),
  });
  const ucotesisCatalogs = useQuery({
    queryKey: ['operations', 'ucotesis-catalogs'],
    queryFn: () => apiJson<DataSet>('/ucotesis/catalogs'),
    enabled: mode === 'ofertas' || mode === 'validaciones',
  });
  const enrollmentCatalogs = useQuery({
    queryKey: ['operations', 'enrollment-catalogs'],
    queryFn: () => apiJson<DataSet>('/enrollments/catalogs'),
    enabled: [
      'inscripciones',
      'sustentantes',
      'validaciones',
      'estados-inscripcion',
      'documentos',
    ].includes(mode),
  });
  const projectCatalogs = useQuery({
    queryKey: ['operations', 'project-catalogs'],
    queryFn: () => apiJson<DataSet>('/projects/catalogs'),
    enabled: ['proyectos-grado', 'docentes', 'asesores-jurados'].includes(mode),
  });
  const items = useMemo(() => normalizeItems(mode, source.data), [mode, source.data]);
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const text = JSON.stringify(item).toLowerCase();
        const matchesSearch = !search || text.includes(search.toLowerCase());
        const matchesStatus = !status || String(item.status ?? '').toUpperCase() === status;
        return matchesSearch && matchesStatus;
      }),
    [items, search, status],
  );
  const pagination = usePagination(filtered, 10);
  const editor = buildEditor(mode, editorItem ?? null, {
    canManage,
    ucotesis: ucotesisCatalogs.data,
    enrollments: enrollmentCatalogs.data,
    projects: projectCatalogs.data,
    records: source.data?.items ?? items,
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!editor) return;
      const response = await apiFetch(
        resolveEditorEndpoint(mode, editor, editorItem ?? null, form),
        {
          method: editor.method,
          body: JSON.stringify(editorPayload(mode, coerceForm(form, editor.fields))),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response));
      return response.json();
    },
    onSuccess: () => {
      toast.success('Operación guardada correctamente.');
      setEditorItem(undefined);
      setForm({});
      void client.invalidateQueries({ queryKey: ['operations'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const action = useMutation({
    mutationFn: async ({
      path,
      body,
      method = 'PATCH',
    }: {
      path: string;
      body?: object;
      method?: 'PATCH' | 'DELETE';
    }) => apiJson(path, { method, ...(body && { body: JSON.stringify(body) }) }),
    onSuccess: () => {
      toast.success('Acción completada correctamente.');
      void client.invalidateQueries({ queryKey: ['operations'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openCreate = () => {
    setForm(defaultForm(mode));
    setEditorItem(null);
  };
  const openStatus = (item: Item) => {
    setForm({ statusCode: String(item.status ?? '') });
    setEditorItem(item);
  };
  const handleRowAction = (kind: RowAction, item: Item) => {
    if (kind === 'view') return setViewItem(item);
    if (kind === 'edit') {
      setForm(formFromItem(mode, item));
      return setEditorItem(item);
    }
    if (kind === 'status') return openStatus(item);
    const operation = destructiveOperation(mode, kind, item);
    if (!operation) return;
    if (operation.confirm && !window.confirm(operation.confirm)) return;
    action.mutate(operation);
  };
  const statusOptions = [...new Set(items.map((x) => String(x.status ?? '')).filter(Boolean))];
  return (
    <section className="w-full space-y-5">
      <header className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-bold tracking-widest text-blue-700 uppercase">
          {moduleItem?.groupLabel}
        </p>
        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">{moduleItem?.label}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
              {moduleItem?.description}
            </p>
          </div>
          {canCreateMode(mode, canManage, isStudent) &&
            buildEditor(mode, null, {
              canManage,
              ucotesis: ucotesisCatalogs.data,
              enrollments: enrollmentCatalogs.data,
              projects: projectCatalogs.data,
              records: source.data?.items ?? items,
            }) && (
              <Button type="button" onClick={openCreate}>
                <Plus className="size-4" /> Agregar
              </Button>
            )}
        </div>
      </header>
      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-slate-50 p-3 sm:flex-row sm:items-end sm:p-4">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Search className="size-3.5" /> Buscar
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                pagination.setPage(1);
              }}
              placeholder="Código, nombre, matrícula, referencia o estado"
              className="h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>
          {statusOptions.length > 1 && (
            <label>
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Estado</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-11 min-w-44 rounded-xl border bg-white px-3 text-sm"
              >
                <option value="">Todos</option>
                {statusOptions.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
          <Button type="button" variant="outline" onClick={() => void source.refetch()}>
            <RefreshCw className="size-4" /> Actualizar
          </Button>
        </div>
        {source.isPending ? (
          <p className="grid min-h-52 place-items-center">
            <LoaderCircle className="size-6 animate-spin text-blue-700" />
          </p>
        ) : source.isError ? (
          <p className="p-10 text-center text-red-700">
            No fue posible cargar el módulo desde la base de datos.
          </p>
        ) : (
          <DataTable
            mode={mode}
            items={pagination.pageItems}
            canManage={canManage}
            onAction={handleRowAction}
            onReview={(item, decision) =>
              action.mutate({
                path: `/payments/${item.id}/review`,
                body: {
                  decision,
                  observation:
                    decision === 'RECHAZADO' ? 'Comprobante no validado por tesorería.' : undefined,
                },
              })
            }
          />
        )}
        {!source.isPending && filtered.length === 0 && (
          <p className="border-t border-dashed p-10 text-center text-sm text-slate-500">
            No hay registros para los filtros seleccionados.
          </p>
        )}
        <Pagination
          total={filtered.length}
          page={pagination.page}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>
      <EntityDialog
        open={editorItem !== undefined}
        onClose={() => setEditorItem(undefined)}
        title={editor?.title ?? 'Gestionar registro'}
        description={editor?.description}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditorItem(undefined)}>
              Cancelar
            </Button>
            <Button type="submit" form="operations-editor" disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
              {editor?.submitLabel ?? 'Guardar'}
            </Button>
          </>
        }
      >
        {editor && (
          <form
            id="operations-editor"
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            {editor.fields.map((field) => (
              <EditorField
                key={field.key}
                field={field}
                value={form[field.key] ?? ''}
                onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
              />
            ))}
          </form>
        )}
      </EntityDialog>
      <EntityDialog
        open={viewItem !== undefined}
        onClose={() => setViewItem(undefined)}
        title="Detalle del registro"
        description="Información cargada directamente desde la base de datos."
        footer={
          <Button type="button" onClick={() => setViewItem(undefined)}>
            Cerrar
          </Button>
        }
      >
        {viewItem && <DetailView item={viewItem} />}
      </EntityDialog>
    </section>
  );
}

async function loadMode(mode: OperationsMode, isStudent: boolean): Promise<DataSet> {
  if (mode in CATALOG_KIND)
    return apiJson<DataSet>(
      `/ucotesis/catalogs/${CATALOG_KIND[mode as keyof typeof CATALOG_KIND]}`,
    );
  if (mode === 'periodos') return apiJson<DataSet>('/ucotesis/periods');
  if (mode === 'ofertas') return apiJson<DataSet>('/ucotesis/offers');
  if (mode === 'documentos' && isStudent) return apiJson<DataSet>('/student-portal/enrollments');
  if (
    ['inscripciones', 'sustentantes', 'validaciones', 'estados-inscripcion', 'documentos'].includes(
      mode,
    )
  )
    return mode === 'estados-inscripcion'
      ? apiJson<DataSet>('/enrollments/catalogs')
      : apiJson<DataSet>('/enrollments');
  if (mode === 'cuentas-bancarias') return apiJson<DataSet>('/payments/bank-accounts');
  if (mode === 'metodos-pago') return apiJson<DataSet>('/payments/catalogs');
  if (['pagos', 'facturas'].includes(mode)) return apiJson<DataSet>('/payments');
  if (mode === 'transacciones') return apiJson<DataSet>('/payments/transactions');
  if (mode === 'conciliaciones') return apiJson<DataSet>('/payments/reconciliations');
  if (['proyectos-grado', 'asesores-jurados'].includes(mode)) return apiJson<DataSet>('/projects');
  if (mode === 'docentes') return apiJson<DataSet>('/projects/catalogs');
  if (mode === 'configuraciones') return apiJson<DataSet>('/governance/configurations');
  return apiJson<DataSet>('/governance/audit?pageSize=100');
}

function normalizeItems(mode: OperationsMode, data: DataSet | undefined): Item[] {
  if (!data) return [];
  if (mode === 'estados-inscripcion') return data.states ?? [];
  if (mode === 'metodos-pago') return data.methods ?? [];
  if (mode === 'docentes') return data.teachers ?? [];
  const items: Item[] = data.items ?? [];
  if (mode === 'facturas')
    return items
      .filter((x) => x.invoice)
      .map((x) => ({
        ...((x.invoice as Item) ?? {}),
        id: x.id,
        paymentReference: x.reference,
        student: x.student,
        amount: x.amount,
        currency: x.currency,
      }));
  if (mode === 'sustentantes')
    return items.flatMap((x) =>
      ((x.participants as Item[]) ?? []).map((participant) => ({
        ...participant,
        id: `${x.id}-${participant.id}`,
        studentId: participant.id,
        enrollmentId: x.id,
        enrollment: x.code,
        offer: (x.offer as Item)?.title,
      })),
    );
  if (mode === 'validaciones')
    return items.flatMap((x) =>
      ((x.validations as Item[]) ?? []).map((validation) => ({
        ...validation,
        enrollmentId: x.id,
        enrollment: x.code,
        offer: (x.offer as Item)?.title,
        status: validation.meets ? 'CUMPLE' : 'NO_CUMPLE',
      })),
    );
  if (mode === 'documentos')
    return items.flatMap((x) =>
      ((x.documents as Item[]) ?? []).map((document) => ({
        ...document,
        enrollmentId: x.id,
        enrollment: x.code,
        offer: (x.offer as Item)?.title,
      })),
    );
  if (mode === 'asesores-jurados')
    return items.flatMap((x) =>
      ((x.teachers as Item[]) ?? []).map((teacher) => ({
        ...teacher,
        id: `${x.id}-${teacher.id}-${teacher.typeId}`,
        projectId: x.id,
        teacherId: teacher.id,
        participationTypeId: teacher.typeId,
        project: x.title,
        status: x.status,
      })),
    );
  return items;
}

function DataTable({
  mode,
  items,
  canManage,
  onAction,
  onReview,
}: {
  mode: OperationsMode;
  items: Item[];
  canManage: boolean;
  onAction: (kind: RowAction, item: Item) => void;
  onReview: (item: Item, decision: 'VALIDADO' | 'RECHAZADO') => void;
}) {
  const columns = columnsFor(mode);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-5 py-3">
                {column.label}
              </th>
            ))}
            <th className="px-5 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item, index) => (
            <tr key={String(item.id ?? index)} className="align-top hover:bg-slate-50/70">
              {columns.map((column) => (
                <td key={column.key} className="max-w-sm px-5 py-4">
                  {renderValue(readPath(item, column.key))}
                </td>
              ))}
              <td className="px-5 py-3">
                <div className="flex justify-end gap-2">
                  {rowActions(mode, item, canManage).map((rowAction) => (
                    <Button
                      key={rowAction.kind}
                      size="sm"
                      variant={rowAction.kind === 'delete' ? 'outline' : 'ghost'}
                      onClick={() => onAction(rowAction.kind, item)}
                      title={rowAction.label}
                    >
                      {rowAction.kind === 'view' ? (
                        <Eye className="size-4" />
                      ) : rowAction.kind === 'edit' || rowAction.kind === 'status' ? (
                        <Pencil className="size-4" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      <span className="sr-only xl:not-sr-only">{rowAction.label}</span>
                    </Button>
                  ))}
                  {canManage && mode === 'pagos' && item.status === 'PENDIENTE' && (
                    <>
                      <Button size="sm" onClick={() => onReview(item, 'VALIDADO')}>
                        <CheckCircle2 className="size-4" /> Validar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReview(item, 'RECHAZADO')}
                      >
                        <XCircle className="size-4" /> Rechazar
                      </Button>
                    </>
                  )}
                  {mode === 'pagos' && Boolean(item.proof) && (
                    <a
                      className="inline-flex h-9 items-center gap-2 rounded-md border px-3 font-semibold"
                      href={`/api/payments/${item.id}/proof`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="size-4" /> Comprobante
                    </a>
                  )}
                  {mode === 'facturas' && (
                    <a
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-700 px-3 font-semibold text-white"
                      href={`/api/payments/invoices/${item.id}/pdf`}
                    >
                      <Download className="size-4" /> PDF
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildEditor(
  mode: OperationsMode,
  item: Item | null,
  catalogs: {
    canManage?: boolean;
    ucotesis?: DataSet;
    enrollments?: DataSet;
    projects?: DataSet;
    records?: Item[];
  },
): Editor | null {
  const select = (values: Item[] | undefined, label: (value: Item) => string): Option[] =>
    (values ?? []).map((value) => ({ value: String(value.id), label: label(value) }));
  if (mode in CATALOG_KIND)
    return {
      title: `${item ? 'Editar' : 'Crear'} ${findModuleBySlug(mode)?.label.toLowerCase()}`,
      description:
        'Los datos se guardan en el catálogo institucional y quedan disponibles para las ofertas.',
      submitLabel: item ? 'Guardar cambios' : 'Crear registro',
      endpoint: (value) =>
        `/ucotesis/catalogs/${CATALOG_KIND[mode as keyof typeof CATALOG_KIND]}${value ? `/${value.id}` : ''}`,
      method: item ? 'PATCH' : 'POST',
      fields: [
        { key: 'codigo', label: 'Código', required: true },
        { key: 'nombre', label: 'Nombre', required: true },
        { key: 'descripcion', label: 'Descripción', type: 'textarea' },
        ...(item
          ? [
              {
                key: 'estado',
                label: 'Estado',
                type: 'select' as const,
                options: enumOptions(['ACTIVO', 'INACTIVO']),
              },
            ]
          : []),
        ...(mode === 'requisitos'
          ? [
              {
                key: 'tipoValidacion',
                label: 'Tipo de validación',
                type: 'select' as const,
                required: true,
                options: enumOptions(['AUTOMATICA', 'MANUAL', 'DOCUMENTAL']),
              },
            ]
          : []),
      ],
    };
  if (mode === 'periodos')
    return {
      title: 'Crear período académico',
      description: 'Define la ventana institucional que usarán las ofertas.',
      submitLabel: item ? 'Guardar cambios' : 'Crear período',
      endpoint: (value) => `/ucotesis/periods${value ? `/${value.id}` : ''}`,
      method: item ? 'PATCH' : 'POST',
      fields: [
        { key: 'codigo', label: 'Código', required: true },
        { key: 'nombre', label: 'Nombre', required: true },
        { key: 'fechaInicio', label: 'Fecha inicial', type: 'date', required: true },
        { key: 'fechaFin', label: 'Fecha final', type: 'date', required: true },
        {
          key: 'estado',
          label: 'Estado',
          type: 'select',
          options: enumOptions(['PLANIFICADO', 'ACTIVO', 'CERRADO', 'CANCELADO']),
        },
      ],
    };
  if (mode === 'ofertas')
    return {
      title: 'Crear oferta UCOTESIS',
      description: 'Segmenta por recinto, carrera, modalidad, período, cupo, fechas y monto.',
      submitLabel: item ? 'Guardar cambios' : 'Crear oferta',
      endpoint: (value) => `/ucotesis/offers${value ? `/${value.id}` : ''}`,
      method: item ? 'PATCH' : 'POST',
      fields: [
        { key: 'codigo', label: 'Código', required: true },
        { key: 'titulo', label: 'Título', required: true },
        {
          key: 'recintoCarreraId',
          label: 'Recinto y carrera',
          type: 'select',
          required: true,
          options: select(catalogs.ucotesis?.campusCareers, (x) => `${x.campus} · ${x.career}`),
        },
        {
          key: 'modalidadId',
          label: 'Modalidad',
          type: 'select',
          required: true,
          options: select(catalogs.ucotesis?.modalities, (x) => String(x.name)),
        },
        {
          key: 'periodoId',
          label: 'Período',
          type: 'select',
          required: true,
          options: select(catalogs.ucotesis?.periods, (x) => String(x.name)),
        },
        {
          key: 'fechaInicioInscripcion',
          label: 'Inicio de inscripción',
          type: 'datetime-local',
          required: true,
        },
        {
          key: 'fechaFinInscripcion',
          label: 'Fin de inscripción',
          type: 'datetime-local',
          required: true,
        },
        { key: 'cupoTotal', label: 'Cupo', type: 'number', required: true },
        { key: 'monto', label: 'Monto DOP', type: 'number', required: true },
        {
          key: 'areaIds',
          label: 'Áreas',
          type: 'select',
          multiple: true,
          options: select(catalogs.ucotesis?.areas, (x) => String(x.name)),
        },
        {
          key: 'requisitoIds',
          label: 'Requisitos',
          type: 'select',
          multiple: true,
          options: select(catalogs.ucotesis?.requirements, (x) => String(x.name)),
        },
        {
          key: 'estado',
          label: 'Estado',
          type: 'select',
          options: enumOptions(['BORRADOR', 'PUBLICADA', 'CERRADA', 'CANCELADA']),
        },
        { key: 'descripcion', label: 'Descripción', type: 'textarea' },
      ],
    };
  if (mode === 'inscripciones' && item)
    return {
      title: `Actualizar ${item.code}`,
      description: 'La transición queda registrada en el historial y notifica a los sustentantes.',
      submitLabel: 'Actualizar estado',
      endpoint: (value) => `/enrollments/${value?.id}/status`,
      method: 'PATCH',
      fields: [
        {
          key: 'statusCode',
          label: 'Nuevo estado',
          type: 'select',
          required: true,
          options: select(catalogs.enrollments?.states, (x) => String(x.name)),
        },
        { key: 'reason', label: 'Motivo u observación', type: 'textarea' },
      ],
    };
  if (mode === 'estados-inscripcion')
    return {
      title: 'Crear estado de inscripción',
      description: 'Configura el orden y si termina el flujo.',
      submitLabel: item ? 'Guardar cambios' : 'Crear estado',
      endpoint: (value) => `/enrollments/states${value ? `/${value.id}` : ''}`,
      method: item ? 'PATCH' : 'POST',
      fields: [
        { key: 'code', label: 'Código', required: true },
        { key: 'name', label: 'Nombre', required: true },
        { key: 'order', label: 'Orden', type: 'number', required: true },
        {
          key: 'final',
          label: 'Es estado final',
          type: 'select',
          options: booleanOptions(),
        },
      ],
    };
  if (mode === 'sustentantes')
    return {
      title: 'Agregar sustentante',
      description: 'Vincula un estudiante a una inscripción existente sin duplicarlo en la oferta.',
      submitLabel: 'Agregar sustentante',
      endpoint: () => '/enrollments/0/participants',
      method: 'POST',
      fields: [
        {
          key: 'enrollmentId',
          label: 'Inscripción',
          type: 'select',
          required: true,
          options: select(
            catalogs.records,
            (x) => `${x.code} · ${String((x.offer as Item)?.title ?? '')}`,
          ),
        },
        {
          key: 'studentId',
          label: 'Estudiante',
          type: 'select',
          required: true,
          options: select(catalogs.enrollments?.students, (x) => `${x.registration} · ${x.name}`),
        },
      ],
    };
  if (mode === 'validaciones')
    return {
      title: 'Validar requisito',
      description: 'Registra la revisión manual o documental en el expediente de inscripción.',
      submitLabel: 'Guardar validación',
      endpoint: () => '/enrollments/0/validations',
      method: 'POST',
      fields: [
        {
          key: 'enrollmentId',
          label: 'Inscripción',
          type: 'select',
          required: true,
          options: select(
            catalogs.records,
            (x) => `${x.code} · ${String((x.offer as Item)?.title ?? '')}`,
          ),
        },
        {
          key: 'requirementId',
          label: 'Requisito',
          type: 'select',
          required: true,
          options: select(catalogs.ucotesis?.requirements, (x) => String(x.name)),
        },
        {
          key: 'meets',
          label: 'Resultado',
          type: 'select',
          required: true,
          options: [
            { value: 'true', label: 'Cumple' },
            { value: 'false', label: 'No cumple' },
          ],
        },
        { key: 'value', label: 'Valor obtenido' },
        { key: 'observation', label: 'Observación', type: 'textarea' },
      ],
    };
  if (mode === 'cuentas-bancarias')
    return {
      title: 'Agregar cuenta bancaria',
      description: 'Estos datos serán visibles para el estudiante al realizar una transferencia.',
      submitLabel: 'Guardar cuenta',
      endpoint: (value) => `/payments/bank-accounts${value ? `/${value.id}` : ''}`,
      method: item ? 'PATCH' : 'POST',
      fields: [
        { key: 'bank', label: 'Banco', required: true },
        { key: 'accountNumber', label: 'Número de cuenta', required: true },
        {
          key: 'accountType',
          label: 'Tipo de cuenta',
          type: 'select',
          required: true,
          options: enumOptions(['AHORRO', 'CORRIENTE']),
        },
        {
          key: 'documentType',
          label: 'Documento',
          type: 'select',
          required: true,
          options: enumOptions(['CEDULA', 'PASAPORTE', 'RNC']),
        },
        { key: 'holderDocument', label: 'Cédula, pasaporte o RNC', required: true },
        { key: 'holderName', label: 'Nombre del titular', required: true },
        { key: 'currency', label: 'Moneda', required: true },
        { key: 'instructions', label: 'Instrucciones', type: 'textarea' },
        ...(item
          ? [
              {
                key: 'status',
                label: 'Estado',
                type: 'select' as const,
                options: enumOptions(['ACTIVO', 'INACTIVO']),
              },
            ]
          : []),
      ],
    };
  if (mode === 'metodos-pago')
    return {
      title: 'Crear método de pago',
      description: 'Habilita un canal financiero trazable.',
      submitLabel: 'Crear método',
      endpoint: (value) => `/payments/methods${value ? `/${value.id}` : ''}`,
      method: item ? 'PATCH' : 'POST',
      fields: [
        { key: 'code', label: 'Código', required: true },
        { key: 'name', label: 'Nombre', required: true },
        {
          key: 'status',
          label: 'Estado',
          type: 'select',
          options: enumOptions(['ACTIVO', 'INACTIVO']),
        },
      ],
    };
  if (mode === 'conciliaciones')
    return {
      title: 'Crear conciliación',
      description: 'Consolida los pagos aprobados del rango indicado.',
      submitLabel: 'Conciliar',
      endpoint: () => '/payments/reconciliations',
      method: 'POST',
      fields: [
        { key: 'provider', label: 'Banco o proveedor', required: true },
        { key: 'from', label: 'Desde', type: 'datetime-local', required: true },
        { key: 'to', label: 'Hasta', type: 'datetime-local', required: true },
      ],
    };
  if (mode === 'proyectos-grado')
    return {
      title: item ? 'Editar proyecto de grado' : 'Registrar proyecto de grado',
      description: 'Solo se muestran inscripciones confirmadas que todavía no tienen proyecto.',
      submitLabel: item ? 'Guardar cambios' : 'Crear proyecto',
      endpoint: (value) => `/projects${value ? `/${value.id}` : ''}`,
      method: item ? 'PATCH' : 'POST',
      fields: [
        ...(!item
          ? [
              {
                key: 'enrollmentId',
                label: 'Inscripción',
                type: 'select' as const,
                required: true,
                options: select(catalogs.projects?.enrollments, (x) => `${x.code} · ${x.offer}`),
              },
            ]
          : []),
        {
          key: 'areaId',
          label: 'Área de investigación',
          type: 'select',
          options: select(catalogs.projects?.areas, (x) => String(x.name)),
        },
        { key: 'title', label: 'Título', required: true },
        { key: 'description', label: 'Descripción', type: 'textarea' },
        ...(item
          ? [
              {
                key: 'status',
                label: 'Estado',
                type: 'select' as const,
                options: enumOptions(
                  catalogs.canManage
                    ? [
                        'PENDIENTE',
                        'EN_DESARROLLO',
                        'EN_REVISION',
                        'APROBADO',
                        'RECHAZADO',
                        'FINALIZADO',
                        'CANCELADO',
                      ]
                    : ['EN_DESARROLLO', 'EN_REVISION'],
                ),
              },
              { key: 'startDate', label: 'Fecha de inicio', type: 'date' as const },
              { key: 'endDate', label: 'Fecha de finalización', type: 'date' as const },
            ]
          : []),
      ],
    };
  if (mode === 'asesores-jurados')
    return {
      title: 'Asignar asesor o jurado',
      description: 'La asignación queda vinculada al proyecto y se notifica al docente.',
      submitLabel: 'Asignar docente',
      endpoint: () => '/projects/0/teachers',
      method: 'POST',
      fields: [
        {
          key: 'projectId',
          label: 'Proyecto',
          type: 'select',
          required: true,
          options: select(catalogs.records, (x) => String(x.title)),
        },
        {
          key: 'teacherId',
          label: 'Docente',
          type: 'select',
          required: true,
          options: select(catalogs.projects?.teachers, (x) => `${x.code} · ${x.name}`),
        },
        {
          key: 'participationTypeId',
          label: 'Participación',
          type: 'select',
          required: true,
          options: select(catalogs.projects?.participationTypes, (x) => String(x.name)),
        },
      ],
    };
  if (mode === 'configuraciones')
    return {
      title: item ? 'Editar configuración' : 'Crear configuración',
      description: 'Parámetro tipado y persistido; las modificaciones quedan auditadas.',
      submitLabel: 'Guardar configuración',
      endpoint: (value) => `/governance/configurations${value ? `/${value.id}` : ''}`,
      method: item ? 'PATCH' : 'POST',
      fields: [
        { key: 'key', label: 'Clave', required: true },
        { key: 'value', label: 'Valor', type: 'textarea' },
        {
          key: 'type',
          label: 'Tipo',
          type: 'select',
          required: true,
          options: enumOptions([
            'STRING',
            'INTEGER',
            'DECIMAL',
            'BOOLEAN',
            'JSON',
            'DATE',
            'DATETIME',
          ]),
        },
        { key: 'description', label: 'Descripción', type: 'textarea' },
        {
          key: 'public',
          label: 'Visibilidad',
          type: 'select',
          options: [
            { value: 'true', label: 'Pública' },
            { value: 'false', label: 'Interna' },
          ],
        },
      ],
    };
  return null;
}

function EditorField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string | string[];
  onChange: (value: string | string[]) => void;
}) {
  const common =
    'h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
  return (
    <label className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
      <span className="mb-1.5 block text-xs font-bold text-slate-700">
        {field.label}
        {field.required && ' *'}
      </span>
      {field.type === 'select' ? (
        <select
          multiple={field.multiple}
          required={field.required}
          value={value}
          onChange={(event) =>
            onChange(
              field.multiple
                ? Array.from(event.target.selectedOptions, (option) => option.value)
                : event.target.value,
            )
          }
          className={`${common} ${field.multiple ? 'h-32 py-2' : ''}`}
        >
          <option value="">Seleccionar</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          required={field.required}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      ) : (
        <input
          required={field.required}
          type={field.type ?? 'text'}
          step={field.type === 'number' ? '0.01' : undefined}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          className={common}
        />
      )}
    </label>
  );
}
function columnsFor(mode: OperationsMode): Array<{ key: string; label: string }> {
  const map: Partial<Record<OperationsMode, Array<{ key: string; label: string }>>> = {
    modalidades: cols(['code:Código', 'name:Nombre', 'description:Descripción', 'status:Estado']),
    'areas-investigacion': cols([
      'code:Código',
      'name:Nombre',
      'description:Descripción',
      'status:Estado',
    ]),
    requisitos: cols(['code:Código', 'name:Nombre', 'validationType:Validación', 'status:Estado']),
    periodos: cols([
      'code:Código',
      'name:Nombre',
      'startDate:Inicio',
      'endDate:Fin',
      'status:Estado',
    ]),
    ofertas: cols([
      'code:Código',
      'title:Oferta',
      'campusCareer:Recinto / carrera',
      'modality:Modalidad',
      'available:Cupos',
      'amount:Monto',
      'status:Estado',
    ]),
    inscripciones: cols([
      'code:Código',
      'participants:Sustentantes',
      'offer:Oferta',
      'amount:Monto',
      'status:Estado',
    ]),
    sustentantes: cols([
      'registration:Matrícula',
      'name:Sustentante',
      'enrollment:Inscripción',
      'offer:Oferta',
      'principal:Principal',
    ]),
    validaciones: cols([
      'enrollment:Inscripción',
      'offer:Oferta',
      'requirement:Requisito',
      'value:Valor',
      'meets:Cumple',
      'status:Estado',
    ]),
    'estados-inscripcion': cols([
      'code:Código',
      'name:Nombre',
      'order:Orden',
      'final:Final',
      'status:Estado',
    ]),
    documentos: cols([
      'enrollment:Inscripción',
      'offer:Oferta',
      'type:Tipo',
      'name:Archivo',
      'status:Estado',
    ]),
    'cuentas-bancarias': cols([
      'bank:Banco',
      'accountNumber:Cuenta',
      'accountType:Tipo',
      'holderName:Titular',
      'holderDocument:Documento',
      'status:Estado',
    ]),
    'metodos-pago': cols(['code:Código', 'name:Nombre', 'status:Estado']),
    pagos: cols([
      'reference:Referencia',
      'student:Estudiante',
      'enrollment:Código inscripción',
      'amount:Monto',
      'method:Método',
      'proof:Comprobante',
      'status:Estado',
    ]),
    transacciones: cols([
      'paymentReference:Pago',
      'provider:Proveedor',
      'providerId:ID proveedor',
      'type:Tipo',
      'status:Estado',
      'createdAt:Fecha',
    ]),
    conciliaciones: cols([
      'code:Código',
      'provider:Proveedor',
      'from:Desde',
      'to:Hasta',
      'records:Registros',
      'amount:Monto',
      'differences:Diferencias',
      'status:Estado',
    ]),
    facturas: cols([
      'number:Factura',
      'receipt:Recibo',
      'student:Estudiante',
      'paymentReference:Referencia',
      'amount:Monto',
    ]),
    'proyectos-grado': cols([
      'title:Proyecto',
      'students:Estudiantes',
      'enrollment:Inscripción',
      'area:Área',
      'teachers:Docentes',
      'status:Estado',
    ]),
    docentes: cols(['code:Código', 'name:Docente']),
    'asesores-jurados': cols([
      'name:Docente',
      'role:Participación',
      'project:Proyecto',
      'status:Estado',
    ]),
    configuraciones: cols([
      'key:Clave',
      'value:Valor',
      'type:Tipo',
      'public:Pública',
      'updatedBy:Actualizado por',
      'updatedAt:Fecha',
    ]),
    auditoria: cols([
      'createdAt:Fecha',
      'action:Acción',
      'entity:Entidad',
      'entityId:Registro',
      'user:Usuario',
      'ip:IP',
    ]),
  };
  return map[mode] ?? cols(['id:ID']);
}
function cols(values: string[]) {
  return values.map((entry) => {
    const [key, label] = entry.split(':');
    return { key, label };
  });
}
function readPath(item: Item, key: string) {
  const value = item[key];
  if (key === 'campusCareer' && value && typeof value === 'object')
    return `${(value as Item).campus} · ${(value as Item).career}`;
  if (key === 'offer' && value && typeof value === 'object')
    return `${(value as Item).title ?? (value as Item).offer ?? ''}`;
  if (key === 'enrollment' && value && typeof value === 'object')
    return `${(value as Item).code ?? ''}`;
  if (key === 'student' && value && typeof value === 'object')
    return `${(value as Item).registration ?? ''} · ${(value as Item).name ?? ''}`;
  if (key === 'area' && value && typeof value === 'object') return (value as Item).name;
  if (Array.isArray(value))
    return value
      .map((x) =>
        typeof x === 'object'
          ? String((x as Item).name ?? (x as Item).registration ?? '')
          : String(x),
      )
      .filter(Boolean)
      .join(', ');
  if (key === 'amount' && typeof value === 'number')
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: String(item.currency ?? 'DOP'),
    }).format(value);
  return value;
}
function renderValue(value: unknown) {
  if (value === null || value === undefined || value === '')
    return <span className="text-slate-400">—</span>;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)))
    return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  if (typeof value === 'object')
    return <span className="line-clamp-2">{JSON.stringify(value)}</span>;
  return <span className="line-clamp-2">{String(value)}</span>;
}
function enumOptions(values: string[]): Option[] {
  return values.map((value) => ({ value, label: value.replaceAll('_', ' ') }));
}

function booleanOptions(): Option[] {
  return [
    { value: 'true', label: 'Sí' },
    { value: 'false', label: 'No' },
  ];
}

function canManageMode(mode: OperationsMode, roles: string[], permissions: string[]) {
  if (roles.includes('ADMIN') || permissions.includes('*')) return true;
  const required: Partial<Record<OperationsMode, string>> = {
    modalidades: 'UCOTESIS_OFERTAS_GESTIONAR',
    periodos: 'UCOTESIS_OFERTAS_GESTIONAR',
    'areas-investigacion': 'UCOTESIS_OFERTAS_GESTIONAR',
    requisitos: 'UCOTESIS_OFERTAS_GESTIONAR',
    ofertas: 'UCOTESIS_OFERTAS_GESTIONAR',
    inscripciones: 'INSCRIPCIONES_GESTIONAR',
    sustentantes: 'INSCRIPCIONES_GESTIONAR',
    validaciones: 'INSCRIPCIONES_GESTIONAR',
    'estados-inscripcion': 'INSCRIPCIONES_GESTIONAR',
    documentos: 'INSCRIPCIONES_GESTIONAR',
    'cuentas-bancarias': 'PAGOS_GESTIONAR',
    'metodos-pago': 'PAGOS_GESTIONAR',
    pagos: 'PAGOS_GESTIONAR',
    transacciones: 'PAGOS_GESTIONAR',
    conciliaciones: 'PAGOS_GESTIONAR',
    facturas: 'PAGOS_GESTIONAR',
    'proyectos-grado': 'PROYECTOS_GESTIONAR',
    docentes: 'PROYECTOS_GESTIONAR',
    'asesores-jurados': 'PROYECTOS_GESTIONAR',
    configuraciones: 'GOBIERNO_GESTIONAR',
    auditoria: 'GOBIERNO_GESTIONAR',
  };
  return Boolean(required[mode] && permissions.includes(required[mode]));
}

function canCreateMode(mode: OperationsMode, canManage: boolean, isStudent: boolean) {
  return canManage || (mode === 'proyectos-grado' && isStudent);
}

function rowActions(
  mode: OperationsMode,
  item: Item,
  canManage: boolean,
): Array<{ kind: RowAction; label: string }> {
  const actions: Array<{ kind: RowAction; label: string }> = [{ kind: 'view', label: 'Ver' }];
  if (canManage && mode === 'inscripciones')
    actions.push({ kind: 'status', label: 'Cambiar estado' });
  if (
    (canManage || mode === 'proyectos-grado') &&
    [
      'modalidades',
      'periodos',
      'areas-investigacion',
      'requisitos',
      'ofertas',
      'estados-inscripcion',
      'cuentas-bancarias',
      'metodos-pago',
      'proyectos-grado',
      'configuraciones',
      'validaciones',
    ].includes(mode)
  )
    actions.push({ kind: 'edit', label: 'Editar' });
  if (
    canManage &&
    [
      'modalidades',
      'periodos',
      'areas-investigacion',
      'requisitos',
      'ofertas',
      'cuentas-bancarias',
      'configuraciones',
    ].includes(mode)
  )
    actions.push({ kind: 'delete', label: 'Eliminar' });
  if (canManage && mode === 'sustentantes' && !item.principal)
    actions.push({ kind: 'remove-participant', label: 'Remover' });
  if (canManage && mode === 'asesores-jurados')
    actions.push({ kind: 'remove-assignment', label: 'Remover' });
  if (canManage && mode === 'documentos' && item.status === 'PENDIENTE') {
    actions.push({ kind: 'validate-document', label: 'Validar' });
    actions.push({ kind: 'reject-document', label: 'Rechazar' });
  }
  if (canManage && mode === 'conciliaciones' && item.status !== 'CERRADA')
    actions.push({ kind: 'close-reconciliation', label: 'Cerrar' });
  return actions;
}

function destructiveOperation(
  mode: OperationsMode,
  kind: RowAction,
  item: Item,
): RowOperation | null {
  if (kind === 'remove-participant')
    return {
      path: `/enrollments/${item.enrollmentId}/participants/${item.studentId}`,
      method: 'DELETE',
      confirm: '¿Remover este sustentante de la inscripción?',
    };
  if (kind === 'remove-assignment')
    return {
      path: `/projects/${item.projectId}/teachers/${item.teacherId}/${item.participationTypeId}`,
      method: 'DELETE',
      confirm: '¿Remover esta asignación docente?',
    };
  if (kind === 'validate-document' || kind === 'reject-document')
    return {
      path: `/enrollments/documents/${item.id}`,
      method: 'PATCH',
      body: {
        status: kind === 'validate-document' ? 'VALIDO' : 'RECHAZADO',
        observation:
          kind === 'reject-document' ? 'Documento rechazado durante la revisión.' : undefined,
      },
      confirm: kind === 'reject-document' ? '¿Rechazar este documento?' : undefined,
    };
  if (kind === 'close-reconciliation')
    return {
      path: `/payments/reconciliations/${item.id}`,
      method: 'PATCH',
      body: { status: 'CERRADA' },
      confirm: '¿Cerrar esta conciliación? El cierre quedará auditado.',
    };
  if (kind !== 'delete') return null;
  const deletePaths: Partial<Record<OperationsMode, string>> = {
    modalidades: `/ucotesis/catalogs/modalities/${item.id}`,
    'areas-investigacion': `/ucotesis/catalogs/areas/${item.id}`,
    requisitos: `/ucotesis/catalogs/requirements/${item.id}`,
    periodos: `/ucotesis/periods/${item.id}`,
    ofertas: `/ucotesis/offers/${item.id}`,
    'cuentas-bancarias': `/payments/bank-accounts/${item.id}`,
    configuraciones: `/governance/configurations/${item.id}`,
  };
  const path = deletePaths[mode];
  return path
    ? {
        path,
        method: 'DELETE',
        confirm:
          '¿Eliminar este registro? Si tiene relaciones, SIGMA impedirá el borrado y permitirá inactivarlo.',
      }
    : null;
}

function formFromItem(mode: OperationsMode, item: Item): Record<string, string | string[]> {
  const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
  if (mode in CATALOG_KIND)
    return {
      codigo: text(item.code),
      nombre: text(item.name),
      descripcion: text(item.description),
      estado: text(item.status),
      tipoValidacion: text(item.validationType),
    };
  if (mode === 'periodos')
    return {
      codigo: text(item.code),
      nombre: text(item.name),
      fechaInicio: dateInput(item.startDate),
      fechaFin: dateInput(item.endDate),
      estado: text(item.status),
    };
  if (mode === 'ofertas') {
    const modality = item.modality as Item | undefined;
    const period = item.period as Item | undefined;
    const campusCareer = item.campusCareer as Item | undefined;
    return {
      codigo: text(item.code),
      titulo: text(item.title),
      descripcion: text(item.description),
      recintoCarreraId: text(campusCareer?.id),
      modalidadId: text(modality?.id),
      periodoId: text(period?.id),
      fechaInicioInscripcion: dateTimeInput(item.registrationStart),
      fechaFinInscripcion: dateTimeInput(item.registrationEnd),
      cupoTotal: text(item.capacity),
      monto: text(item.amount),
      estado: text(item.status),
      areaIds: ((item.areas as Item[]) ?? []).map((value) => text(value.id)),
      requisitoIds: ((item.requirements as Item[]) ?? []).map((value) => text(value.id)),
    };
  }
  if (mode === 'estados-inscripcion')
    return {
      code: text(item.code),
      name: text(item.name),
      order: text(item.order),
      final: text(item.final),
      status: text(item.status),
    };
  if (mode === 'cuentas-bancarias')
    return {
      bank: text(item.bank),
      accountNumber: text(item.accountNumber),
      accountType: text(item.accountType),
      documentType: text(item.documentType),
      holderDocument: text(item.holderDocument),
      holderName: text(item.holderName),
      currency: text(item.currency),
      instructions: text(item.instructions),
      status: text(item.status),
    };
  if (mode === 'metodos-pago')
    return { code: text(item.code), name: text(item.name), status: text(item.status) };
  if (mode === 'proyectos-grado')
    return {
      title: text(item.title),
      description: text(item.description),
      areaId: text((item.area as Item | undefined)?.id),
      status: text(item.status),
      startDate: dateInput(item.startDate),
      endDate: dateInput(item.endDate),
    };
  if (mode === 'validaciones')
    return {
      enrollmentId: text(item.enrollmentId),
      requirementId: text(item.requirementId),
      meets: text(item.meets),
      value: text(item.value),
      observation: text(item.observation),
    };
  if (mode === 'configuraciones')
    return {
      key: text(item.key),
      value: text(item.value),
      type: text(item.type),
      description: text(item.description),
      public: text(item.public),
    };
  return {};
}

function DetailView({ item }: { item: Item }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {Object.entries(item).map(([key, value]) => (
        <div key={key} className="rounded-xl border bg-slate-50 p-3">
          <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            {key.replaceAll(/([A-Z])/g, ' $1').replaceAll('_', ' ')}
          </dt>
          <dd className="mt-1 text-sm break-words text-slate-900">
            {typeof value === 'object' && value !== null ? (
              <pre className="overflow-auto whitespace-pre-wrap">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : (
              renderValue(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function dateInput(value: unknown) {
  return value ? new Date(String(value)).toISOString().slice(0, 10) : '';
}
function dateTimeInput(value: unknown) {
  return value ? new Date(String(value)).toISOString().slice(0, 16) : '';
}
function defaultForm(mode: OperationsMode): Record<string, string> {
  return {
    ...(mode === 'cuentas-bancarias' && {
      currency: 'DOP',
      accountType: 'AHORRO',
      documentType: 'CEDULA',
    }),
    ...(mode === 'ofertas' && { estado: 'BORRADOR', moneda: 'DOP' }),
    ...(mode === 'periodos' && { estado: 'PLANIFICADO' }),
    ...(mode === 'metodos-pago' && { status: 'ACTIVO' }),
    ...(mode === 'requisitos' && { tipoValidacion: 'MANUAL' }),
    ...(mode === 'configuraciones' && { type: 'STRING', public: 'false' }),
  };
}
function coerceForm(form: Record<string, string | string[]>, fields: Field[]) {
  return Object.fromEntries(
    fields
      .map((field) => {
        const value = form[field.key];
        if (field.type === 'number' && value !== '') return [field.key, Number(value)];
        if (['final', 'public', 'meets', 'principal'].includes(field.key))
          return [field.key, String(value).toLowerCase() === 'true'];
        if (field.type === 'datetime-local' && value)
          return [field.key, new Date(String(value)).toISOString()];
        return [field.key, value];
      })
      .filter(([, value]) => value !== '' && value !== undefined),
  );
}

function resolveEditorEndpoint(
  mode: OperationsMode,
  editor: Editor,
  item: Item | null,
  form: Record<string, string | string[]>,
) {
  if (mode === 'sustentantes') return `/enrollments/${String(form.enrollmentId)}/participants`;
  if (mode === 'validaciones') return `/enrollments/${String(form.enrollmentId)}/validations`;
  if (mode === 'asesores-jurados') return `/projects/${String(form.projectId)}/teachers`;
  return editor.endpoint(item);
}

function editorPayload(mode: OperationsMode, payload: Record<string, unknown>) {
  const result = { ...payload };
  if (mode === 'sustentantes' || mode === 'validaciones') delete result.enrollmentId;
  if (mode === 'asesores-jurados') delete result.projectId;
  return result;
}
