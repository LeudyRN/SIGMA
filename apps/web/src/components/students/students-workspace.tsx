'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpenCheck,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { apiFetch, readApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

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
  status: string;
  source: string | null;
}

interface Eligibility {
  eligible: boolean;
  completionPercentage: number;
  reason: string;
  requiredSubjects?: number;
  completedSubjects?: number;
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
    <section className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6">
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
          <div className="relative max-w-xl">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar estudiante por matrícula, nombre o correo"
              className="h-11 w-full rounded-xl border bg-white pr-3 pl-10"
            />
          </div>
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
              refresh={refresh}
            />
          )}
          {mode === 'eligibility' && <EligibilityPanel students={students.data?.items ?? []} />}
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
  const visible = students.filter((student) =>
    `${student.matricula} ${student.name} ${student.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

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
  }

  return (
    <>
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{editing ? 'Editar perfil' : 'Crear perfil'}</h2>
          <div className="flex items-center gap-3">
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(empty);
                }}
                className="text-xs font-bold text-slate-500"
              >
                Cancelar
              </button>
            )}
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              Rol: {role?.name ?? 'ESTUDIANTE no configurado'}
            </span>
          </div>
        </div>
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
          <Button
            type="button"
            className="self-end"
            onClick={() => save.mutate()}
            disabled={save.isPending || !role}
          >
            {save.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}{' '}
            {editing ? 'Guardar cambios' : 'Crear estudiante'}
          </Button>
        </div>
      </section>
      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filtrar perfiles"
            className="h-11 w-full max-w-xl rounded-xl border px-3"
          />
        </div>
        <div className="overflow-x-auto">
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
              {visible.map((student) => (
                <tr key={student.id} className="border-t">
                  <td className="p-4">
                    <strong>{student.name}</strong>
                    <span className="block text-slate-500">{student.email}</span>
                  </td>
                  <td className="p-4 font-semibold">{student.matricula}</td>
                  <td className="p-4">{student.role?.name ?? 'Sin rol'}</td>
                  <td className="p-4">{student.careers.length}</td>
                  <td className="p-4">{student.status}</td>
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
  const student = students.find((item) => item.id === studentId);
  const selectedCampusCareer = catalogs?.campusCareers.find((item) => item.id === campusCareerId);
  const plans =
    catalogs?.studyPlans.filter((plan) => plan.careerId === selectedCampusCareer?.careerId) ?? [];
  const save = useMutation({
    mutationFn: () => {
      if (!studentId || !campusCareerId || !studyPlanId)
        throw new Error('Selecciona estudiante, recinto/carrera y plan.');
      return write(`/students/${studentId}/careers`, 'POST', {
        campusCareerId,
        studyPlanId,
        entryDate: entryDate || undefined,
        primary: true,
      });
    },
    onSuccess: () => {
      toast.success('Carrera asociada.');
      setCampusCareerId('');
      setStudyPlanId('');
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      write(`/students/careers/${id}`, 'PATCH', { status: value }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Nueva asociación</h2>
        <div className="mt-5 grid gap-4">
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
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <LoaderCircle className="size-4 animate-spin" />} Asociar carrera
          </Button>
        </div>
      </section>
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Expediente de carreras</h2>
        {!student ? (
          <Empty text="Selecciona un estudiante para consultar sus carreras." />
        ) : student.careers.length === 0 ? (
          <Empty text="Este estudiante todavía no tiene carreras asociadas." />
        ) : (
          <div className="mt-5 space-y-3">
            {student.careers.map((career) => (
              <article key={career.id} className="rounded-2xl border p-4">
                <div className="flex items-start gap-3">
                  <GraduationCap className="mt-1 size-5 text-blue-700" />
                  <div className="flex-1">
                    <strong>{career.career}</strong>
                    <p className="text-sm text-slate-500">
                      {career.campus} · {career.studyPlan}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {career.historyCount} registros académicos{' '}
                      {career.primary ? '· Carrera principal' : ''}
                    </p>
                  </div>
                  <select
                    value={career.status}
                    onChange={(event) =>
                      status.mutate({ id: career.id, value: event.target.value })
                    }
                    className="h-9 rounded-lg border bg-white px-2 text-xs font-semibold"
                  >
                    <option>ACTIVA</option>
                    <option>FINALIZADA</option>
                    <option>SUSPENDIDA</option>
                    <option>RETIRADA</option>
                  </select>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function History({
  students,
  catalogs,
  refresh,
}: {
  students: Student[];
  catalogs?: Catalogs;
  refresh: () => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [careerId, setCareerId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [periodCode, setPeriodCode] = useState('');
  const [grade, setGrade] = useState('');
  const [status, setStatus] = useState('APROBADA');
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
      return write(`/students/careers/${careerId}/history`, 'POST', {
        subjectId,
        periodCode,
        grade: grade ? Number(grade) : undefined,
        status,
        source: 'REGISTRO_SIGMA',
      });
    },
    onSuccess: () => {
      toast.success('Historial actualizado.');
      setSubjectId('');
      setGrade('');
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
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Select
            label="Estudiante"
            value={studentId}
            onChange={(value) => {
              setStudentId(value);
              setCareerId('');
            }}
            options={students.map((item) => ({
              value: item.id,
              label: `${item.matricula} · ${item.name}`,
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
          <Button
            type="button"
            className="self-end"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            <Plus className="size-4" /> Agregar registro
          </Button>
        </div>
      </section>
      <section className="rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
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
              {history.data?.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-4">
                    <strong>{item.subjectCode}</strong>
                    <span className="block text-slate-500">{item.subjectName}</span>
                  </td>
                  <td className="p-4">{item.periodCode}</td>
                  <td className="p-4">{item.grade ?? '—'}</td>
                  <td className="p-4 font-semibold">{item.status}</td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => remove.mutate(item.id)}
                      className="text-red-700"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!careerId && <Empty text="Selecciona una carrera para consultar el historial." />}
        </div>
      </section>
    </div>
  );
}

function EligibilityPanel({ students }: { students: Student[] }) {
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
  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Evaluar expediente</h2>
        <div className="mt-5 grid gap-4">
          <Select
            label="Estudiante"
            value={studentId}
            onChange={(value) => {
              setStudentId(value);
              setCareerId('');
              setRequested(false);
            }}
            options={students.map((item) => ({
              value: item.id,
              label: `${item.matricula} · ${item.name}`,
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
              <Metric label="Obligatorias" value={result.requiredSubjects ?? 0} />
              <Metric label="Completadas" value={result.completedSubjects ?? 0} />
            </div>
            <div className="mt-5">
              <h3 className="font-bold">Asignaturas pendientes</h3>
              {result.pendingSubjects.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No hay asignaturas pendientes.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {result.pendingSubjects.map((item) => (
                    <div key={item.id} className="rounded-xl border p-3 text-sm">
                      <strong>{item.code}</strong> · {item.name}
                    </div>
                  ))}
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
    <section className="mx-auto max-w-6xl space-y-6">
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
              <ProfileDatum label="Estado" value={student.status} />
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
                    {career.status}
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
          onChange={setCareerId}
          options={student.careers.map((career) => ({
            value: career.id,
            label: `${career.career} · ${career.studyPlan}`,
          }))}
        />
      )}
      {mode === 'history' && (
        <section className="rounded-3xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
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
                {history.data?.items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-4">
                      <strong>{item.subjectCode}</strong>
                      <span className="block text-slate-500">{item.subjectName}</span>
                    </td>
                    <td className="p-4">{item.periodCode}</td>
                    <td className="p-4">{item.credits}</td>
                    <td className="p-4">{item.grade ?? '—'}</td>
                    <td className="p-4 font-bold">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.data?.items.length === 0 && (
              <Empty text="No hay asignaturas registradas en tu historial." />
            )}
          </div>
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
                  label="Asignaturas obligatorias"
                  value={eligibility.data.requiredSubjects ?? 0}
                />
                <Metric
                  label="Asignaturas completadas"
                  value={eligibility.data.completedSubjects ?? 0}
                />
              </div>
              <div className="mt-6">
                <h3 className="font-bold">Pendientes</h3>
                {eligibility.data.pendingSubjects.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No tienes asignaturas pendientes.</p>
                ) : (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {eligibility.data.pendingSubjects.map((item) => (
                      <div key={item.id} className="rounded-xl border p-3 text-sm">
                        <strong>{item.code}</strong> · {item.name}
                      </div>
                    ))}
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
