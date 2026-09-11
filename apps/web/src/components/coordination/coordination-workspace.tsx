'use client';
import { useState, type ReactNode, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, RefreshCw, Download, Users, Clock3, CheckCircle2 } from 'lucide-react';
import { apiJson, apiFetch, readApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { humanizeSystemValue } from '@/lib/humanize-system-value';
import type { CoordinationData, Milestone, Teacher } from './coordination-types';
const inputClass =
  'mt-1 block w-full min-w-0 rounded-lg border bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-blue-600';
const dateLabel = (value: string) =>
  new Date(value).toLocaleString('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Santo_Domingo',
  });
const localDate = (value: string) =>
  new Date(new Date(value).getTime() - 4 * 3600000).toISOString().slice(0, 16);
const text = (f: FormData, key: string) => String(f.get(key) ?? '');
type Save = (path: string, body: unknown, method?: string) => Promise<void>;
export function CoordinationWorkspace({ initialTab = 'seguimiento' }: { initialTab?: string }) {
  const user = useAuthStore((s) => s.user);
  const cache = useQueryClient();
  const [offer, setOffer] = useState('');
  const [tab, setTab] = useState(initialTab);
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const query = useQuery({
    queryKey: ['coordination', user?.id, offer],
    queryFn: () => apiJson<CoordinationData>(`/coordination${offer ? `?offerId=${offer}` : ''}`),
    enabled: !!user,
    refetchInterval: 30000,
  });
  const data = query.data;
  const course = data?.course;
  const projects = data?.projects ?? [];
  const milestones = data?.milestones ?? [];
  const teachers = data?.teachers ?? [];
  const submissions = data?.submissions ?? [];
  const selectedProject = projects.find((p) => p.id === projectId) ?? projects[0];
  const save: Save = async (path, body, method = 'POST') => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiJson(`/coordination/${path}`, {
        method,
        body: body instanceof FormData ? body : JSON.stringify(body),
      });
      await cache.invalidateQueries({ queryKey: ['coordination'] });
      await cache.invalidateQueries({ queryKey: ['notifications'] });
      setNotice('Cambios guardados.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible guardar.');
      throw e;
    } finally {
      setBusy(false);
    }
  };
  async function download(path: string, filename: string) {
    setError('');
    try {
      const res = await apiFetch(`/coordination/${path}`);
      if (!res.ok) throw new Error(await readApiError(res));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible descargar.');
    }
  }
  const tabs = [
    ['seguimiento', 'Seguimiento de grupos'],
    ['cronograma', 'Cronograma'],
    ['entregas', 'Trabajos y revisiones'],
    ...(teachers.length ? [['personal', 'Personal académico']] : []),
    ...(course?.canPlan || course?.canManageDocuments || data?.ownTeacherId
      ? [['expedientes', 'Expedientes docentes']]
      : []),
  ];
  return (
    <main className="min-w-0 space-y-6 pb-6">
      <header className="rounded-3xl bg-[#102c46] p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest text-sky-300 uppercase">
              UCOTESIS / COORDINACIÓN ACADÉMICA
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Del cronograma al trabajo final</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Planifica las actividades, acompaña a cada grupo y reúne las entregas en un solo
              lugar.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            aria-label="Actualizar seguimiento"
          >
            <RefreshCw className="size-4 text-blue-700" />
          </Button>
        </div>
      </header>
      {query.isPending && <p role="status">Cargando coordinación académica…</p>}
      {(error || query.isError) && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
          {error || query.error?.message}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
          {notice}
        </p>
      )}
      {!!data?.offers.length && (
        <label className="block max-w-2xl text-sm font-semibold">
          Curso de monográfico
          <select
            className={inputClass}
            value={course?.id ?? offer}
            onChange={(e) => {
              setOffer(e.target.value);
              setProjectId('');
              setError('');
              setNotice('');
            }}
          >
            {data.offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title} · {humanizeSystemValue(o.teachingMode)}
              </option>
            ))}
          </select>
        </label>
      )}
      {data && !course && (
        <Panel title="Todavía no tienes cursos vinculados">
          <p className="text-sm text-slate-500">
            La coordinación verá los cursos designados; asesores, evaluadores y estudiantes verán
            los grupos a los que pertenecen.
          </p>
        </Panel>
      )}
      {!course &&
        teachers.map((t) => (
          <Panel key={t.id} title="Completa tu perfil para las asignaciones">
            <p className="text-sm text-slate-500">
              La coordinación consultará tu especialidad, disponibilidad y capacidad antes de
              asignarte a un grupo.
            </p>
            <Editor
              title="Actualizar mi perfil académico"
              busy={busy}
              onSave={(f) =>
                save(
                  `teachers/${t.id}/profile`,
                  {
                    specialties: text(f, 'specialties'),
                    availability: text(f, 'availability'),
                    maxGroups: Number(f.get('maxGroups')),
                    maxStudents: Number(f.get('maxStudents')),
                    available: f.get('available') === 'on',
                  },
                  'PATCH',
                )
              }
            >
              <Field label="Áreas de especialización">
                <textarea
                  name="specialties"
                  required
                  minLength={3}
                  maxLength={1000}
                  defaultValue={t.profile?.specialties}
                  className={inputClass}
                />
              </Field>
              <Field label="Días y horarios disponibles">
                <textarea
                  name="availability"
                  required
                  minLength={3}
                  maxLength={1000}
                  defaultValue={t.profile?.availability}
                  className={inputClass}
                />
              </Field>
              <Field label="Máximo de grupos">
                <input
                  type="number"
                  name="maxGroups"
                  required
                  min={1}
                  max={100}
                  defaultValue={t.profile?.maxGroups ?? 5}
                  className={inputClass}
                />
              </Field>
              <Field label="Máximo de estudiantes">
                <input
                  type="number"
                  name="maxStudents"
                  required
                  min={1}
                  max={500}
                  defaultValue={t.profile?.maxStudents ?? 25}
                  className={inputClass}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="available"
                  defaultChecked={t.profile?.available ?? true}
                />
                Disponible para asignaciones
              </label>
            </Editor>
          </Panel>
        ))}
      {course && (
        <>
          <nav aria-label="Secciones de coordinación" className="flex flex-wrap gap-2">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold ${tab === key ? 'border-blue-700 bg-blue-700 text-white' : 'bg-white text-slate-600 hover:border-blue-400'}`}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === 'seguimiento' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  [Users, projects.length, 'Grupos de investigación'],
                  [
                    Clock3,
                    projects.reduce((n, p) => n + p.progress.overdue, 0),
                    'Entregas vencidas',
                  ],
                  [
                    CalendarDays,
                    projects.reduce((n, p) => n + p.progress.awaitingReview, 0),
                    'Esperando revisión',
                  ],
                  [
                    CheckCircle2,
                    projects.reduce((n, p) => n + p.progress.approved, 0),
                    'Entregas aprobadas',
                  ],
                ].map(([Icon, count, label]) => {
                  const Symbol = Icon as typeof Users;
                  return (
                    <article key={String(label)} className="rounded-2xl border bg-white p-5">
                      <Symbol className="size-5 text-blue-700" />
                      <p className="mt-3 text-3xl font-semibold">{String(count)}</p>
                      <p className="mt-2 text-xs text-slate-500">{String(label)}</p>
                    </article>
                  );
                })}
              </div>
              <Panel title="Cumplimiento y respuesta por grupo">
                <p className="mb-5 text-xs text-slate-500">
                  Actualización automática cada 30 segundos. El avance corresponde a entregas
                  aprobadas sobre los avances y defensas programados.
                </p>
                {!projects.length ? (
                  <Empty>No hay grupos con proyecto registrado en este curso.</Empty>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {projects.map((p) => (
                      <article key={p.id} className="rounded-xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{p.title}</h3>
                            <p className="mt-1 text-xs text-slate-500">
                              {p.code} · {p.students.length} estudiantes · {p.area}
                            </p>
                          </div>
                          <span className="shrink-0 text-xl font-semibold text-blue-700">
                            {p.progress.percent === null ? '—' : `${p.progress.percent}%`}
                          </span>
                        </div>
                        <div className="mt-4 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-teal-600"
                            style={{ width: `${p.progress.percent ?? 0}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {p.progress.total
                            ? `${p.progress.approved} de ${p.progress.total} entregas aprobadas`
                            : 'Sin avances ni defensa programados'}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge value={`${p.progress.overdue} vencidas`} />
                          <Badge value={`${p.progress.awaitingReview} por revisar`} />
                          <Badge value={`${p.progress.changes} con ajustes`} />
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-500">
                          {p.progress.awaitingReview
                            ? `Revisión más antigua: ${p.progress.oldestReviewDays} días de espera. `
                            : ''}
                          {p.progress.averageResponseHours === null
                            ? 'Aún no hay revisiones para calcular el tiempo de respuesta.'
                            : `Respuesta media en últimas versiones revisadas: ${p.progress.averageResponseHours} horas.`}
                        </p>
                        <p className="mt-3 text-xs text-slate-600">
                          {p.teachers.length
                            ? p.teachers.map((t) => `${t.name} (${t.role})`).join(' · ')
                            : 'Sin asesores ni evaluadores asignados.'}
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => {
                            setProjectId(p.id);
                            setTab('entregas');
                          }}
                        >
                          Ver entregas del grupo
                        </Button>
                      </article>
                    ))}
                  </div>
                )}
              </Panel>
            </>
          )}
          {tab === 'cronograma' && (
            <Panel title="Calendario oficial del monográfico">
              <p className="mb-5 text-sm leading-6 text-slate-500">
                Inicio, avances, asesorías, defensa y orientación normativa. Las fechas usan la hora
                de Santo Domingo. SIGMA avisa durante las 24 horas previas y cuando se alcanza la
                fecha.
              </p>
              {course.canPlan && (
                <Editor
                  title="Programar actividad"
                  busy={busy}
                  onSave={(f) => save(`offers/${course.id}/milestones`, milestoneBody(f))}
                >
                  <MilestoneFields projects={projects} />
                </Editor>
              )}
              {!milestones.length ? (
                <Empty>El cronograma todavía no tiene actividades.</Empty>
              ) : (
                <div className="mt-5 space-y-3">
                  {milestones.map((h) => (
                    <article key={h.id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-blue-700">
                            {dateLabel(h.dueAt)}
                          </p>
                          <h3 className="mt-2 font-semibold">{h.title}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {humanizeSystemValue(h.type)} ·{' '}
                            {h.projectId
                              ? projects.find((p) => p.id === h.projectId)?.code
                              : 'Todos los grupos'}{' '}
                            · {humanizeSystemValue(h.status)}
                          </p>
                        </div>
                        <CalendarDays className="size-5 text-slate-400" />
                      </div>
                      <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-slate-600">
                        {h.instructions}
                      </p>
                      {course.canPlan && (
                        <Editor
                          title="Editar fechas e instrucciones"
                          busy={busy}
                          onSave={(f) =>
                            save(
                              `milestones/${h.id}`,
                              {
                                ...milestoneBody(f),
                                projectId: h.projectId ?? undefined,
                                type: h.type,
                                version: h.version,
                              },
                              'PATCH',
                            )
                          }
                        >
                          <MilestoneFields projects={projects} milestone={h} />
                        </Editor>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          )}
          {tab === 'entregas' && (
            <Panel title="Repositorio de trabajos y retroalimentación">
              <p className="mb-4 text-sm leading-6 text-slate-500">
                Cada envío conserva su archivo y revisión. Los PDF pueden pesar hasta 8 MB. Las
                entregas tardías se reciben y conservan su fecha real.
              </p>
              <ProjectSelect
                projects={projects}
                value={selectedProject?.id ?? ''}
                onChange={setProjectId}
              />
              {!selectedProject ? (
                <Empty>No hay proyectos disponibles.</Empty>
              ) : (
                <>
                  <p className="my-4 text-xs text-slate-500">
                    {selectedProject.students
                      .map((s) => `${s.registration} · ${s.name}`)
                      .join(' / ')}
                  </p>
                  {milestones
                    .filter(
                      (h) =>
                        h.status === 'PROGRAMADO' &&
                        ['AVANCE', 'DEFENSA'].includes(h.type) &&
                        (!h.projectId || h.projectId === selectedProject.id),
                    )
                    .map((h) => {
                      const versions = submissions.filter(
                        (s) => s.projectId === selectedProject.id && s.milestoneId === h.id,
                      );
                      const latest = versions[0];
                      return (
                        <section key={h.id} className="mt-5 rounded-xl border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">{h.title}</h3>
                              <p className="mt-1 text-xs text-slate-500">
                                Fecha límite: {dateLabel(h.dueAt)}
                              </p>
                            </div>
                            <Badge
                              value={
                                latest ? humanizeSystemValue(latest.status) : 'Pendiente de entrega'
                              }
                            />
                          </div>
                          {selectedProject.canSubmit &&
                            latest?.status !== 'APROBADO' &&
                            !['FINALIZADO', 'CANCELADO'].includes(selectedProject.status) && (
                              <Upload
                                busy={busy}
                                label={
                                  versions.length ? 'Enviar nueva versión' : 'Entregar trabajo'
                                }
                                onSave={(f) =>
                                  save(
                                    `projects/${selectedProject.id}/milestones/${h.id}/submissions`,
                                    f,
                                  )
                                }
                              />
                            )}
                          {!versions.length ? (
                            <Empty>Todavía no se ha recibido un trabajo para esta actividad.</Empty>
                          ) : (
                            versions.map((v, i) => (
                              <article key={v.id} className="mt-4 rounded-lg bg-slate-50 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="min-w-0 text-sm font-semibold break-all">
                                    Versión {versions.length - i} · {v.filename}
                                  </p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => download(`submissions/${v.id}/file`, v.filename)}
                                  >
                                    <Download className="size-3.5" />
                                    Descargar
                                  </Button>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                  {dateLabel(v.createdAt)} ·{' '}
                                  {new Date(v.createdAt) > new Date(h.dueAt)
                                    ? 'Entrega fuera de plazo'
                                    : 'Entrega a tiempo'}
                                </p>
                                {v.feedback && (
                                  <p className="mt-3 rounded-lg border-l-4 border-blue-500 bg-white p-3 text-sm whitespace-pre-wrap">
                                    {v.feedback}
                                  </p>
                                )}
                                <p className="mt-2 text-xs font-medium text-slate-600">
                                  {humanizeSystemValue(v.status)}
                                  {v.reviewedAt ? ` · revisado ${dateLabel(v.reviewedAt)}` : ''}
                                </p>
                                {i === 0 &&
                                  v.status === 'PENDIENTE' &&
                                  selectedProject.canReview && (
                                    <Review
                                      busy={busy}
                                      save={(f) =>
                                        save(
                                          `submissions/${v.id}/review`,
                                          {
                                            status: text(f, 'status'),
                                            feedback: text(f, 'feedback'),
                                          },
                                          'PATCH',
                                        )
                                      }
                                    />
                                  )}
                              </article>
                            ))
                          )}
                        </section>
                      );
                    })}
                  {!milestones.some(
                    (h) =>
                      h.status === 'PROGRAMADO' &&
                      ['AVANCE', 'DEFENSA'].includes(h.type) &&
                      (!h.projectId || h.projectId === selectedProject.id),
                  ) && (
                    <Empty>
                      La coordinación debe programar un avance o defensa para recibir trabajos.
                    </Empty>
                  )}
                </>
              )}
            </Panel>
          )}
          {tab === 'personal' && (
            <>
              <Panel title="Designación de la Escuela">
                <p className="text-sm leading-6 text-slate-600">
                  {course.designation
                    ? `${course.designation.school} designó a ${course.designation.teacher}. Referencia: ${course.designation.reference}.`
                    : 'UCOTESIS debe registrar la designación recibida de la Escuela correspondiente.'}
                </p>
                {course.canDesignate && (
                  <Editor
                    title="Registrar designación institucional"
                    busy={busy}
                    onSave={(f) =>
                      save(`offers/${course.id}/designation`, {
                        teacherId: text(f, 'teacherId'),
                        schoolId: course.schoolId,
                        date: text(f, 'date'),
                        reference: text(f, 'reference'),
                        observation: text(f, 'observation'),
                      })
                    }
                  >
                    <TeacherSelect teachers={teachers} />
                    <Field label="Fecha de designación">
                      <input name="date" type="date" required className={inputClass} />
                    </Field>
                    <Field label="Referencia del oficio o comunicación">
                      <input
                        name="reference"
                        minLength={3}
                        maxLength={200}
                        required
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Observaciones">
                      <textarea name="observation" maxLength={1000} className={inputClass} />
                    </Field>
                  </Editor>
                )}
              </Panel>
              <Panel title="Especialidad, disponibilidad y carga">
                <p className="mb-5 text-sm text-slate-500">
                  La carga cuenta grupos activos únicos y estudiantes de esos grupos, incluyendo
                  otros cursos.
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  {teachers.map((t) => (
                    <article key={t.id} className="rounded-xl border p-4">
                      <h3 className="font-semibold">{t.name}</h3>
                      <p className="mt-2 text-sm text-blue-700">
                        {t.groups} grupos · {t.students} estudiantes
                      </p>
                      <p className="mt-3 text-sm whitespace-pre-wrap text-slate-600">
                        {t.profile?.specialties ?? 'Especialidades por completar'}
                      </p>
                      <p className="mt-2 text-xs leading-5 whitespace-pre-wrap text-slate-500">
                        {t.profile?.availability ?? 'Disponibilidad por completar'}
                      </p>
                      {t.profile && (
                        <p className="mt-2 text-xs text-slate-500">
                          Capacidad: {t.profile.maxGroups} grupos / {t.profile.maxStudents}{' '}
                          estudiantes · {t.profile.available ? 'Disponible' : 'No disponible'}
                        </p>
                      )}
                      {t.canEdit && (
                        <Editor
                          title="Actualizar perfil académico"
                          busy={busy}
                          onSave={(f) =>
                            save(
                              `teachers/${t.id}/profile`,
                              {
                                specialties: text(f, 'specialties'),
                                availability: text(f, 'availability'),
                                maxGroups: Number(f.get('maxGroups')),
                                maxStudents: Number(f.get('maxStudents')),
                                available: f.get('available') === 'on',
                              },
                              'PATCH',
                            )
                          }
                        >
                          <Field label="Áreas de especialización">
                            <textarea
                              name="specialties"
                              required
                              minLength={3}
                              maxLength={1000}
                              defaultValue={t.profile?.specialties}
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Días, horarios y disponibilidad académica">
                            <textarea
                              name="availability"
                              required
                              minLength={3}
                              maxLength={1000}
                              defaultValue={t.profile?.availability}
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Máximo de grupos">
                            <input
                              type="number"
                              name="maxGroups"
                              required
                              min={1}
                              max={100}
                              defaultValue={t.profile?.maxGroups ?? 5}
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Máximo de estudiantes">
                            <input
                              type="number"
                              name="maxStudents"
                              required
                              min={1}
                              max={500}
                              defaultValue={t.profile?.maxStudents ?? 25}
                              className={inputClass}
                            />
                          </Field>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              name="available"
                              type="checkbox"
                              defaultChecked={t.profile?.available ?? true}
                            />
                            Disponible para asignaciones
                          </label>
                        </Editor>
                      )}
                    </article>
                  ))}
                </div>
              </Panel>
              {course.canPlan && (
                <Panel title="Asignar asesores y evaluadores">
                  <p className="mb-4 text-sm leading-6 text-slate-500">
                    Valora la especialidad, confirma el horario y justifica la relación con el tema
                    y la complejidad del proyecto. SIGMA verifica los límites de carga antes de
                    asignar.
                  </p>
                  <ProjectSelect
                    projects={projects}
                    value={selectedProject?.id ?? ''}
                    onChange={setProjectId}
                  />
                  {selectedProject && (
                    <>
                      <p className="mt-4 text-sm">
                        {selectedProject.area} · {selectedProject.students.length} estudiantes
                      </p>
                      <Editor
                        title="Asignar docente al grupo"
                        busy={busy}
                        onSave={(f) =>
                          save(`projects/${selectedProject.id}/assignments`, {
                            teacherId: text(f, 'teacherId'),
                            participation: text(f, 'participation'),
                            complexity: text(f, 'complexity'),
                            availabilityConfirmed: f.get('availabilityConfirmed') === 'on',
                            rationale: text(f, 'rationale'),
                          })
                        }
                      >
                        <TeacherSelect
                          teachers={teachers.filter((t) => t.profile?.available)}
                          load
                        />
                        <Field label="Participación">
                          <select name="participation" className={inputClass}>
                            <option value="ASESOR">Asesor</option>
                            <option value="COASESOR">Coasesor</option>
                            <option value="JURADO">Jurado / evaluador</option>
                          </select>
                        </Field>
                        <Field label="Complejidad del trabajo">
                          <select name="complexity" className={inputClass}>
                            <option value="BAJA">Baja</option>
                            <option value="MEDIA">Media</option>
                            <option value="ALTA">Alta</option>
                          </select>
                        </Field>
                        <Field label="Justificación de la asignación">
                          <textarea
                            name="rationale"
                            required
                            minLength={10}
                            maxLength={1500}
                            placeholder="Relación de la especialidad con el tema, características del trabajo y tamaño del grupo."
                            className={inputClass}
                          />
                        </Field>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="availabilityConfirmed" required />
                          Confirmé la disponibilidad del docente para este grupo.
                        </label>
                      </Editor>
                      <div className="mt-4 space-y-3">
                        {selectedProject.teachers.map((t) => (
                          <div key={`${t.id}-${t.role}`} className="rounded-lg bg-slate-50 p-4">
                            <p className="text-sm font-semibold">
                              {t.name} · {t.role}
                            </p>
                            <p className="mt-2 text-xs text-slate-600">
                              {t.rationale ?? 'Asignación anterior sin criterios registrados.'}
                            </p>
                            {t.typeId && (
                              <Editor
                                title="Finalizar esta asignación"
                                busy={busy}
                                onSave={() =>
                                  save(
                                    `projects/${selectedProject.id}/assignments/${t.id}/${t.typeId}/remove`,
                                    {},
                                  )
                                }
                              >
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" required />
                                  Confirmo que el docente dejará de tener acceso a este grupo por
                                  esta participación. Las revisiones se conservan.
                                </label>
                              </Editor>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Panel>
              )}
            </>
          )}
          {tab === 'expedientes' && (
            <Panel title="Expedientes y trámites docentes">
              <p className="mb-5 text-sm leading-6 text-slate-500">
                Solicita los documentos necesarios para designación, contratación o pago. UCOTESIS
                revisa el expediente y registra la referencia del trámite. El estado del trámite no
                ejecuta pagos ni envía documentos fuera de SIGMA.
              </p>
              {(course.canPlan || course.canManageDocuments) && (
                <Editor
                  title="Solicitar documento a un docente"
                  busy={busy}
                  onSave={(f) =>
                    save(`offers/${course.id}/teacher-requests`, {
                      teacherId: text(f, 'teacherId'),
                      title: text(f, 'title'),
                      purpose: text(f, 'purpose'),
                      instructions: text(f, 'instructions'),
                    })
                  }
                >
                  <TeacherSelect teachers={teachers} />
                  <Field label="Documento requerido">
                    <input
                      name="title"
                      required
                      minLength={3}
                      maxLength={200}
                      placeholder="Ej.: carta de designación o expediente de contratación"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Finalidad">
                    <select name="purpose" className={inputClass}>
                      <option value="DESIGNACION">Designación</option>
                      <option value="CONTRATACION">Contratación</option>
                      <option value="PAGO">Trámite de pago docente</option>
                    </select>
                  </Field>
                  <Field label="Indicaciones para el docente">
                    <textarea
                      name="instructions"
                      required
                      minLength={3}
                      maxLength={5000}
                      className={inputClass}
                    />
                  </Field>
                </Editor>
              )}
              {!data.requests?.length ? (
                <Empty>No hay documentos docentes solicitados en este curso.</Empty>
              ) : (
                data.requests.map((r) => (
                  <article key={r.id} className="mt-5 rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{r.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {r.teacher} · {humanizeSystemValue(r.purpose)}
                        </p>
                      </div>
                      <Badge value={humanizeSystemValue(r.status)} />
                    </div>
                    <p className="mt-3 text-sm whitespace-pre-wrap text-slate-600">
                      {r.instructions}
                    </p>
                    {r.reference && <p className="mt-3 text-sm">Referencia: {r.reference}</p>}
                    {r.canUpload && r.status === 'PENDIENTE' && (
                      <Upload
                        busy={busy}
                        label="Archivar documento PDF"
                        onSave={(f) => save(`teacher-requests/${r.id}/files`, f)}
                      />
                    )}
                    <div className="mt-4 space-y-3">
                      {r.files.map((f, i) => (
                        <div key={f.id} className="rounded-lg bg-slate-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="min-w-0 text-xs font-semibold break-all">
                              Versión {r.files.length - i} · {f.filename} ·{' '}
                              {humanizeSystemValue(f.status)}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => download(`teacher-files/${f.id}/file`, f.filename)}
                            >
                              Descargar
                            </Button>
                          </div>
                          {f.feedback && (
                            <p className="mt-3 text-sm whitespace-pre-wrap">{f.feedback}</p>
                          )}
                          {i === 0 && f.status === 'PENDIENTE' && course.canManageDocuments && (
                            <Review
                              busy={busy}
                              save={(form) =>
                                save(
                                  `teacher-files/${f.id}/review`,
                                  {
                                    status: text(form, 'status'),
                                    feedback: text(form, 'feedback'),
                                  },
                                  'PATCH',
                                )
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    {course.canManageDocuments &&
                      r.files[0]?.status === 'APROBADO' &&
                      r.status !== 'COMPLETADO' && (
                        <Editor
                          title={
                            r.status === 'PENDIENTE'
                              ? 'Registrar envío del trámite'
                              : 'Registrar trámite completado'
                          }
                          busy={busy}
                          onSave={(f) =>
                            save(
                              `teacher-requests/${r.id}/process`,
                              {
                                status: r.status === 'PENDIENTE' ? 'ENVIADO' : 'COMPLETADO',
                                reference: text(f, 'reference'),
                              },
                              'PATCH',
                            )
                          }
                        >
                          <Field label="Referencia o constancia del trámite">
                            <input
                              name="reference"
                              required
                              minLength={3}
                              maxLength={200}
                              className={inputClass}
                            />
                          </Field>
                        </Editor>
                      )}
                  </article>
                ))
              )}
            </Panel>
          )}
        </>
      )}
    </main>
  );
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border bg-white p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="my-4 rounded-lg border border-dashed bg-slate-50 p-5 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
      {value}
    </span>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 text-xs font-semibold text-slate-600">
      {label}
      {children}
    </label>
  );
}
function Editor({
  title,
  children,
  onSave,
  busy,
}: {
  title: string;
  children: ReactNode;
  onSave: (f: FormData) => Promise<void>;
  busy: boolean;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await onSave(new FormData(form));
      form.closest('details')?.removeAttribute('open');
    } catch {
      /* The workspace presents the API error. */
    }
  }
  return (
    <details className="mt-4 rounded-xl border bg-slate-50/50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-blue-700">{title}</summary>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <fieldset disabled={busy} className="contents">
          {children}
          <div className="sm:col-span-2">
            <Button disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </fieldset>
      </form>
    </details>
  );
}
function TeacherSelect({ teachers, load = false }: { teachers: Teacher[]; load?: boolean }) {
  return (
    <Field label="Docente">
      <select name="teacherId" required className={inputClass} defaultValue="">
        <option value="">Seleccionar docente</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {load
              ? ` · ${t.groups}/${t.profile?.maxGroups} grupos · ${t.students}/${t.profile?.maxStudents} estudiantes`
              : ''}
          </option>
        ))}
      </select>
    </Field>
  );
}
function ProjectSelect({
  projects,
  value,
  onChange,
}: {
  projects: { id: string; title: string; code: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Grupo de investigación">
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          Selecciona un grupo
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} · {p.title}
          </option>
        ))}
      </select>
    </Field>
  );
}
function MilestoneFields({
  projects,
  milestone,
}: {
  projects: { id: string; title: string; code: string }[];
  milestone?: Milestone;
}) {
  return (
    <>
      <Field label="Actividad">
        <input
          name="title"
          required
          minLength={3}
          maxLength={200}
          defaultValue={milestone?.title}
          className={inputClass}
        />
      </Field>
      <Field label="Tipo de actividad">
        <select
          name="type"
          defaultValue={milestone?.type ?? 'AVANCE'}
          disabled={!!milestone}
          className={inputClass}
        >
          <option value="INICIO">Inicio del curso</option>
          <option value="AVANCE">Entrega de avance</option>
          <option value="ASESORIA">Asesoría</option>
          <option value="DEFENSA">Presentación / defensa final</option>
          <option value="NORMATIVA">Orientación normativa</option>
        </select>
      </Field>
      <Field label="Alcance">
        <select
          name="projectId"
          defaultValue={milestone?.projectId ?? ''}
          disabled={!!milestone}
          className={inputClass}
        >
          <option value="">Todos los grupos del curso</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Fecha y hora límite">
        <input
          name="dueAt"
          type="datetime-local"
          required
          defaultValue={milestone ? localDate(milestone.dueAt) : ''}
          className={inputClass}
        />
      </Field>
      <Field label="Instrucciones o normativa">
        <textarea
          name="instructions"
          minLength={3}
          maxLength={5000}
          required
          defaultValue={milestone?.instructions}
          className={inputClass}
        />
      </Field>
      <Field label="Estado">
        <select
          name="status"
          defaultValue={milestone?.status ?? 'PROGRAMADO'}
          className={inputClass}
        >
          <option value="PROGRAMADO">Programado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
      </Field>
    </>
  );
}
function milestoneBody(f: FormData) {
  return {
    title: text(f, 'title'),
    type: text(f, 'type'),
    projectId: text(f, 'projectId') || undefined,
    dueAt: `${text(f, 'dueAt')}:00-04:00`,
    instructions: text(f, 'instructions'),
    status: text(f, 'status'),
  };
}
function Upload({
  busy,
  label,
  onSave,
}: {
  busy: boolean;
  label: string;
  onSave: (f: FormData) => Promise<void>;
}) {
  return (
    <Editor title={label} busy={busy} onSave={onSave}>
      <Field label="Archivo PDF (máximo 8 MB)">
        <input
          type="file"
          name="file"
          accept="application/pdf,.pdf"
          required
          className={inputClass}
        />
      </Field>
    </Editor>
  );
}
function Review({ busy, save }: { busy: boolean; save: (f: FormData) => Promise<void> }) {
  return (
    <Editor title="Registrar revisión" busy={busy} onSave={save}>
      <Field label="Resultado">
        <select name="status" className={inputClass}>
          <option value="APROBADO">Aprobado</option>
          <option value="CAMBIOS">Requiere ajustes</option>
        </select>
      </Field>
      <Field label="Retroalimentación">
        <textarea name="feedback" minLength={3} maxLength={5000} required className={inputClass} />
      </Field>
    </Editor>
  );
}
