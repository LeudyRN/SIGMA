'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpenCheck,
  Download,
  FileUp,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { EntityDialog } from '@/components/ui/entity-dialog';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { FilterSelect, TableFilters } from '@/components/ui/table-filters';
import { apiFetch, readApiError } from '@/lib/api';
import { humanizeSystemValue } from '@/lib/humanize-system-value';
import { useAuthStore } from '@/store/auth-store';
import { AcademicHistoryImportDialog } from './academic-history-import-dialog';

type WorkspaceMode = 'profiles' | 'careers' | 'history' | 'eligibility';

interface StudentCareer {
  id: string;
  campusCareerId: string;
  studyPlanId: string;
  career: string;
  campus: string;
  studyPlan: string;
  entryDate: string | null;
  graduationDate: string | null;
  status: string;
  primary: boolean;
  historyCount: number;
}

interface Student {
  id: string;
  matricula: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  birthDate: string | null;
  status: string;
  role: { id: string; code: string; name: string } | null;
  careers: StudentCareer[];
}

interface Catalogs {
  role: { id: string; code: string; name: string } | null;
  campusCareers: Array<{ id: string; careerId: string; career: string; campus: string }>;
  studyPlans: Array<{ id: string; careerId: string; code: string; name: string }>;
  subjects: Array<{ id: string; code: string; name: string; credits: number }>;
  planSubjects: Array<{ studyPlanId: string; subjectId: string }>;
}

interface HistoryItem {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  periodCode: string;
  grade: number | null;
  laboratoryGrade: number | null;
  laboratoryGradeText: string | null;
  status: string;
  source: string | null;
}

interface Eligibility {
  eligible: boolean;
  completionPercentage: number;
  reason: string;
  requiredSubjects?: number;
  completedSubjects?: number;
  electiveCredits?: {
    completed: number;
    earned: number;
    pending: number;
    required: number;
  };
  graduationRequirements?: Array<{
    code: string;
    credits: number;
    id: string;
    name: string;
  }>;
  pendingSubjects: Array<{ id: string; code: string; name: string; credits: number }>;
  career?: { name: string; campus: string; studyPlan: string };
  evaluatedAt?: string;
}

const profileSchema = z.object({
  matricula: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{3,30}$/, 'Matrícula inválida.'),
  firstName: z.string().trim().min(2, 'Nombres requeridos.'),
  lastName: z.string().trim().min(2, 'Apellidos requeridos.'),
  email: z.string().trim().email('Correo inválido.'),
  password: z.string().min(12, 'Usa al menos 12 caracteres.'),
  phone: z.string().trim().max(30),
  whatsapp: z.string().trim().max(30),
});

async function read<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<T>;
}

async function write(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: object) {
  const response = await apiFetch(path, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.status === 204 ? null : response.json();
}

const MODE_COPY: Record<WorkspaceMode, { title: string; description: string }> = {
  profiles: {
    title: 'Perfiles de estudiantes',
    description:
      'Cuentas estudiantiles identificadas por matrícula y vinculadas exclusivamente al rol Estudiante.',
  },
  careers: {
    title: 'Carreras del estudiante',
    description: 'Asocia recinto, carrera, plan de estudio, fechas y estado académico.',
  },
  history: {
    title: 'Historial académico',
    description:
      'Registra asignaturas, períodos, calificaciones y resultados reales del expediente.',
  },
  eligibility: {
    title: 'Elegibilidad académica',
    description:
      'Evalúa automáticamente el 100% del plan y detecta materias pendientes o reprobadas.',
  },
};

export function StudentsWorkspace({ mode }: { mode: WorkspaceMode }) {
  const user = useAuthStore((state) => state.user);
  const isStudent = user?.roles.some((role) => role.code === 'ESTUDIANTE');
  return isStudent ? (
    <StudentSelfWorkspace mode={mode} />
  ) : (
    <ManagedStudentsWorkspace mode={mode} />
  );
}

function ManagedStudentsWorkspace({ mode }: { mode: WorkspaceMode }) {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const students = useQuery({
    queryKey: ['students', search],
    queryFn: () =>
      read<{ items: Student[]; total: number }>(
        `/students${search ? `?search=${encodeURIComponent(search)}` : ''}`,
      ),
    placeholderData: (previous) => previous,
  });
  const catalogs = useQuery({
    queryKey: ['students', 'catalogs'],
    queryFn: () => read<Catalogs>('/students/catalogs'),
  });
  const copy = MODE_COPY[mode];

  function refresh() {
    void client.invalidateQueries({ queryKey: ['students'] });
  }

  return (
    <section className="w-full space-y-4 sm:space-y-6">
      <header className="rounded-2xl border bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
        <p className="text-sm font-bold tracking-widest text-blue-700 uppercase">Estudiantes</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">{copy.title}</h1>
        <p className="mt-2 max-w-3xl text-slate-600">{copy.description}</p>
      </header>

      {mode === 'profiles' ? (
        <Profiles
          students={students.data?.items ?? []}
          role={catalogs.data?.role ?? null}
          refresh={refresh}
        />
      ) : (
        <>
          {mode !== 'history' && mode !== 'eligibility' && (
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <TableFilters
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Matrícula, nombre o correo del estudiante"
                totalLabel={`${students.data?.total ?? 0} estudiantes`}
                hasActiveFilters={Boolean(search)}
                onClear={() => setSearch('')}
              />
            </div>
          )}
          {mode === 'careers' && (
            <Careers
              students={students.data?.items ?? []}
              catalogs={catalogs.data}
              refresh={refresh}
            />
          )}
          {mode === 'history' && (
            <History
              students={students.data?.items ?? []}
              catalogs={catalogs.data}
              onStudentSearch={setSearch}
              refresh={refresh}
            />
          )}
          {mode === 'eligibility' && (
            <EligibilityPanel students={students.data?.items ?? []} onStudentSearch={setSearch} />
          )}
        </>
      )}
      {(students.isPending || catalogs.isPending) && (
        <p className="rounded-2xl border bg-white p-6 text-center text-slate-500">
          Cargando información…
        </p>
      )}
      {(students.isError || catalogs.isError) && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          No fue posible cargar el módulo desde la base de datos.
        </p>
      )}
    </section>
  );
}

function Profiles({
  students,
  role,
  refresh,
}: {
  students: Student[];
  role: Catalogs['role'];
  refresh: () => void;
}) {
  const empty = {
    matricula: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    whatsapp: '',
  };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Student | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const save = useMutation({
    mutationFn: () => {
      const schema = editing
        ? profileSchema.extend({
            password: z
              .string()
              .refine((value) => !value || value.length >= 12, 'Usa al menos 12 caracteres.'),
          })
        : profileSchema;
      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        setErrors(
          Object.fromEntries(
            Object.entries(z.flattenError(parsed.error).fieldErrors).map(([key, value]) => [
              key,
              value?.[0] ?? 'Dato inválido.',
            ]),
          ),
        );
        throw new Error('Revisa los campos indicados.');
      }
      setErrors({});
      return write(editing ? `/students/${editing.id}` : '/students', editing ? 'PATCH' : 'POST', {
        ...parsed.data,
        ...(!parsed.data.password ? { password: undefined } : {}),
      });
    },
    onSuccess: () => {
      toast.success(editing ? 'Perfil estudiantil actualizado.' : 'Perfil estudiantil creado.');
      setForm(empty);
      setEditing(null);
      setFormOpen(false);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => write(`/students/${id}`, 'DELETE'),
    onSuccess: () => {
      toast.success('Perfil desactivado.');
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const visible = students.filter(
    (student) =>
      (!statusFilter || student.status === statusFilter) &&
      `${student.matricula} ${student.name} ${student.email}`
        .toLocaleLowerCase('es')
        .includes(search.trim().toLocaleLowerCase('es')),
  );
  const pagination = usePagination(visible);

  function editProfile(student: Student) {
    setEditing(student);
    setForm({
      matricula: student.matricula,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      password: '',
      phone: student.phone ?? '',
      whatsapp: student.whatsapp ?? '',
    });
    setFormOpen(true);
  }

  function createProfile() {
    setEditing(null);
    setForm(empty);
    setErrors({});
    setFormOpen(true);
  }

  return (
    <>
      <EntityDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar perfil estudiantil' : 'Nuevo perfil estudiantil'}
        description="La cuenta se vinculará exclusivamente al rol Estudiante y a su matrícula institucional."
        size="lg"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Matrícula"
            value={form.matricula}
            error={errors.matricula}
            onChange={(value) => setForm({ ...form, matricula: value.toUpperCase() })}
          />
          <Input
            label="Nombres"
            value={form.firstName}
            error={errors.firstName}
            onChange={(value) => setForm({ ...form, firstName: value })}
          />
          <Input
            label="Apellidos"
            value={form.lastName}
            error={errors.lastName}
            onChange={(value) => setForm({ ...form, lastName: value })}
          />
          <Input
            label="Correo"
            type="email"
            value={form.email}
            error={errors.email}
            onChange={(value) => setForm({ ...form, email: value })}
          />
          <Input
            label={editing ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}
            type="password"
            value={form.password}
            error={errors.password}
            onChange={(value) => setForm({ ...form, password: value })}
          />
          <Input
            label="Teléfono"
            value={form.phone}
            error={errors.phone}
            onChange={(value) => setForm({ ...form, phone: value })}
          />
          <Input
            label="WhatsApp"
            value={form.whatsapp}
            error={errors.whatsapp}
            onChange={(value) => setForm({ ...form, whatsapp: value })}
          />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || !role}>
            {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
            {editing ? 'Guardar cambios' : 'Crear estudiante'}
          </Button>
        </div>
      </EntityDialog>
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-xl font-bold">Perfiles registrados</h2>
            <p className="mt-1 text-xs font-semibold text-blue-700">
              Rol: {role?.name ?? 'ESTUDIANTE no configurado'}
            </p>
          </div>
          <Button type="button" onClick={createProfile} disabled={!role}>
            <Plus className="size-4" /> Crear estudiante
          </Button>
        </div>
        <TableFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Matrícula, nombre o correo"
          totalLabel={`${visible.length} estudiantes`}
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
              { value: 'ACTIVO', label: 'Activo' },
              { value: 'INACTIVO', label: 'Inactivo' },
            ]}
          />
        </TableFilters>
        <div className="responsive-table max-w-full overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="p-4">Estudiante</th>
                <th className="p-4">Matrícula</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Carreras</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Acción</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((student) => (
                <tr key={student.id} className="border-t">
                  <td className="p-4">
                    <strong>{student.name}</strong>
                    <span className="block text-slate-500">{student.email}</span>
                  </td>
                  <td className="p-4 font-semibold">{student.matricula}</td>
                  <td className="p-4">{student.role?.name ?? 'Sin rol'}</td>
                  <td className="p-4">{student.careers.length}</td>
                  <td className="p-4">{humanizeSystemValue(student.status)}</td>
                  <td className="p-4">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => editProfile(student)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"
                      >
                        <Pencil className="size-4" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deactivate.mutate(student.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-red-700"
                      >
                        <Trash2 className="size-4" /> Desactivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={visible.length}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </section>
    </>
  );
}

function Careers({
  students,
  catalogs,
  refresh,
}: {
  students: Student[];
  catalogs?: Catalogs;
  refresh: () => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [campusCareerId, setCampusCareerId] = useState('');
  const [studyPlanId, setStudyPlanId] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [graduationDate, setGraduationDate] = useState('');
  const [primary, setPrimary] = useState(true);
  const [careerFormStatus, setCareerFormStatus] = useState('ACTIVA');
  const [editingCareer, setEditingCareer] = useState<StudentCareer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [careerSearch, setCareerSearch] = useState('');
  const [careerStatus, setCareerStatus] = useState('');
  const selectedCampusCareer = catalogs?.campusCareers.find((item) => item.id === campusCareerId);
  const plans =
    catalogs?.studyPlans.filter((plan) => plan.careerId === selectedCampusCareer?.careerId) ?? [];
  const save = useMutation({
    mutationFn: () => {
      if (!studentId || !campusCareerId || !studyPlanId)
        throw new Error('Selecciona estudiante, recinto/carrera y plan.');
      return write(
        editingCareer ? `/students/careers/${editingCareer.id}` : `/students/${studentId}/careers`,
        editingCareer ? 'PATCH' : 'POST',
        {
          campusCareerId,
          studyPlanId,
          entryDate: entryDate || undefined,
          graduationDate: graduationDate || undefined,
          primary,
          ...(editingCareer ? { status: careerFormStatus } : {}),
        },
      );
    },
    onSuccess: () => {
      toast.success(editingCareer ? 'Carrera actualizada.' : 'Carrera asociada.');
      setCampusCareerId('');
      setStudyPlanId('');
      setEntryDate('');
      setGraduationDate('');
      setPrimary(true);
      setCareerFormStatus('ACTIVA');
      setEditingCareer(null);
      setFormOpen(false);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  function openCareerCreate() {
    setEditingCareer(null);
    setCampusCareerId('');
    setStudyPlanId('');
    setEntryDate('');
    setGraduationDate('');
    setPrimary(true);
    setCareerFormStatus('ACTIVA');
    setFormOpen(true);
  }

  function openCareerEdit(career: StudentCareer, ownerId: string) {
    setStudentId(ownerId);
    setEditingCareer(career);
    setCampusCareerId(career.campusCareerId);
    setStudyPlanId(career.studyPlanId);
    setEntryDate(career.entryDate?.slice(0, 10) ?? '');
    setGraduationDate(career.graduationDate?.slice(0, 10) ?? '');
    setPrimary(career.primary);
    setCareerFormStatus(career.status);
    setFormOpen(true);
  }
  const filteredStudents = students.filter((item) =>
    `${item.matricula} ${item.name}`
      .toLocaleLowerCase('es')
      .includes(studentSearch.trim().toLocaleLowerCase('es')),
  );
  const careerRows = students
    .flatMap((owner) => owner.careers.map((career) => ({ career, owner })))
    .filter(({ career, owner }) => {
      const studentTerm = studentSearch.trim().toLocaleLowerCase('es');
      const careerTerm = careerSearch.trim().toLocaleLowerCase('es');
      const matchesStudent = `${owner.matricula} ${owner.name}`
        .toLocaleLowerCase('es')
        .includes(studentTerm);
      const matchesCareer = `${career.career} ${career.campus} ${career.studyPlan}`
        .toLocaleLowerCase('es')
        .includes(careerTerm);
      return (
        (!studentId || owner.id === studentId) &&
        matchesStudent &&
        matchesCareer &&
        (!careerStatus || career.status === careerStatus)
      );
    });
  const pagination = usePagination(careerRows);
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-xl font-bold">Expediente de carreras</h2>
          <p className="mt-1 text-sm text-slate-500">
            Selecciona un estudiante para consultar y mantener sus asociaciones.
          </p>
        </div>
        <Button type="button" onClick={openCareerCreate}>
          <Plus className="size-4" /> Asociar carrera
        </Button>
      </div>
      <TableFilters
        search={studentSearch}
        onSearchChange={(value) => {
          setStudentSearch(value);
          setStudentId('');
        }}
        searchPlaceholder="Buscar estudiante por matrícula o nombre"
        totalLabel={`${filteredStudents.length} estudiantes`}
        hasActiveFilters={Boolean(studentSearch || studentId)}
        onClear={() => {
          setStudentSearch('');
          setStudentId('');
        }}
      >
        <FilterSelect
          label="Estudiante"
          value={studentId}
          onChange={(value) => {
            setStudentId(value);
            setCareerSearch('');
            setCareerStatus('');
          }}
          options={[
            { value: '', label: 'Selecciona un estudiante' },
            ...filteredStudents.map((item) => ({
              value: item.id,
              label: `${item.matricula} · ${item.name}`,
            })),
          ]}
        />
      </TableFilters>
      <TableFilters
        search={careerSearch}
        onSearchChange={setCareerSearch}
        searchPlaceholder="Buscar por carrera, recinto o plan"
        totalLabel={`${careerRows.length} asociaciones`}
        hasActiveFilters={Boolean(careerSearch || careerStatus)}
        onClear={() => {
          setCareerSearch('');
          setCareerStatus('');
        }}
      >
        <FilterSelect
          label="Estado de la carrera"
          value={careerStatus}
          onChange={setCareerStatus}
          options={[
            { value: '', label: 'Todos los estados' },
            { value: 'ACTIVA', label: 'Activa' },
            { value: 'FINALIZADA', label: 'Finalizada' },
            { value: 'SUSPENDIDA', label: 'Suspendida' },
            { value: 'RETIRADA', label: 'Retirada' },
          ]}
        />
      </TableFilters>
      <EntityDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCareer ? 'Editar carrera estudiantil' : 'Asociar carrera'}
        description="Vincula el recinto, la carrera y un plan de estudios compatible."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Estudiante"
            value={studentId}
            onChange={setStudentId}
            options={students.map((item) => ({
              value: item.id,
              label: `${item.matricula} · ${item.name}`,
            }))}
          />
          <Select
            label="Recinto y carrera"
            value={campusCareerId}
            onChange={(value) => {
              setCampusCareerId(value);
              setStudyPlanId('');
            }}
            options={(catalogs?.campusCareers ?? []).map((item) => ({
              value: item.id,
              label: `${item.campus} · ${item.career}`,
            }))}
          />
          <Select
            label="Plan de estudio"
            value={studyPlanId}
            onChange={setStudyPlanId}
            options={plans.map((item) => ({
              value: item.id,
              label: `${item.code} · ${item.name}`,
            }))}
          />
          <Input label="Fecha de ingreso" type="date" value={entryDate} onChange={setEntryDate} />
          <Input
            label="Fecha de egreso"
            type="date"
            value={graduationDate}
            onChange={setGraduationDate}
          />
          {editingCareer && (
            <Select
              label="Estado"
              value={careerFormStatus}
              onChange={setCareerFormStatus}
              options={[
                { value: 'ACTIVA', label: 'Activa' },
                { value: 'FINALIZADA', label: 'Finalizada' },
                { value: 'SUSPENDIDA', label: 'Suspendida' },
                { value: 'RETIRADA', label: 'Retirada' },
              ]}
            />
          )}
          <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={primary}
              onChange={(event) => setPrimary(event.target.checked)}
              className="size-4"
            />
            Carrera principal
          </label>
          <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
              {editingCareer ? 'Guardar cambios' : 'Asociar carrera'}
            </Button>
          </div>
        </div>
      </EntityDialog>
      <div className="p-3 sm:p-5">
        {careerRows.length === 0 ? (
          <Empty text="No hay carreras estudiantiles que coincidan con los filtros aplicados." />
        ) : (
          <div className="space-y-3">
            {pagination.pageItems.map(({ career, owner }) => (
              <article key={career.id} className="rounded-2xl border p-4">
                <div className="flex items-start gap-3">
                  <GraduationCap className="mt-1 size-5 text-blue-700" />
                  <div className="flex-1">
                    <strong>{career.career}</strong>
                    <p className="mt-1 text-xs font-bold text-blue-700">
                      {owner.matricula} · {owner.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {career.campus} · {career.studyPlan}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {career.historyCount} registros académicos{' '}
                      {career.primary ? '· Carrera principal' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">
                      {humanizeSystemValue(career.status)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openCareerEdit(career, owner.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"
                    >
                      <Pencil className="size-4" /> Editar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={careerRows.length}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </section>
  );
}

function History({
  students,
  catalogs,
  onStudentSearch,
  refresh,
}: {
  students: Student[];
  catalogs?: Catalogs;
  onStudentSearch: (value: string) => void;
  refresh: () => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [careerId, setCareerId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [periodCode, setPeriodCode] = useState('');
  const [grade, setGrade] = useState('');
  const [laboratoryGrade, setLaboratoryGrade] = useState('');
  const [status, setStatus] = useState('APROBADA');
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingHistory, setEditingHistory] = useState<HistoryItem | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const student = students.find((item) => item.id === studentId);
  const selectedCareer = student?.careers.find((item) => item.id === careerId);
  const allowedSubjectIds = new Set(
    catalogs?.planSubjects
      .filter((item) => item.studyPlanId === selectedCareer?.studyPlanId)
      .map((item) => item.subjectId) ?? [],
  );
  const history = useQuery({
    queryKey: ['students', 'history', careerId],
    queryFn: () => read<{ items: HistoryItem[] }>(`/students/careers/${careerId}/history`),
    enabled: Boolean(careerId),
  });
  const save = useMutation({
    mutationFn: () => {
      if (!careerId || !subjectId || !periodCode)
        throw new Error('Completa carrera, asignatura y período.');
      const parsedGrade = grade ? Number(grade) : null;
      const parsedLaboratoryGrade = parseLaboratoryGrade(laboratoryGrade);
      if (laboratoryGrade && parsedLaboratoryGrade === null) {
        throw new Error('La nota de laboratorio debe usar el formato L00 y estar entre L0 y L30.');
      }
      const effectiveStatus =
        parsedGrade !== null
          ? parsedGrade >= 70
            ? 'APROBADA'
            : 'REPROBADA'
          : parsedLaboratoryGrade !== null
            ? parsedLaboratoryGrade >= 21
              ? 'APROBADA'
              : 'REPROBADA'
            : status;
      return write(
        editingHistory
          ? `/students/history/${editingHistory.id}`
          : `/students/careers/${careerId}/history`,
        editingHistory ? 'PATCH' : 'POST',
        {
          subjectId,
          periodCode,
          grade: parsedGrade,
          laboratoryGrade: parsedLaboratoryGrade,
          status: effectiveStatus,
          source: 'REGISTRO_SIGMA',
        },
      );
    },
    onSuccess: () => {
      toast.success('Historial actualizado.');
      setSubjectId('');
      setGrade('');
      setLaboratoryGrade('');
      setEditingHistory(null);
      setFormOpen(false);
      void history.refetch();
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => write(`/students/history/${id}`, 'DELETE'),
    onSuccess: () => void history.refetch(),
    onError: (error: Error) => toast.error(error.message),
  });
  const exportHistory = useMutation({
    mutationFn: async () => {
      if (!careerId) throw new Error('Selecciona una carrera para exportar el histórico.');
      const response = await apiFetch(`/students/careers/${careerId}/history/export`);
      if (!response.ok) throw new Error(await readApiError(response));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `historico-academico-${student?.matricula ?? careerId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const filteredHistory =
    history.data?.items.filter(
      (item) =>
        (!historyStatus || item.status === historyStatus) &&
        `${item.subjectCode} ${item.subjectName} ${item.periodCode}`
          .toLocaleLowerCase('es')
          .includes(historySearch.trim().toLocaleLowerCase('es')),
    ) ?? [];
  const pagination = usePagination(filteredHistory);

  function editHistory(item: HistoryItem) {
    setEditingHistory(item);
    setSubjectId(item.subjectId);
    setPeriodCode(item.periodCode);
    setGrade(item.grade === null ? '' : String(item.grade));
    setLaboratoryGrade(item.laboratoryGradeText ?? '');
    setStatus(item.status);
    setFormOpen(true);
  }

  function createHistory() {
    setEditingHistory(null);
    setSubjectId('');
    setPeriodCode('');
    setGrade('');
    setLaboratoryGrade('');
    setStatus('APROBADA');
    setFormOpen(true);
  }
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-xl font-bold">Registros académicos</h2>
            <p className="mt-1 text-sm text-slate-500">
              Selecciona un expediente y administra sus asignaturas cursadas.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(true)}
              disabled={!careerId}
            >
              <FileUp className="size-4" /> Importar PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => exportHistory.mutate()}
              disabled={!careerId || exportHistory.isPending}
            >
              {exportHistory.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Exportar PDF
            </Button>
            <Button type="button" onClick={createHistory} disabled={!careerId}>
              <Plus className="size-4" /> Agregar registro
            </Button>
          </div>
        </div>
        <div className="grid gap-3 border-b bg-slate-50/70 p-3 sm:grid-cols-2 sm:p-4">
          <SearchableSelect
            label="Estudiante"
            value={studentId}
            onSearchChange={onStudentSearch}
            searchPlaceholder="Buscar por matrícula o nombre"
            onChange={(value) => {
              setStudentId(value);
              setCareerId('');
            }}
            options={students.map((item) => ({
              value: item.id,
              label: `${item.matricula} · ${item.name}`,
              searchText: `${item.matricula} ${item.name}`,
            }))}
          />
          <Select
            label="Carrera / plan"
            value={careerId}
            onChange={setCareerId}
            options={(student?.careers ?? []).map((item) => ({
              value: item.id,
              label: `${item.career} · ${item.studyPlan}`,
            }))}
          />
        </div>
        <EntityDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title={editingHistory ? 'Editar registro académico' : 'Nuevo registro académico'}
          description="La asignatura debe pertenecer al plan de estudios asociado al estudiante."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SearchableSelect
              label="Estudiante"
              value={studentId}
              onSearchChange={onStudentSearch}
              searchPlaceholder="Buscar por matrícula o nombre"
              onChange={(value) => {
                setStudentId(value);
                setCareerId('');
              }}
              options={students.map((item) => ({
                value: item.id,
                label: `${item.matricula} · ${item.name}`,
                searchText: `${item.matricula} ${item.name}`,
              }))}
            />
            <Select
              label="Carrera / plan"
              value={careerId}
              onChange={setCareerId}
              options={(student?.careers ?? []).map((item) => ({
                value: item.id,
                label: `${item.career} · ${item.studyPlan}`,
              }))}
            />
            <Select
              label="Asignatura"
              value={subjectId}
              onChange={setSubjectId}
              options={(catalogs?.subjects ?? [])
                .filter((item) => allowedSubjectIds.has(item.id))
                .map((item) => ({
                  value: item.id,
                  label: `${item.code} · ${item.name}`,
                }))}
            />
            <Input
              label="Período"
              value={periodCode}
              onChange={(value) => setPeriodCode(value.toUpperCase())}
            />
            <Input label="Calificación" type="number" value={grade} onChange={setGrade} />
            <Input
              label="Laboratorio (ej. L23)"
              value={laboratoryGrade}
              onChange={(value) => setLaboratoryGrade(value.toUpperCase())}
            />
            <Select
              label="Resultado"
              value={status}
              onChange={setStatus}
              options={[
                'APROBADA',
                'REPROBADA',
                'RETIRADA',
                'CURSANDO',
                'PENDIENTE',
                'CONVALIDADA',
              ].map((value) => ({ value, label: value }))}
            />
            <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
                {editingHistory ? 'Guardar cambios' : 'Agregar registro'}
              </Button>
            </div>
          </div>
        </EntityDialog>
        {importOpen && careerId && (
          <AcademicHistoryImportDialog
            careerId={careerId}
            onClose={() => setImportOpen(false)}
            onImported={() => {
              void history.refetch();
              refresh();
            }}
          />
        )}
        <TableFilters
          search={historySearch}
          onSearchChange={setHistorySearch}
          searchPlaceholder="Clave, asignatura o período"
          totalLabel={`${filteredHistory.length} registros`}
          hasActiveFilters={Boolean(historySearch || historyStatus)}
          onClear={() => {
            setHistorySearch('');
            setHistoryStatus('');
          }}
        >
          <FilterSelect
            label="Resultado"
            value={historyStatus}
            onChange={setHistoryStatus}
            options={[
              { value: '', label: 'Todos los resultados' },
              ...['APROBADA', 'REPROBADA', 'RETIRADA', 'CURSANDO', 'PENDIENTE', 'CONVALIDADA'].map(
                (value) => ({ value, label: value }),
              ),
            ]}
          />
        </TableFilters>
        <div className="responsive-table max-w-full overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="p-4">Asignatura</th>
                <th className="p-4">Período</th>
                <th className="p-4">Calificación</th>
                <th className="p-4">Resultado</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-4">
                    <strong>{item.subjectCode}</strong>
                    <span className="block text-slate-500">{item.subjectName}</span>
                  </td>
                  <td className="p-4">{item.periodCode}</td>
                  <td className="p-4">
                    <span>{item.grade ?? '—'}</span>
                    {item.laboratoryGradeText && (
                      <span className="block text-xs font-semibold text-blue-700">
                        Laboratorio: {item.laboratoryGradeText}
                      </span>
                    )}
                  </td>
                  <td className="p-4 font-semibold">{humanizeSystemValue(item.status)}</td>
                  <td className="p-4">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => editHistory(item)}
                        className="text-blue-700"
                        aria-label={`Editar ${item.subjectCode}`}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove.mutate(item.id)}
                        className="text-red-700"
                        aria-label={`Eliminar ${item.subjectCode}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!careerId && <Empty text="Selecciona una carrera para consultar el historial." />}
        </div>
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={filteredHistory.length}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </section>
    </div>
  );
}

function EligibilityPanel({
  students,
  onStudentSearch,
}: {
  students: Student[];
  onStudentSearch: (value: string) => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [careerId, setCareerId] = useState('');
  const [requested, setRequested] = useState(false);
  const student = students.find((item) => item.id === studentId);
  const eligibility = useQuery({
    queryKey: ['students', 'eligibility', studentId, careerId],
    queryFn: () =>
      read<Eligibility>(
        `/students/${studentId}/eligibility${careerId ? `?careerId=${careerId}` : ''}`,
      ),
    enabled: requested && Boolean(studentId),
  });
  const result = eligibility.data;
  const pendingPagination = usePagination(result?.pendingSubjects ?? [], 10);
  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Evaluar expediente</h2>
        <div className="mt-5 grid gap-4">
          <SearchableSelect
            label="Estudiante"
            value={studentId}
            onSearchChange={onStudentSearch}
            searchPlaceholder="Buscar por matrícula o nombre"
            onChange={(value) => {
              setStudentId(value);
              setCareerId('');
              setRequested(false);
            }}
            options={students.map((item) => ({
              value: item.id,
              label: `${item.matricula} · ${item.name}`,
              searchText: `${item.matricula} ${item.name}`,
            }))}
          />
          <Select
            label="Carrera"
            value={careerId}
            onChange={(value) => {
              setCareerId(value);
              setRequested(false);
            }}
            options={(student?.careers ?? []).map((item) => ({
              value: item.id,
              label: `${item.career} · ${item.studyPlan}`,
            }))}
          />
          <Button
            type="button"
            onClick={() => {
              pendingPagination.setPage(1);
              setRequested(true);
              void eligibility.refetch();
            }}
            disabled={!studentId || eligibility.isFetching}
          >
            <BookOpenCheck className="size-4" /> Evaluar elegibilidad
          </Button>
        </div>
      </section>
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        {!result ? (
          <Empty text="Selecciona un estudiante para calcular su condición académica." />
        ) : (
          <>
            <div
              className={`rounded-2xl p-5 ${result.eligible ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
            >
              <p className="text-xs font-bold uppercase">
                {result.eligible ? 'Elegible' : 'No elegible'}
              </p>
              <p className="mt-2 text-4xl font-bold tabular-nums">{result.completionPercentage}%</p>
              <p className="mt-2 text-sm">{result.reason}</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Metric label="Requisitos del plan" value={result.requiredSubjects ?? 0} />
              <Metric label="Cumplidos" value={result.completedSubjects ?? 0} />
            </div>
            {result.electiveCredits && result.electiveCredits.required > 0 && (
              <ElectiveCreditProgress credits={result.electiveCredits} />
            )}
            {result.graduationRequirements && result.graduationRequirements.length > 0 && (
              <GraduationEnrollmentRequirement items={result.graduationRequirements} />
            )}
            <div className="mt-5">
              <h3 className="font-bold">Asignaturas pendientes</h3>
              {result.pendingSubjects.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No hay asignaturas pendientes.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {pendingPagination.pageItems.map((item) => (
                    <div key={item.id} className="rounded-xl border p-3 text-sm">
                      <strong>{item.code}</strong> · {item.name}
                    </div>
                  ))}
                </div>
              )}
              {result.pendingSubjects.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-xl border">
                  <Pagination
                    page={pendingPagination.page}
                    pageSize={pendingPagination.pageSize}
                    total={result.pendingSubjects.length}
                    onPageChange={pendingPagination.setPage}
                    onPageSizeChange={pendingPagination.setPageSize}
                    pageSizes={[10, 20, 50]}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function StudentSelfWorkspace({ mode }: { mode: WorkspaceMode }) {
  const user = useAuthStore((state) => state.user);
  const [careerId, setCareerId] = useState('');
  const profile = useQuery({
    queryKey: ['student-portal', user?.id, 'profile'],
    queryFn: () => read<Student>('/student-portal/me'),
  });
  const selectedCareerId =
    careerId ||
    profile.data?.careers.find((item) => item.primary)?.id ||
    profile.data?.careers[0]?.id ||
    '';
  const history = useQuery({
    queryKey: ['student-portal', user?.id, 'history', selectedCareerId],
    queryFn: () =>
      read<{ items: HistoryItem[]; total: number }>(
        `/student-portal/history${selectedCareerId ? `?careerId=${selectedCareerId}` : ''}`,
      ),
    enabled: mode === 'history' && Boolean(profile.data),
  });
  const eligibility = useQuery({
    queryKey: ['student-portal', user?.id, 'eligibility', selectedCareerId],
    queryFn: () =>
      read<Eligibility>(
        `/student-portal/eligibility${selectedCareerId ? `?careerId=${selectedCareerId}` : ''}`,
      ),
    enabled: mode === 'eligibility' && Boolean(profile.data),
  });
  const ownHistoryPagination = usePagination(history.data?.items ?? []);
  const ownEligibilityPagination = usePagination(eligibility.data?.pendingSubjects ?? [], 10);

  if (profile.isPending)
    return <p className="rounded-3xl border bg-white p-10 text-center">Cargando tu expediente…</p>;
  if (profile.isError)
    return (
      <p role="alert" className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
        {profile.error.message}
      </p>
    );
  const student = profile.data;
  const ownCopy: Record<WorkspaceMode, { title: string; description: string }> = {
    profiles: {
      title: 'Mi perfil estudiantil',
      description: 'Tus datos institucionales y de contacto registrados en SIGMA.',
    },
    careers: {
      title: 'Mis carreras',
      description: 'Recinto, carrera y plan de estudio vinculados a tu matrícula.',
    },
    history: {
      title: 'Mi historial académico',
      description: 'Asignaturas y resultados utilizados para validar tu condición académica.',
    },
    eligibility: {
      title: 'Mi elegibilidad',
      description: 'Validación automática del 100% de las asignaturas obligatorias de tu plan.',
    },
  };
  const copy = ownCopy[mode];

  return (
    <section className="w-full space-y-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-bold tracking-widest text-blue-700 uppercase">
          Portal estudiantil
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">{copy.title}</h1>
        <p className="mt-2 text-slate-600">{copy.description}</p>
      </header>
      {mode === 'profiles' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                <UserRound className="size-7" />
              </span>
              <div>
                <h2 className="text-xl font-bold">{student.name}</h2>
                <p className="text-sm text-slate-500">Matrícula {student.matricula}</p>
              </div>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <ProfileDatum label="Correo" value={student.email} />
              <ProfileDatum label="Teléfono" value={student.phone ?? 'No registrado'} />
              <ProfileDatum label="WhatsApp" value={student.whatsapp ?? 'No registrado'} />
              <ProfileDatum label="Estado" value={humanizeSystemValue(student.status)} />
            </dl>
          </section>
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <p className="text-xs font-bold tracking-widest text-blue-700 uppercase">Acceso</p>
            <h2 className="mt-2 text-xl font-bold">{student.role?.name ?? 'Estudiante'}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Tu cuenta solo muestra información y operaciones propias del proceso de grado.
            </p>
          </section>
        </div>
      )}
      {mode === 'careers' && (
        <section className="grid gap-4 md:grid-cols-2">
          {student.careers.length === 0 ? (
            <Empty text="Aún no tienes una carrera asociada." />
          ) : (
            student.careers.map((career) => (
              <article key={career.id} className="rounded-3xl border bg-white p-6 shadow-sm">
                <GraduationCap className="size-7 text-blue-700" />
                <h2 className="mt-4 text-xl font-bold">{career.career}</h2>
                <p className="mt-1 text-slate-600">{career.campus}</p>
                <p className="mt-3 text-sm text-slate-500">Plan: {career.studyPlan}</p>
                <div className="mt-4 flex gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
                    {humanizeSystemValue(career.status)}
                  </span>
                  {career.primary && (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      Principal
                    </span>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      )}
      {(mode === 'history' || mode === 'eligibility') && student.careers.length > 1 && (
        <Select
          label="Carrera a consultar"
          value={selectedCareerId}
          onChange={(value) => {
            setCareerId(value);
            ownHistoryPagination.setPage(1);
            ownEligibilityPagination.setPage(1);
          }}
          options={student.careers.map((career) => ({
            value: career.id,
            label: `${career.career} · ${career.studyPlan}`,
          }))}
        />
      )}
      {mode === 'history' && (
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
          <div className="responsive-table max-w-full overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="p-4">Asignatura</th>
                  <th className="p-4">Período</th>
                  <th className="p-4">Créditos</th>
                  <th className="p-4">Calificación</th>
                  <th className="p-4">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {ownHistoryPagination.pageItems.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-4">
                      <strong>{item.subjectCode}</strong>
                      <span className="block text-slate-500">{item.subjectName}</span>
                    </td>
                    <td className="p-4">{item.periodCode}</td>
                    <td className="p-4">{item.credits}</td>
                    <td className="p-4">
                      <span>{item.grade ?? '—'}</span>
                      {item.laboratoryGradeText && (
                        <span className="block text-xs font-semibold text-blue-700">
                          Laboratorio: {item.laboratoryGradeText}
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-bold">{humanizeSystemValue(item.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.data?.items.length === 0 && (
              <Empty text="No hay asignaturas registradas en tu historial." />
            )}
          </div>
          <Pagination
            page={ownHistoryPagination.page}
            pageSize={ownHistoryPagination.pageSize}
            total={history.data?.items.length ?? 0}
            onPageChange={ownHistoryPagination.setPage}
            onPageSizeChange={ownHistoryPagination.setPageSize}
          />
        </section>
      )}
      {mode === 'eligibility' && (
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          {eligibility.isPending ? (
            <p className="text-center">Evaluando tu plan…</p>
          ) : eligibility.data ? (
            <>
              <div
                className={`rounded-2xl p-6 ${eligibility.data.eligible ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}
              >
                <p className="text-xs font-bold uppercase">
                  {eligibility.data.eligible
                    ? 'Elegible para solicitar inscripción'
                    : 'Todavía no elegible'}
                </p>
                <p className="mt-2 text-5xl font-bold tabular-nums">
                  {eligibility.data.completionPercentage}%
                </p>
                <p className="mt-3">{eligibility.data.reason}</p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Metric
                  label="Requisitos del plan"
                  value={eligibility.data.requiredSubjects ?? 0}
                />
                <Metric
                  label="Requisitos cumplidos"
                  value={eligibility.data.completedSubjects ?? 0}
                />
              </div>
              {eligibility.data.electiveCredits &&
                eligibility.data.electiveCredits.required > 0 && (
                  <ElectiveCreditProgress credits={eligibility.data.electiveCredits} />
                )}
              {eligibility.data.graduationRequirements &&
                eligibility.data.graduationRequirements.length > 0 && (
                  <GraduationEnrollmentRequirement
                    items={eligibility.data.graduationRequirements}
                  />
                )}
              <div className="mt-6">
                <h3 className="font-bold">Pendientes</h3>
                {eligibility.data.pendingSubjects.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No tienes asignaturas pendientes.</p>
                ) : (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {ownEligibilityPagination.pageItems.map((item) => (
                      <div key={item.id} className="rounded-xl border p-3 text-sm">
                        <strong>{item.code}</strong> · {item.name}
                      </div>
                    ))}
                  </div>
                )}
                {eligibility.data.pendingSubjects.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-xl border">
                    <Pagination
                      page={ownEligibilityPagination.page}
                      pageSize={ownEligibilityPagination.pageSize}
                      total={eligibility.data.pendingSubjects.length}
                      onPageChange={ownEligibilityPagination.setPage}
                      onPageSizeChange={ownEligibilityPagination.setPageSize}
                      pageSizes={[10, 20, 50]}
                    />
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>
      )}
    </section>
  );
}

function ProfileDatum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-slate-500 uppercase">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function Input({
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
        className="h-11 rounded-xl border px-3 text-sm font-normal text-slate-900"
      />
      {error && <span className="font-medium text-red-600">{error}</span>}
    </label>
  );
}

function parseLaboratoryGrade(value: string): number | null {
  const normalized = value.trim().toUpperCase().replace(/^L\s*/, '').replace(',', '.');
  if (!normalized || !/^\d{1,2}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return parsed >= 0 && parsed <= 30 ? parsed : null;
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
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
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">
      {text}
    </p>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <strong className="text-2xl tabular-nums">{value}</strong>
      <span className="block text-xs text-slate-500">{label}</span>
    </div>
  );
}

function ElectiveCreditProgress({
  credits,
}: {
  credits: NonNullable<Eligibility['electiveCredits']>;
}) {
  const percentage = credits.required
    ? Math.min((credits.completed / credits.required) * 100, 100)
    : 0;
  return (
    <section className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wide text-blue-700 uppercase">
            Créditos optativos
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Se reconocen únicamente asignaturas optativas vinculadas a este plan.
          </p>
        </div>
        <strong className="text-xl whitespace-nowrap text-blue-950">
          {credits.completed} / {credits.required}
        </strong>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-[width]"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {credits.earned > credits.required && (
        <p className="mt-2 text-xs text-slate-500">
          Aprobados: {credits.earned}. Reconocidos para el requisito: {credits.required}.
        </p>
      )}
    </section>
  );
}

function GraduationEnrollmentRequirement({
  items,
}: {
  items: NonNullable<Eligibility['graduationRequirements']>;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
      <p className="text-xs font-bold tracking-wide text-emerald-700 uppercase">
        Requisito a inscribir
      </p>
      <p className="mt-1 text-sm text-emerald-800">
        No bloquea la elegibilidad porque se completará mediante el proceso de tesis o monográfico.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-emerald-200 bg-white/70 p-3 text-sm"
          >
            <strong>{item.code}</strong> · {item.name}
            <span className="block text-xs text-emerald-700">{item.credits} créditos</span>
          </div>
        ))}
      </div>
    </section>
  );
}
