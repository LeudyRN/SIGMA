'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Building2,
  Download,
  GraduationCap,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { EntityDialog } from '@/components/ui/entity-dialog';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { FilterSelect, TableFilters } from '@/components/ui/table-filters';
import { apiFetch, readApiError } from '@/lib/api';
import { StudyPlanImportDialog } from './study-plan-import-dialog';

export type AcademicMode =
  'campuses' | 'faculties' | 'schools' | 'careers' | 'campus-careers' | 'study-plans' | 'subjects';

interface AcademicItem {
  id: string;
  code?: string;
  name?: string;
  status: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  facultyId?: string;
  faculty?: string;
  schoolId?: string;
  school?: string;
  academicLevel?: string;
  campusId?: string;
  campusIds?: string[];
  campus?: string;
  careerId?: string;
  career?: string;
  startYear?: number;
  endYear?: number | null;
  totalCredits?: number | null;
  credits?: number;
  theoreticalHours?: number;
  practicalHours?: number;
  careerCount?: number;
  schoolCount?: number;
  campusCount?: number;
  studyPlanCount?: number;
  studentCount?: number;
  offerCount?: number;
  historyCount?: number;
  subjects?: Array<{
    id: string;
    code: string;
    name: string;
    semester: number | null;
    mandatory: boolean;
    credits: number;
    type?: 'REGULAR' | 'OPTATIVA' | 'TESIS';
    prerequisiteText?: string | null;
    equivalenceText?: string | null;
    order?: number | null;
  }>;
}

interface PlanSubjectForm {
  equivalenceText: string;
  mandatory: boolean;
  order: string;
  planCredits: string;
  prerequisiteText: string;
  semester: string;
  subjectId: string;
  type: 'REGULAR' | 'OPTATIVA' | 'TESIS';
}

interface AcademicStructure {
  campuses: AcademicItem[];
  faculties: AcademicItem[];
  schools: AcademicItem[];
  careers: AcademicItem[];
  campusCareers: AcademicItem[];
  studyPlans: AcademicItem[];
  subjects: AcademicItem[];
}

interface SubjectRelations {
  campusIds: Set<string>;
  careerIds: Set<string>;
  facultyIds: Set<string>;
  schoolIds: Set<string>;
}

const MODE_CONFIG: Record<
  AcademicMode,
  { title: string; description: string; collection: keyof AcademicStructure; path: string }
> = {
  campuses: {
    title: 'Recintos',
    description: 'Sedes y recintos habilitados para segmentar la oferta académica.',
    collection: 'campuses',
    path: 'campuses',
  },
  faculties: {
    title: 'Facultades',
    description: 'Unidades académicas que agrupan escuelas y carreras.',
    collection: 'faculties',
    path: 'faculties',
  },
  schools: {
    title: 'Escuelas',
    description: 'Escuelas vinculadas a su facultad institucional.',
    collection: 'schools',
    path: 'schools',
  },
  careers: {
    title: 'Carreras',
    description: 'Programas académicos asociados a escuelas y planes de estudio.',
    collection: 'careers',
    path: 'careers',
  },
  'campus-careers': {
    title: 'Carreras por recinto',
    description: 'Disponibilidad de cada carrera en sedes y recintos.',
    collection: 'campusCareers',
    path: 'campus-careers',
  },
  'study-plans': {
    title: 'Planes de estudio',
    description: 'Versiones del plan y asignaturas obligatorias utilizadas por elegibilidad.',
    collection: 'studyPlans',
    path: 'study-plans',
  },
  subjects: {
    title: 'Asignaturas',
    description: 'Catálogo de materias, créditos e incidencia en el historial académico.',
    collection: 'subjects',
    path: 'subjects',
  },
};

const EMPTY_FORM = {
  code: '',
  name: '',
  address: '',
  phone: '',
  email: '',
  facultyId: '',
  schoolId: '',
  academicLevel: 'GRADO',
  campusId: '',
  careerId: '',
  startYear: String(new Date().getFullYear()),
  endYear: '',
  totalCredits: '',
  credits: '',
  theoreticalHours: '',
  practicalHours: '',
  status: 'ACTIVO',
};
const baseSchema = z.object({
  code: z.string().trim().min(2, 'Código requerido.').max(50),
  name: z.string().trim().min(2, 'Nombre requerido.').max(180),
});

async function loadStructure(): Promise<AcademicStructure> {
  const response = await apiFetch('/academic/structure');
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<AcademicStructure>;
}

async function write<T = unknown>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: object,
): Promise<T | null> {
  const response = await apiFetch(path, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  if (response.status === 204) return null;
  return response.json() as Promise<T>;
}

export function AcademicStructurePanel({ mode }: { mode: AcademicMode }) {
  const client = useQueryClient();
  const config = MODE_CONFIG[mode];
  const structure = useQuery({
    queryKey: ['academic', 'structure'],
    queryFn: loadStructure,
    retry: 2,
    staleTime: 30_000,
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<AcademicItem | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<PlanSubjectForm[]>([]);
  const items = structure.data?.[config.collection] ?? [];
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [relationFilter, setRelationFilter] = useState('');
  const [subjectCampusFilter, setSubjectCampusFilter] = useState('');
  const [subjectFacultyFilter, setSubjectFacultyFilter] = useState('');
  const [subjectSchoolFilter, setSubjectSchoolFilter] = useState('');
  const [subjectCareerFilter, setSubjectCareerFilter] = useState('');
  const subjectRelations = useMemo(() => buildSubjectRelations(structure.data), [structure.data]);

  const refresh = () => void client.invalidateQueries({ queryKey: ['academic', 'structure'] });
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...buildPayload(mode, form),
        ...(editing ? { status: form.status } : {}),
      };
      const validation = validate(mode, form);
      if (!validation.success) {
        setErrors(validation.errors);
        throw new Error('Revisa los campos indicados.');
      }
      setErrors({});
      const result = await write<{ id?: string }>(
        `/academic/${config.path}${editing ? `/${editing.id}` : ''}`,
        editing ? 'PATCH' : 'POST',
        payload,
      );
      const planId = editing?.id ?? result?.id;
      if (mode === 'study-plans' && planId) {
        await write(`/academic/study-plans/${planId}/subjects`, 'PUT', {
          items: selectedSubjects.map((subject) => ({
            subjectId: subject.subjectId,
            mandatory: subject.mandatory,
            semester: subject.semester ? Number(subject.semester) : undefined,
            planCredits: subject.planCredits ? Number(subject.planCredits) : undefined,
            prerequisiteText: subject.prerequisiteText || undefined,
            equivalenceText: subject.equivalenceText || undefined,
            type: subject.type,
            order: subject.order ? Number(subject.order) : undefined,
          })),
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Registro actualizado.' : 'Registro creado.');
      reset();
      setFormOpen(false);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => write(`/academic/${config.path}/${id}`, 'DELETE'),
    onSuccess: () => {
      toast.success('Registro eliminado.');
      setConfirmDelete(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function reset() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedSubjects([]);
    setErrors({});
  }
  function startEdit(item: AcademicItem) {
    setEditing(item);
    setForm({
      code: item.code ?? '',
      name: item.name ?? '',
      address: item.address ?? '',
      phone: item.phone ?? '',
      email: item.email ?? '',
      facultyId: item.facultyId ?? '',
      schoolId: item.schoolId ?? '',
      academicLevel: item.academicLevel ?? 'GRADO',
      campusId: item.campusId ?? '',
      careerId: item.careerId ?? '',
      startYear: item.startYear ? String(item.startYear) : '',
      endYear: item.endYear ? String(item.endYear) : '',
      totalCredits:
        item.totalCredits === null || item.totalCredits === undefined
          ? ''
          : String(item.totalCredits),
      credits: item.credits === undefined ? '' : String(item.credits),
      theoreticalHours: item.theoreticalHours === undefined ? '' : String(item.theoreticalHours),
      practicalHours: item.practicalHours === undefined ? '' : String(item.practicalHours),
      status: item.status,
    });
    setSelectedSubjects(
      item.subjects?.map((subject, index) => ({
        subjectId: subject.id,
        mandatory: subject.mandatory,
        semester: subject.semester ? String(subject.semester) : '',
        planCredits: String(subject.credits),
        prerequisiteText: subject.prerequisiteText ?? '',
        equivalenceText: subject.equivalenceText ?? '',
        type: subject.type ?? 'REGULAR',
        order: subject.order ? String(subject.order) : String(index + 1),
      })) ?? [],
    );
    setFormOpen(true);
  }

  function startCreate() {
    reset();
    setFormOpen(true);
  }

  const filteredItems = items.filter((item) => {
    const query = search.trim().toLocaleLowerCase('es');
    const matchesSearch =
      `${item.code ?? ''} ${item.name ?? ''} ${item.faculty ?? ''} ${item.school ?? ''} ${item.campus ?? ''} ${item.career ?? ''}`
        .toLocaleLowerCase('es')
        .includes(query);
    const subjectRelation = subjectRelations.get(item.id);
    const matchesSubjectRelations =
      mode !== 'subjects' ||
      ((!subjectCampusFilter || subjectRelation?.campusIds.has(subjectCampusFilter)) &&
        (!subjectFacultyFilter || subjectRelation?.facultyIds.has(subjectFacultyFilter)) &&
        (!subjectSchoolFilter || subjectRelation?.schoolIds.has(subjectSchoolFilter)) &&
        (!subjectCareerFilter || subjectRelation?.careerIds.has(subjectCareerFilter)));
    return (
      matchesSearch &&
      (!statusFilter || item.status === statusFilter) &&
      (!relationFilter || relationValue(item, mode) === relationFilter) &&
      matchesSubjectRelations
    );
  });
  const pagination = usePagination(filteredItems, mode === 'subjects' ? 20 : 12);

  const exportPlan = useMutation({
    mutationFn: async (item: AcademicItem) => {
      const response = await apiFetch(`/academic/study-plans/${item.id}/export`);
      if (!response.ok) throw new Error(await readApiError(response));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plan-estudios-${item.code ?? item.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Plan exportado correctamente.'),
    onError: (error: Error) => toast.error(error.message),
  });

  if (structure.isPending)
    return (
      <p className="rounded-3xl border bg-white p-10 text-center">Cargando estructura académica…</p>
    );
  if (structure.isError)
    return (
      <section
        role="alert"
        className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700"
      >
        <h1 className="font-bold">No fue posible cargar {config.title.toLocaleLowerCase('es')}</h1>
        <p className="mt-2 text-sm">{structure.error.message}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => void structure.refetch()}
          disabled={structure.isFetching}
        >
          {structure.isFetching && <LoaderCircle className="size-4 animate-spin" />}
          Reintentar
        </Button>
      </section>
    );

  return (
    <section className="w-full space-y-4 sm:space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold tracking-widest text-blue-700 uppercase">
            Estructura académica
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">{config.title}</h1>
          <p className="mt-2 text-slate-600">{config.description}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" onClick={startCreate}>
            <Plus className="size-4" /> Crear registro
          </Button>
          {mode === 'study-plans' && (
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Importar plan
            </Button>
          )}
        </div>
      </header>

      {importOpen && (
        <StudyPlanImportDialog
          campuses={structure.data.campuses}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            refresh();
          }}
        />
      )}

      <EntityDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          reset();
        }}
        title={editing ? `Editar ${config.title.toLocaleLowerCase('es')}` : `Nuevo registro`}
        description="Los datos se guardan directamente en la estructura académica institucional."
        size={mode === 'study-plans' ? 'xl' : 'lg'}
      >
        <AcademicForm
          mode={mode}
          form={form}
          setForm={setForm}
          errors={errors}
          structure={structure.data}
          editing={Boolean(editing)}
        />
        {mode === 'study-plans' && (
          <PlanSubjects
            subjects={structure.data.subjects}
            selected={selectedSubjects}
            onChange={setSelectedSubjects}
          />
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFormOpen(false);
              reset();
            }}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {editing ? 'Guardar cambios' : 'Crear registro'}
          </Button>
        </div>
      </EntityDialog>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
        <div className="border-b p-5">
          <h2 className="text-lg font-bold">Registros</h2>
        </div>
        <TableFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={`Buscar en ${config.title.toLocaleLowerCase('es')}`}
          totalLabel={`${filteredItems.length} registros`}
          hasActiveFilters={Boolean(
            search ||
            statusFilter ||
            relationFilter ||
            subjectCampusFilter ||
            subjectFacultyFilter ||
            subjectSchoolFilter ||
            subjectCareerFilter,
          )}
          onClear={() => {
            setSearch('');
            setStatusFilter('');
            setRelationFilter('');
            setSubjectCampusFilter('');
            setSubjectFacultyFilter('');
            setSubjectSchoolFilter('');
            setSubjectCareerFilter('');
          }}
        >
          <FilterSelect
            label="Estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'ACTIVO', label: 'Activo' },
              { value: 'INACTIVO', label: 'Inactivo' },
            ]}
          />
          {relationOptions(mode, structure.data).length > 0 && (
            <FilterSelect
              label={relationLabel(mode)}
              value={relationFilter}
              onChange={setRelationFilter}
              options={[
                { value: '', label: `Todas las opciones` },
                ...relationOptions(mode, structure.data),
              ]}
            />
          )}
          {mode === 'subjects' && (
            <>
              <FilterSelect
                label="Facultad"
                value={subjectFacultyFilter}
                onChange={(value) => {
                  setSubjectFacultyFilter(value);
                  setSubjectSchoolFilter('');
                  setSubjectCareerFilter('');
                }}
                options={catalogFilterOptions(structure.data.faculties, 'Todas las facultades')}
              />
              <FilterSelect
                label="Escuela"
                value={subjectSchoolFilter}
                onChange={(value) => {
                  setSubjectSchoolFilter(value);
                  setSubjectCareerFilter('');
                }}
                options={catalogFilterOptions(
                  structure.data.schools.filter(
                    (item) => !subjectFacultyFilter || item.facultyId === subjectFacultyFilter,
                  ),
                  'Todas las escuelas',
                )}
              />
              <FilterSelect
                label="Carrera"
                value={subjectCareerFilter}
                onChange={setSubjectCareerFilter}
                options={catalogFilterOptions(
                  structure.data.careers.filter((item) => {
                    if (subjectSchoolFilter) return item.schoolId === subjectSchoolFilter;
                    if (!subjectFacultyFilter) return true;
                    return structure.data.schools.some(
                      (school) =>
                        school.id === item.schoolId && school.facultyId === subjectFacultyFilter,
                    );
                  }),
                  'Todas las carreras',
                )}
              />
              <FilterSelect
                label="Recinto"
                value={subjectCampusFilter}
                onChange={setSubjectCampusFilter}
                options={catalogFilterOptions(structure.data.campuses, 'Todos los recintos')}
              />
            </>
          )}
        </TableFilters>
        {filteredItems.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No existen registros todavía.</p>
        ) : (
          <div className="grid gap-3 p-3 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
            {pagination.pageItems.map((item) => (
              <article key={item.id} className="rounded-2xl border p-5">
                <div className="flex items-start gap-3">
                  <CatalogIcon mode={mode} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-950">
                      {item.name ?? `${item.campus} · ${item.career}`}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.code ?? secondary(item, mode)}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{secondary(item, mode)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {item.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"
                  >
                    <Pencil className="size-4" /> Editar
                  </button>
                  {mode === 'study-plans' && (
                    <button
                      type="button"
                      onClick={() => exportPlan.mutate(item)}
                      disabled={exportPlan.isPending}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 disabled:opacity-50"
                    >
                      <Download className="size-4" /> Exportar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      confirmDelete === item.id ? remove.mutate(item.id) : setConfirmDelete(item.id)
                    }
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-700"
                  >
                    <Trash2 className="size-4" />
                    {confirmDelete === item.id ? 'Confirmar' : 'Eliminar'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={filteredItems.length}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
          pageSizes={mode === 'subjects' ? [20, 50, 100] : [6, 12, 24]}
        />
      </section>
    </section>
  );
}

function AcademicForm({
  mode,
  form,
  setForm,
  errors,
  structure,
  editing,
}: {
  mode: AcademicMode;
  form: typeof EMPTY_FORM;
  setForm: (value: typeof EMPTY_FORM) => void;
  errors: Record<string, string>;
  structure: AcademicStructure;
  editing: boolean;
}) {
  const update = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm({ ...form, [field]: value });
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {editing && (
        <Choice
          label="Estado"
          value={form.status}
          onChange={(value) => update('status', value)}
          items={[
            { id: 'ACTIVO', name: 'Activo', status: 'ACTIVO' },
            { id: 'INACTIVO', name: 'Inactivo', status: 'ACTIVO' },
          ]}
        />
      )}
      {mode !== 'campus-careers' && (
        <>
          <Field
            label="Código"
            value={form.code}
            error={errors.code}
            onChange={(value) => update('code', value.toUpperCase())}
          />
          <Field
            label="Nombre"
            value={form.name}
            error={errors.name}
            onChange={(value) => update('name', value)}
          />
        </>
      )}
      {mode === 'campuses' && (
        <>
          <Field
            label="Dirección"
            value={form.address}
            onChange={(value) => update('address', value)}
          />
          <Field label="Teléfono" value={form.phone} onChange={(value) => update('phone', value)} />
          <Field
            label="Correo"
            type="email"
            value={form.email}
            error={errors.email}
            onChange={(value) => update('email', value)}
          />
        </>
      )}
      {mode === 'schools' && (
        <Choice
          label="Facultad"
          value={form.facultyId}
          error={errors.facultyId}
          onChange={(value) => update('facultyId', value)}
          items={structure.faculties}
        />
      )}
      {mode === 'careers' && (
        <>
          <Choice
            label="Escuela"
            value={form.schoolId}
            error={errors.schoolId}
            onChange={(value) => update('schoolId', value)}
            items={structure.schools}
          />
          <Field
            label="Nivel académico"
            value={form.academicLevel}
            onChange={(value) => update('academicLevel', value.toUpperCase())}
          />
        </>
      )}
      {mode === 'campus-careers' && (
        <>
          <Choice
            label="Recinto"
            value={form.campusId}
            error={errors.campusId}
            onChange={(value) => update('campusId', value)}
            items={structure.campuses}
          />
          <Choice
            label="Carrera"
            value={form.careerId}
            error={errors.careerId}
            onChange={(value) => update('careerId', value)}
            items={structure.careers}
          />
        </>
      )}
      {mode === 'study-plans' && (
        <>
          <Choice
            label="Carrera"
            value={form.careerId}
            error={errors.careerId}
            onChange={(value) => update('careerId', value)}
            items={structure.careers}
          />
          <Field
            label="Año inicial"
            type="number"
            value={form.startYear}
            error={errors.startYear}
            onChange={(value) => update('startYear', value)}
          />
          <Field
            label="Año final"
            type="number"
            value={form.endYear}
            error={errors.endYear}
            onChange={(value) => update('endYear', value)}
          />
          <Field
            label="Créditos totales"
            type="number"
            value={form.totalCredits}
            onChange={(value) => update('totalCredits', value)}
          />
        </>
      )}
      {mode === 'subjects' && (
        <>
          <Field
            label="Horas teóricas"
            type="number"
            value={form.theoreticalHours}
            error={errors.theoreticalHours}
            onChange={(value) => update('theoreticalHours', value)}
          />
          <Field
            label="Horas prácticas"
            type="number"
            value={form.practicalHours}
            error={errors.practicalHours}
            onChange={(value) => update('practicalHours', value)}
          />
          <Field
            label="Créditos"
            type="number"
            value={form.credits}
            error={errors.credits}
            onChange={(value) => update('credits', value)}
          />
        </>
      )}
    </div>
  );
}

function PlanSubjects({
  subjects,
  selected,
  onChange,
}: {
  subjects: AcademicItem[];
  selected: PlanSubjectForm[];
  onChange: (value: PlanSubjectForm[]) => void;
}) {
  const [search, setSearch] = useState('');
  const selectedIds = new Set(selected.map((item) => item.subjectId));
  const visibleSubjects = subjects.filter(
    (item) =>
      item.status === 'ACTIVO' &&
      `${item.code ?? ''} ${item.name ?? ''}`
        .toLocaleLowerCase('es')
        .includes(search.trim().toLocaleLowerCase('es')),
  );

  const updateSelected = (subjectId: string, changes: Partial<PlanSubjectForm>) =>
    onChange(
      selected.map((item) => (item.subjectId === subjectId ? { ...item, ...changes } : item)),
    );

  return (
    <div className="mt-6">
      <h3 className="font-bold">Asignaturas del plan</h3>
      <p className="mt-1 text-sm text-slate-500">
        Configura semestre, créditos, orden, prerrequisitos y equivalencias. Esta es la misma
        estructura utilizada por la importación del PDF.
      </p>
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar asignatura por clave o nombre"
        className="mt-3 h-11 w-full rounded-xl border px-3 text-sm"
      />
      <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto rounded-2xl border p-3 md:grid-cols-2">
        {visibleSubjects.map((item) => (
          <label key={item.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={selectedIds.has(item.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [
                        ...selected,
                        {
                          subjectId: item.id,
                          mandatory: true,
                          semester: '',
                          planCredits: String(item.credits ?? ''),
                          prerequisiteText: '',
                          equivalenceText: '',
                          type: 'REGULAR',
                          order: String(selected.length + 1),
                        },
                      ]
                    : selected.filter((subject) => subject.subjectId !== item.id),
                )
              }
            />
            <span className="text-sm">
              <strong>{item.code}</strong> · {item.name}
            </span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="mt-4 space-y-3">
          {selected.map((relation) => {
            const subject = subjects.find((item) => item.id === relation.subjectId);
            return (
              <article key={relation.subjectId} className="rounded-2xl border bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-900">
                  {subject?.code} · {subject?.name}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <CompactField
                    label="Semestre"
                    type="number"
                    value={relation.semester}
                    onChange={(value) => updateSelected(relation.subjectId, { semester: value })}
                  />
                  <CompactField
                    label="Créditos del plan"
                    type="number"
                    value={relation.planCredits}
                    onChange={(value) => updateSelected(relation.subjectId, { planCredits: value })}
                  />
                  <CompactField
                    label="Orden"
                    type="number"
                    value={relation.order}
                    onChange={(value) => updateSelected(relation.subjectId, { order: value })}
                  />
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Tipo
                    <select
                      value={relation.type}
                      onChange={(event) =>
                        updateSelected(relation.subjectId, {
                          type: event.target.value as PlanSubjectForm['type'],
                        })
                      }
                      className="h-10 rounded-lg border bg-white px-2 font-normal"
                    >
                      <option value="REGULAR">Regular</option>
                      <option value="OPTATIVA">Optativa</option>
                      <option value="TESIS">Tesis</option>
                    </select>
                  </label>
                  <div className="sm:col-span-2">
                    <CompactField
                      label="Prerrequisitos"
                      value={relation.prerequisiteText}
                      onChange={(value) =>
                        updateSelected(relation.subjectId, { prerequisiteText: value })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <CompactField
                      label="Equivalencias"
                      value={relation.equivalenceText}
                      onChange={(value) =>
                        updateSelected(relation.subjectId, { equivalenceText: value })
                      }
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <input
                      type="checkbox"
                      checked={relation.mandatory}
                      onChange={(event) =>
                        updateSelected(relation.subjectId, { mandatory: event.target.checked })
                      }
                    />
                    Obligatoria
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompactField({
  label,
  onChange,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border bg-white px-2 font-normal"
      />
    </label>
  );
}
function Field({
  label,
  value,
  onChange,
  error,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border px-3 text-sm font-normal"
      />
      {error && <span className="text-red-600">{error}</span>}
    </label>
  );
}
function Choice({
  label,
  value,
  onChange,
  error,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  items: AcademicItem[];
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border bg-white px-3 text-sm font-normal"
      >
        <option value="">Seleccionar</option>
        {items
          .filter((item) => item.status === 'ACTIVO')
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.code ? `${item.code} · ` : ''}
              {item.name}
            </option>
          ))}
      </select>
      {error && <span className="text-red-600">{error}</span>}
    </label>
  );
}

function buildPayload(mode: AcademicMode, form: typeof EMPTY_FORM): object {
  const common = { code: form.code.trim().toUpperCase(), name: form.name.trim() };
  switch (mode) {
    case 'campuses':
      return {
        ...common,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
      };
    case 'faculties':
      return common;
    case 'schools':
      return { ...common, facultyId: form.facultyId };
    case 'careers':
      return { ...common, schoolId: form.schoolId, academicLevel: form.academicLevel || 'GRADO' };
    case 'campus-careers':
      return { campusId: form.campusId, careerId: form.careerId };
    case 'study-plans':
      return {
        ...common,
        careerId: form.careerId,
        startYear: Number(form.startYear),
        endYear: form.endYear ? Number(form.endYear) : undefined,
        totalCredits: form.totalCredits ? Number(form.totalCredits) : undefined,
      };
    case 'subjects':
      return {
        ...common,
        theoreticalHours: Number(form.theoreticalHours || 0),
        practicalHours: Number(form.practicalHours || 0),
        credits: Number(form.credits),
      };
  }
}
function validate(
  mode: AcademicMode,
  form: typeof EMPTY_FORM,
): { success: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (mode !== 'campus-careers') {
    const parsed = baseSchema.safeParse(form);
    if (!parsed.success)
      Object.assign(
        errors,
        Object.fromEntries(
          Object.entries(z.flattenError(parsed.error).fieldErrors).map(([key, value]) => [
            key,
            value?.[0] ?? 'Dato inválido.',
          ]),
        ),
      );
  }
  if (mode === 'campuses' && form.email && !z.email().safeParse(form.email).success)
    errors.email = 'Correo inválido.';
  if (mode === 'schools' && !form.facultyId) errors.facultyId = 'Selecciona una facultad.';
  if (mode === 'careers' && !form.schoolId) errors.schoolId = 'Selecciona una escuela.';
  if (mode === 'campus-careers') {
    if (!form.campusId) errors.campusId = 'Selecciona un recinto.';
    if (!form.careerId) errors.careerId = 'Selecciona una carrera.';
  }
  if (mode === 'study-plans') {
    if (!form.careerId) errors.careerId = 'Selecciona una carrera.';
    if (!form.startYear || Number(form.startYear) < 1900) errors.startYear = 'Año inválido.';
    if (form.endYear && Number(form.endYear) < Number(form.startYear))
      errors.endYear = 'Debe ser mayor o igual al inicial.';
  }
  if (mode === 'subjects') {
    if (form.credits === '' || Number(form.credits) < 0) errors.credits = 'Créditos inválidos.';
    if (Number(form.theoreticalHours || 0) < 0)
      errors.theoreticalHours = 'Las horas no pueden ser negativas.';
    if (Number(form.practicalHours || 0) < 0)
      errors.practicalHours = 'Las horas no pueden ser negativas.';
  }
  return { success: Object.keys(errors).length === 0, errors };
}
function secondary(item: AcademicItem, mode: AcademicMode) {
  switch (mode) {
    case 'campuses':
      return `${item.careerCount ?? 0} carreras · ${item.address ?? 'Sin dirección'}`;
    case 'faculties':
      return `${item.schoolCount ?? 0} escuelas`;
    case 'schools':
      return `${item.faculty} · ${item.careerCount ?? 0} carreras`;
    case 'careers':
      return `${item.faculty} · ${item.school} · ${item.studyPlanCount ?? 0} planes`;
    case 'campus-careers':
      return `${item.studentCount ?? 0} estudiantes · ${item.offerCount ?? 0} ofertas`;
    case 'study-plans':
      return `${item.career} · ${item.startYear}${item.endYear ? `-${item.endYear}` : ''} · ${item.subjects?.length ?? 0} asignaturas`;
    case 'subjects':
      return `${item.credits ?? 0} créditos · HT ${item.theoreticalHours ?? 0} · HP ${item.practicalHours ?? 0} · ${item.studyPlanCount ?? 0} planes`;
  }
}

function relationValue(item: AcademicItem, mode: AcademicMode): string {
  switch (mode) {
    case 'schools':
      return item.facultyId ?? '';
    case 'careers':
      return item.schoolId ?? '';
    case 'campus-careers':
      return item.campusId ?? '';
    case 'study-plans':
      return item.careerId ?? '';
    default:
      return '';
  }
}

function relationLabel(mode: AcademicMode): string {
  if (mode === 'schools') return 'Facultad';
  if (mode === 'careers') return 'Escuela';
  if (mode === 'campus-careers') return 'Recinto';
  if (mode === 'study-plans') return 'Carrera';
  return 'Relación';
}

function relationOptions(
  mode: AcademicMode,
  structure: AcademicStructure,
): Array<{ label: string; value: string }> {
  const source =
    mode === 'schools'
      ? structure.faculties
      : mode === 'careers'
        ? structure.schools
        : mode === 'campus-careers'
          ? structure.campuses
          : mode === 'study-plans'
            ? structure.careers
            : [];
  return source.map((item) => ({
    value: item.id,
    label: item.code ? `${item.code} · ${item.name}` : (item.name ?? item.id),
  }));
}

function catalogFilterOptions(items: AcademicItem[], allLabel: string) {
  return [
    { value: '', label: allLabel },
    ...items.map((item) => ({
      value: item.id,
      label: item.code ? `${item.code} · ${item.name}` : (item.name ?? item.id),
    })),
  ];
}

function buildSubjectRelations(structure?: AcademicStructure) {
  const result = new Map<string, SubjectRelations>();
  if (!structure) return result;

  const careers = new Map(structure.careers.map((career) => [career.id, career]));
  const schools = new Map(structure.schools.map((school) => [school.id, school]));
  const fallbackCampusesByCareer = new Map<string, Set<string>>();

  for (const relation of structure.campusCareers) {
    if (!relation.careerId || !relation.campusId) continue;
    const campuses = fallbackCampusesByCareer.get(relation.careerId) ?? new Set<string>();
    campuses.add(relation.campusId);
    fallbackCampusesByCareer.set(relation.careerId, campuses);
  }

  for (const plan of structure.studyPlans) {
    if (!plan.careerId) continue;
    const career = careers.get(plan.careerId);
    const school = career?.schoolId ? schools.get(career.schoolId) : undefined;
    const campusIds = plan.campusIds?.length
      ? plan.campusIds
      : [...(fallbackCampusesByCareer.get(plan.careerId) ?? [])];

    for (const subject of plan.subjects ?? []) {
      const relations = result.get(subject.id) ?? {
        campusIds: new Set<string>(),
        careerIds: new Set<string>(),
        facultyIds: new Set<string>(),
        schoolIds: new Set<string>(),
      };
      relations.careerIds.add(plan.careerId);
      if (career?.schoolId) relations.schoolIds.add(career.schoolId);
      if (school?.facultyId) relations.facultyIds.add(school.facultyId);
      for (const campusId of campusIds) relations.campusIds.add(campusId);
      result.set(subject.id, relations);
    }
  }

  return result;
}

function CatalogIcon({ mode }: { mode: AcademicMode }) {
  const Icon =
    mode === 'campuses' || mode === 'campus-careers'
      ? MapPin
      : mode === 'study-plans' || mode === 'subjects'
        ? BookOpen
        : mode === 'careers'
          ? GraduationCap
          : Building2;
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
      <Icon className="size-5" />
    </span>
  );
}
