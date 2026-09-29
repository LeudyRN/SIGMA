'use client';

import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Users } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { canAccessModule } from '@/lib/module-catalog';
import { Button } from '@/components/ui/button';

interface Advisor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  participation: string;
  notes: string | null;
  active: boolean;
  version: number;
}
interface AdvisorProject {
  id: string;
  title: string;
  code: string;
  course: string;
  canManage: boolean;
  advisors: Advisor[];
  previousAssignments: {
    id: string;
    name: string;
    participation: string;
    email: string | null;
    phone: string | null;
  }[];
}
const field =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600';
const roleName = (role: string) =>
  ({ ASESOR: 'Asesor', COASESOR: 'Coasesor', JURADO: 'Jurado' })[role] ?? role;

export function ProjectAdvisorsPanel() {
  const user = useAuthStore((state) => state.user);
  const allowed = !!user && canAccessModule('asesores-jurados', user);
  const cache = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Advisor | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const query = useQuery({
    queryKey: ['project-advisors', user?.id],
    queryFn: () => apiJson<{ projects: AdvisorProject[] }>('/project-advisors'),
    enabled: allowed,
    refetchInterval: 30000,
  });
  const projects = (query.data?.projects ?? []).filter((project) =>
    `${project.title} ${project.code} ${project.course} ${project.advisors.map((advisor) => advisor.name).join(' ')}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const project = projects.find((item) => item.id === projectId) ?? projects[0];
  const current = editing && editing !== 'new' ? editing : null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project?.canManage || busy) return;
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiJson(`/project-advisors/projects/${project.id}${current ? `/${current.id}` : ''}`, {
        method: current ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: text('name'),
          email: text('email') || undefined,
          phone: text('phone') || undefined,
          specialty: text('specialty') || undefined,
          participation: text('participation'),
          notes: text('notes') || undefined,
          ...(current ? { active: data.get('active') === 'on', version: current.version } : {}),
        }),
      });
      setEditing(null);
      await cache.invalidateQueries({ queryKey: ['project-advisors'] });
      setNotice('Datos guardados. Secretaría de UCOTESIS ya puede consultarlos.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible guardar el asesor.');
    } finally {
      setBusy(false);
    }
  }

  if (!allowed)
    return (
      <p className="rounded-xl border bg-white p-6">
        Este registro está disponible para Coordinación y Secretaría de UCOTESIS.
      </p>
    );
  return (
    <main className="space-y-6 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl bg-[#102c46] p-6 text-white sm:p-8">
        <div>
          <p className="text-xs font-semibold tracking-widest text-sky-300 uppercase">
            UCOTESIS / PROYECTOS DE GRADO
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Registro de asesores y jurados</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
            La coordinación registra a los profesionales elegidos para cada proyecto. Secretaría
            consulta sus datos de contacto y participación.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={query.isFetching || busy}
          onClick={() => void query.refetch()}
          aria-label="Actualizar registro"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </header>
      {(error || query.error) && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error || query.error?.message}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-teal-50 p-4 text-teal-800">
          {notice}
        </p>
      )}
      {query.isPending && <p role="status">Cargando proyectos y asesores…</p>}
      {query.data && (
        <section className="space-y-4 rounded-2xl border bg-white p-5">
          <label className="block text-sm font-semibold">
            Buscar proyecto o asesor
            <input
              className={field}
              value={search}
              disabled={busy}
              onChange={(event) => {
                setSearch(event.target.value);
                setEditing(null);
              }}
              placeholder="Nombre, curso o código de inscripción"
            />
          </label>
          {!!projects.length && (
            <label className="block text-sm font-semibold">
              Proyecto
              <select
                className={field}
                disabled={busy}
                value={project?.id ?? ''}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setEditing(null);
                  setError('');
                  setNotice('');
                }}
              >
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {item.code}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!projects.length && (
            <p className="text-sm text-slate-600">
              {search
                ? 'No hay resultados para esta búsqueda.'
                : 'Todavía no hay proyectos disponibles. Los asesores se registran cuando el grupo tiene un proyecto creado y vinculado a su curso.'}
            </p>
          )}
        </section>
      )}
      {project && (
        <section className="space-y-5 rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{project.title}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {project.course} · {project.code}
              </p>
            </div>
            {project.canManage ? (
              <Button
                disabled={busy}
                onClick={() => {
                  setEditing('new');
                  setError('');
                  setNotice('');
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                Registrar asesor o jurado
              </Button>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                Consulta de Secretaría
              </span>
            )}
          </div>
          {editing && project.canManage && (
            <form
              key={`${project.id}-${current?.id ?? 'new'}`}
              onSubmit={save}
              className="rounded-xl border border-blue-200 bg-blue-50/30 p-5"
            >
              <fieldset disabled={busy} className="space-y-4">
                <legend className="font-semibold">
                  {current ? 'Editar datos del profesional' : 'Datos del profesional elegido'}
                </legend>
                <p className="text-sm text-slate-600">
                  Este registro no crea una cuenta ni requiere que el asesor complete un perfil.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium">
                    Nombre completo *
                    <input
                      name="name"
                      required
                      minLength={3}
                      maxLength={200}
                      defaultValue={current?.name}
                      className={field}
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Participación *
                    <select
                      name="participation"
                      defaultValue={current?.participation ?? 'ASESOR'}
                      className={field}
                    >
                      <option value="ASESOR">Asesor</option>
                      <option value="COASESOR">Coasesor</option>
                      <option value="JURADO">Jurado</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Correo electrónico
                    <input
                      name="email"
                      type="email"
                      maxLength={190}
                      defaultValue={current?.email ?? ''}
                      className={field}
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Teléfono
                    <input
                      name="phone"
                      type="tel"
                      minLength={7}
                      maxLength={30}
                      defaultValue={current?.phone ?? ''}
                      className={field}
                    />
                  </label>
                  <label className="text-sm font-medium md:col-span-2">
                    Especialidad
                    <input
                      name="specialty"
                      maxLength={300}
                      defaultValue={current?.specialty ?? ''}
                      className={field}
                    />
                  </label>
                  <label className="text-sm font-medium md:col-span-2">
                    Observaciones
                    <textarea
                      name="notes"
                      maxLength={1500}
                      defaultValue={current?.notes ?? ''}
                      className={field}
                    />
                  </label>
                </div>
                {current && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={current.active} />
                    Participación vigente en el proyecto
                  </label>
                )}
                <div className="flex gap-3">
                  <Button type="submit">{busy ? 'Guardando…' : 'Guardar datos'}</Button>
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          {!project.advisors.length && !project.previousAssignments.length && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              La coordinación todavía no ha registrado asesores para este proyecto.
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {project.advisors.map((advisor) => (
              <article key={advisor.id} className="space-y-2 rounded-xl border p-4">
                <h3 className="font-semibold">{advisor.name}</h3>
                <p className="text-sm text-blue-800">
                  {roleName(advisor.participation)} ·{' '}
                  {advisor.active ? 'Vigente' : 'Finalizó su participación'}
                </p>
                <p className="text-sm">Correo: {advisor.email ?? 'No registrado'}</p>
                <p className="text-sm">Teléfono: {advisor.phone ?? 'No registrado'}</p>
                {advisor.specialty && <p className="text-sm">Especialidad: {advisor.specialty}</p>}
                {advisor.notes && (
                  <p className="text-sm whitespace-pre-wrap text-slate-600">{advisor.notes}</p>
                )}
                {project.canManage && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setEditing(advisor);
                      setError('');
                    }}
                  >
                    Editar {advisor.name}
                  </Button>
                )}
              </article>
            ))}
          </div>
          {!!project.previousAssignments.length && (
            <div className="space-y-3">
              <h3 className="font-semibold">Asignaciones docentes existentes</h3>
              <p className="text-sm text-slate-600">
                Estos profesionales ya estaban vinculados al proyecto. Sus asignaciones continúan
                vigentes.
              </p>
              {project.previousAssignments.map((advisor) => (
                <article key={advisor.id} className="rounded-xl border p-4">
                  <h4 className="font-semibold">
                    {advisor.name} · {advisor.participation}
                  </h4>
                  <p className="mt-2 text-sm">
                    {advisor.email ?? 'Sin correo'} · {advisor.phone ?? 'Sin teléfono'}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
