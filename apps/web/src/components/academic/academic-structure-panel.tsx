'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Upload,
} from 'lucide-react';
import {
  StudyPlanImportDialog,
} from './study-plan-import-dialog';
import {
  BookOpen,
  Building2,
  GraduationCap,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { apiFetch, readApiError } from '@/lib/api';

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
  campus?: string;
  careerId?: string;
  career?: string;
  startYear?: number;
  endYear?: number | null;
  totalCredits?: number | null;
  credits?: number;
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
  }>;
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

async function write(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: object) {
  const response = await apiFetch(path, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(await readApiError(response));
}

export function AcademicStructurePanel({ mode }: { mode: AcademicMode }) {
  const client = useQueryClient();
  const config = MODE_CONFIG[mode];
  const structure = useQuery({ queryKey: ['academic', 'structure'], queryFn: loadStructure });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<AcademicItem | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const items = structure.data?.[config.collection] ?? [];
  const [importOpen, setImportOpen] = useState(false);

  const refresh = () => void client.invalidateQueries({ queryKey: ['academic', 'structure'] });
  const save = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(mode, form);
      const validation = validate(mode, form);
      if (!validation.success) {
        setErrors(validation.errors);
        throw new Error('Revisa los campos indicados.');
      }
      setErrors({});
      await write(
        `/academic/${config.path}${editing ? `/${editing.id}` : ''}`,
        editing ? 'PATCH' : 'POST',
        payload,
      );
      if (mode === 'study-plans' && editing) {
        await write(`/academic/study-plans/${editing.id}/subjects`, 'PUT', {
          items: selectedSubjects.map((subjectId) => ({ subjectId, mandatory: true })),
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Registro actualizado.' : 'Registro creado.');
      reset();
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      write(`/academic/${config.path}/${id}`, 'PATCH', { status }),
    onSuccess: refresh,
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
    });
    setSelectedSubjects(item.subjects?.map((subject) => subject.id) ?? []);
  }

  if (structure.isPending)
    return (
      <p className="rounded-3xl border bg-white p-10 text-center">Cargando estructura académica…</p>
    );
  if (structure.isError)
    return (
      <p role="alert" className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
        {structure.error.message}
      </p>
    );

  return (
    <section className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-bold tracking-widest text-blue-700 uppercase">
          Estructura académica
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">{config.title}</h1>
        <p className="mt-2 text-slate-600">{config.description}</p>

        {mode === 'study-plans' && (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setImportOpen(true)
              }
              className="w-full sm:w-auto"
            >
              <Upload className="size-4" />
              Importar plan
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!editing}
              onClick={() => {
                if (!editing) return;

                window.open(
                  `/api/academic/study-plans/${editing.id}/export`,
                  '_blank',
                );
              }}
            >
              <Download className="size-4" />
              Exportar plan
            </Button>

            {importOpen && (
              <StudyPlanImportDialog
                campuses={
                  structure.data.campuses
                }
                onClose={() =>
                  setImportOpen(false)
                }
                onImported={() => {
                  refresh();
                }}
              />
            )}
          </div>

        )}
      </header>
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{editing ? 'Editar registro' : 'Nuevo registro'}</h2>
          {editing && (
            <button type="button" onClick={reset} className="text-sm font-bold text-slate-500">
              Cancelar
            </button>
          )}
        </div>
        <AcademicForm
          mode={mode}
          form={form}
          setForm={setForm}
          errors={errors}
          structure={structure.data}
        />
        {mode === 'study-plans' && editing && (
          <PlanSubjects
            subjects={structure.data.subjects}
            selected={selectedSubjects}
            onChange={setSelectedSubjects}
          />
        )}
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {editing ? 'Guardar cambios' : 'Crear registro'}
          </Button>
        </div>
      </section>
      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-bold">Registros ({items.length})</h2>
        </div>
        {items.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No existen registros todavía.</p>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
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
                  <select
                    value={item.status}
                    onChange={(event) =>
                      updateStatus.mutate({ id: item.id, status: event.target.value })
                    }
                    className="h-9 rounded-lg border bg-white px-2 text-xs font-bold"
                  >
                    <option>ACTIVO</option>
                    <option>INACTIVO</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"
                  >
                    <Pencil className="size-4" /> Editar
                  </button>
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
}: {
  mode: AcademicMode;
  form: typeof EMPTY_FORM;
  setForm: (value: typeof EMPTY_FORM) => void;
  errors: Record<string, string>;
  structure: AcademicStructure;
}) {
  const update = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm({ ...form, [field]: value });
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        <Field
          label="Créditos"
          type="number"
          value={form.credits}
          error={errors.credits}
          onChange={(value) => update('credits', value)}
        />
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
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="mt-6">
      <h3 className="font-bold">Asignaturas del plan</h3>
      <p className="mt-1 text-sm text-slate-500">
        Selecciona las materias obligatorias usadas por el motor de elegibilidad.
      </p>
      <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto rounded-2xl border p-3 md:grid-cols-2">
        {subjects
          .filter((item) => item.status === 'ACTIVO')
          .map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, item.id]
                      : selected.filter((id) => id !== item.id),
                  )
                }
              />
              <span className="text-sm">
                <strong>{item.code}</strong> · {item.name}
              </span>
            </label>
          ))}
      </div>
    </div>
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
      return { ...common, credits: Number(form.credits) };
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
  if (mode === 'subjects' && (form.credits === '' || Number(form.credits) < 0))
    errors.credits = 'Créditos inválidos.';
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
      return `${item.credits ?? 0} créditos · ${item.studyPlanCount ?? 0} planes`;
  }
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
