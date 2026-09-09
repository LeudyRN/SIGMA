'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EntityDialog } from '@/components/ui/entity-dialog';
import { apiJson } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

interface Participant {
  id: string;
  registration: string;
  name: string;
  phone: string | null;
  contactConfirmed: boolean;
  grade: number | null;
}
interface Payment {
  id: string;
  reference: string;
  simulated: boolean;
  channel: string | null;
  status: string;
  amount: number;
  invoice: string | null;
  createdAt: string;
}
interface Enrollment {
  id: string;
  code: string;
  offerId: string;
  offer: string;
  teachingMode: string | null;
  degreeType: string;
  career: string;
  campus: string;
  status: string;
  receivedAt: string | null;
  validatedAt: string | null;
  debtOpenedAt: string | null;
  channel: string | null;
  amount: number;
  currency: string;
  paid: boolean;
  whatsappUrl: string | null;
  remittedAt: string | null;
  observation: string | null;
  participants: Participant[];
  documents: { id: string; type: string; status: string }[];
  payments: Payment[];
}
interface Group {
  id: string;
  title: string;
  coordinatorId: string;
  coordinator: string;
  whatsappUrl: string;
  teachingBudget: number;
  materialsBudget: number;
  capacity: number;
  price: number;
  remittedAt: string | null;
}
interface Plan {
  id: string;
  name: string;
  maxSubjects: number;
  maxCredits: number;
  fromSemester: number;
}
interface Workspace {
  items: Enrollment[];
  contact: { phone: string; confirmed: boolean };
  groups: Group[];
  coordinators: { id: string; name: string }[];
  plans: Plan[];
}
interface Action {
  path: string;
  method?: string;
  body?: Record<string, unknown>;
}
const money = (amount: number, currency = 'DOP') =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency }).format(amount);
const fieldClass = 'w-full min-w-0 rounded-xl border bg-white p-3 text-sm focus:outline-blue-600';
const statusLabels: Record<string, string> = {
  VALIDANDO: 'En revisión',
  PENDIENTE_PAGO: 'Deuda activa',
  CONFIRMADA: 'Inscripción confirmada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
  NO_ELEGIBLE: 'No elegible',
};
const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('es-DO') : 'Pendiente';
export function MonographWorkspace({ paymentsOnly = false }: { paymentsOnly?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const allow = (p: string) =>
    !!user &&
    (user.roles.some((r) => r.code === 'ADMIN') ||
      user.permissions.includes('*') ||
      user.permissions.includes(p));
  const student =
    !!user?.roles.some((r) => r.code === 'ESTUDIANTE') &&
    ![
      'MONOGRAFICO_RECIBIR',
      'MONOGRAFICO_VALIDAR',
      'MONOGRAFICO_GRUPOS',
      'MONOGRAFICO_CAJA',
      'MONOGRAFICO_REPORTES',
    ].some(allow);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['monograph', user?.id],
    queryFn: () => apiJson<Workspace>('/monograph'),
    enabled: !!user,
  });
  const [tab, setTab] = useState('expedientes');
  const [search, setSearch] = useState('');
  const [review, setReview] = useState<Enrollment | null>(null);
  const [simulation, setSimulation] = useState<{
    row: Enrollment;
    channel: 'CAJA' | 'VIRTUAL';
    key: string;
  } | null>(null);
  const mutation = useMutation({
    mutationFn: (a: Action) =>
      apiJson(a.path, { method: a.method ?? 'POST', body: JSON.stringify(a.body ?? {}) }),
    onSuccess: async () => {
      toast.success('Operación guardada.');
      setReview(null);
      setSimulation(null);
      await client.invalidateQueries({ queryKey: ['monograph'] });
      await client.invalidateQueries({ queryKey: ['student-process'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const run = (path: string, body?: Record<string, unknown>, method = 'POST') =>
    mutation.mutate({ path, body, method });
  if (query.isPending) return <p role="status">Cargando seguimiento de UCOTESIS…</p>;
  if (query.isError)
    return (
      <div role="alert" className="rounded-2xl border p-6">
        <p>{query.error.message}</p>
        <Button onClick={() => query.refetch()}>Reintentar</Button>
      </div>
    );
  const data = query.data;
  const items = data.items.filter((r) =>
    [r.code, r.offer, r.career, ...r.participants.flatMap((p) => [p.name, p.registration])]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const disabled = mutation.isPending;
  const base = (r: Enrollment) => `/monograph/enrollments/${r.id}`;
  return (
    <div className="space-y-5">
      <header className="rounded-3xl border bg-white p-6">
        <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">UCOTESIS · UASD</p>
        <h1 className="mt-2 text-2xl font-bold">
          {paymentsOnly
            ? 'Deudas y pagos simulados'
            : student
              ? 'Mi proceso de monográfico'
              : 'Gestión de monográficos'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Recepción del expediente → revisión de Secretaría → deuda → pago → grupo y notas.
        </p>
      </header>
      {paymentsOnly && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <strong>Entorno de simulación.</strong> No se cobra dinero ni se piden tarjetas o
          comprobantes bancarios. Los recibos no tienen validez fiscal. Caja representa el cobro
          presencial; el canal virtual simula la conciliación de Tesorería central.
        </div>
      )}
      {student && !data.contact.confirmed && (
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-bold">Confirma tu contacto para UCOTESIS</h2>
          <p className="mt-1 text-sm text-slate-600">
            Este número se usará para la logística del grupo. La confirmación es una declaración
            tuya; no se envía un SMS.
          </p>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run('/monograph/contact', { phone: f.get('phone'), confirmed: true }, 'PATCH');
            }}
          >
            <Field label="Teléfono / WhatsApp con código de país">
              <input
                name="phone"
                type="tel"
                defaultValue={data.contact.phone}
                placeholder="+18095551234"
                pattern="\+?[1-9][0-9]{9,14}"
                required
                className={fieldClass}
              />
            </Field>
            <label className="text-sm">
              <input type="checkbox" required className="mr-2" />
              Confirmo que este contacto es correcto
            </label>
            <Button disabled={disabled}>Guardar contacto</Button>
          </form>
        </section>
      )}
      {!paymentsOnly && !student && (
        <nav aria-label="Gestión del curso" className="flex flex-wrap gap-2">
          {[
            ['expedientes', 'Expedientes'],
            ['grupos', 'Grupos y plantillas'],
            ...(allow('MONOGRAFICO_REPORTES') ? [['reportes', 'Informe institucional']] : []),
            ...(allow('MONOGRAFICO_REGLAS') ? [['reglas', 'Elegibilidad por plan']] : []),
          ].map(([key, label]) => (
            <Button
              key={key}
              variant={tab === key ? 'default' : 'outline'}
              onClick={() => setTab(key)}
            >
              {label}
            </Button>
          ))}
        </nav>
      )}
      {(paymentsOnly || student || tab === 'expedientes') && (
        <>
          <section className="rounded-2xl border bg-white p-5">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Buscar matrícula, estudiante, curso o inscripción">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={fieldClass}
                />
              </Field>
              <Button variant="outline" onClick={() => query.refetch()}>
                Actualizar
              </Button>
              {!paymentsOnly && (
                <Link href="/app/documentos" className="p-2 text-sm font-semibold text-blue-700">
                  Revisar documentos
                </Link>
              )}
            </div>
          </section>
          {!items.length && (
            <p className="rounded-2xl border bg-white p-6">
              {student
                ? 'Todavía no tienes solicitudes. Consulta las ofertas disponibles.'
                : 'No hay expedientes para esta búsqueda o asignación.'}{' '}
              {student && (
                <Link href="/app/ofertas" className="text-blue-700 underline">
                  Ver ofertas
                </Link>
              )}
            </p>
          )}
          {items.map((row) => (
            <article key={row.id} className="rounded-2xl border bg-white p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">
                    {row.code} · {row.campus}
                  </p>
                  <h2 className="mt-1 text-lg font-bold">{row.offer}</h2>
                  <p className="text-sm text-slate-600">
                    {row.career} · {row.degreeType} · {row.teachingMode ?? 'Modalidad por definir'}
                  </p>
                </div>
                <span className="self-start rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
                  {statusLabels[row.status] ?? row.status}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {row.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm"
                  >
                    <span>
                      {p.registration} · {p.name}
                      {p.phone && ` · ${p.phone}`}
                      <span className="ml-2 text-slate-500">
                        {p.contactConfirmed ? 'Contacto confirmado' : 'Contacto pendiente'}
                      </span>
                    </span>
                    {p.grade !== null && (
                      <strong>
                        Nota: {p.grade} / 100 {row.remittedAt ? '· Remitida' : '· Borrador'}
                      </strong>
                    )}
                  </div>
                ))}
              </div>
              {!paymentsOnly && (
                <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                  {[
                    ['Recepción', date(row.receivedAt)],
                    ['Validación', date(row.validatedAt)],
                    ['Deuda', date(row.debtOpenedAt)],
                    ['Pago', row.paid ? 'Saldado' : 'Pendiente'],
                  ].map(([label, value]) => (
                    <li key={label} className="rounded-xl border p-3">
                      <strong className="block">{label}</strong>
                      <span className="text-slate-500">{value}</span>
                    </li>
                  ))}
                </ol>
              )}
              {!paymentsOnly && row.documents.length > 0 && (
                <p className="mt-3 text-sm">
                  Documentos:{' '}
                  {row.documents
                    .map(
                      (d) =>
                        `${d.type}: ${d.status === 'SIN_ENTREGAR' ? 'por entregar' : d.status.toLowerCase()}`,
                    )
                    .join(' · ')}
                </p>
              )}
              {!paymentsOnly && row.observation && (
                <p className="mt-3 text-sm text-slate-600">
                  Observación de Secretaría: {row.observation}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <strong>
                  {row.debtOpenedAt ? 'Deuda del curso' : 'Costo del curso'}:{' '}
                  {money(row.amount, row.currency)}
                </strong>
                {row.paid ? (
                  <span className="text-sm text-green-700">
                    Saldada
                    {row.payments.some((p) => p.simulated && p.status === 'APROBADO')
                      ? ' mediante simulación'
                      : ''}
                  </span>
                ) : !row.debtOpenedAt ? (
                  <span className="text-sm text-slate-600">
                    Secretaría debe completar la revisión y crear el pago.
                  </span>
                ) : (
                  <span className="text-sm">Canal: {row.channel ?? 'Por elegir'}</span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {!paymentsOnly &&
                  !row.paid &&
                  !['CANCELADA', 'RECHAZADA', 'NO_ELEGIBLE'].includes(row.status) && (
                    <>
                      {allow('MONOGRAFICO_RECIBIR') && !row.receivedAt && (
                        <Button disabled={disabled} onClick={() => run(`${base(row)}/receive`)}>
                          Registrar recepción
                        </Button>
                      )}
                      {allow('MONOGRAFICO_VALIDAR') && row.receivedAt && !row.debtOpenedAt && (
                        <Button
                          variant="outline"
                          disabled={disabled}
                          onClick={() => setReview(row)}
                        >
                          Revisar expediente
                        </Button>
                      )}
                      {allow('MONOGRAFICO_VALIDAR') && row.validatedAt && !row.debtOpenedAt && (
                        <Button disabled={disabled} onClick={() => run(`${base(row)}/debt`)}>
                          Crear pago · abrir deuda
                        </Button>
                      )}
                    </>
                  )}
                {row.debtOpenedAt &&
                  !row.paid &&
                  !['CANCELADA', 'RECHAZADA'].includes(row.status) && (
                    <>
                      {student && (
                        <>
                          <Button
                            disabled={disabled}
                            variant="outline"
                            onClick={() =>
                              run(`${base(row)}/channel`, { channel: 'CAJA' }, 'PATCH')
                            }
                          >
                            Elegir Caja presencial
                          </Button>
                          <Button
                            disabled={disabled}
                            variant="outline"
                            onClick={() =>
                              run(`${base(row)}/channel`, { channel: 'VIRTUAL' }, 'PATCH')
                            }
                          >
                            Elegir pago virtual
                          </Button>
                          {row.channel === 'CAJA' && (
                            <p className="w-full text-sm text-slate-600">
                              Presenta tu matrícula en Caja. El cajero completará la simulación del
                              cobro.
                            </p>
                          )}
                          {row.channel === 'VIRTUAL' && (
                            <Button
                              disabled={disabled}
                              onClick={() =>
                                setSimulation({ row, channel: 'VIRTUAL', key: crypto.randomUUID() })
                              }
                            >
                              Simular pago virtual
                            </Button>
                          )}
                        </>
                      )}
                      {allow('MONOGRAFICO_CAJA') && row.channel === 'CAJA' && (
                        <Button
                          disabled={disabled}
                          onClick={() =>
                            setSimulation({ row, channel: 'CAJA', key: crypto.randomUUID() })
                          }
                        >
                          Simular cobro en Caja
                        </Button>
                      )}
                    </>
                  )}
                {row.paid && row.whatsappUrl && (
                  <a
                    className="rounded-xl border px-4 py-2 text-sm font-bold text-green-700"
                    href={row.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir grupo de WhatsApp
                  </a>
                )}
                {!paymentsOnly &&
                  row.paid &&
                  !row.remittedAt &&
                  allow('MONOGRAFICO_NOTAS') &&
                  data.groups.some((g) => g.id === row.offerId && g.coordinatorId === user?.id) &&
                  row.participants.map((p) => (
                    <GradeForm
                      key={p.id}
                      participant={p}
                      disabled={disabled}
                      submit={(body) => run(`${base(row)}/grade`, body)}
                    />
                  ))}
              </div>
              {row.payments.length > 0 && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer font-semibold">
                    Pagos y recibos ({row.payments.length})
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {row.payments.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                      >
                        <span>
                          {p.simulated ? 'SIMULACIÓN' : 'Registro histórico'} ·{' '}
                          {p.channel ?? 'Canal histórico'} · {p.status} ·{' '}
                          {money(p.amount, row.currency)}
                        </span>
                        {p.invoice && (
                          <a
                            className="text-blue-700 underline"
                            href={`/api/payments/invoices/${p.id}/pdf`}
                          >
                            Descargar {p.simulated ? 'recibo de demostración' : 'recibo'}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          ))}
        </>
      )}
      {!paymentsOnly && !student && tab === 'grupos' && (
        <div className="space-y-4">
          {data.groups.length === 0 && <p>No tienes cursos asignados.</p>}
          {data.groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              items={data.items.filter((r) => r.offerId === group.id)}
              coordinators={data.coordinators}
              editable={allow('MONOGRAFICO_GRUPOS')}
              disabled={disabled}
              save={(body) => run(`/monograph/groups/${group.id}`, body, 'PATCH')}
              remit={() => run(`/monograph/groups/${group.id}/remit`, { confirmed: true })}
            />
          ))}
        </div>
      )}
      {!paymentsOnly && tab === 'reglas' && allow('MONOGRAFICO_REGLAS') && (
        <section className="space-y-4">
          <div className="rounded-2xl border bg-blue-50 p-5">
            <h2 className="font-bold">Política académica por plan</h2>
            <p className="mt-2 text-sm">
              Cero exige completar todas las asignaturas previas. Una excepción requiere cumplir
              ambos límites y que todas las materias pendientes pertenezcan al semestre indicado o
              posteriores. Los créditos optativos pendientes siguen bloqueando la elegibilidad. No
              se asigna una excepción automática a Psicología.
            </p>
          </div>
          {data.plans.map((plan) => (
            <form
              key={plan.id}
              className="rounded-2xl border bg-white p-5"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(
                  `/monograph/plans/${plan.id}`,
                  {
                    maxSubjects: Number(f.get('subjects')),
                    maxCredits: Number(f.get('credits')),
                    fromSemester: Number(f.get('semester')),
                  },
                  'PATCH',
                );
              }}
            >
              <h3 className="mb-4 font-bold">{plan.name}</h3>
              <div className="grid items-end gap-3 sm:grid-cols-4">
                <Field label="Máximo de materias pendientes">
                  <input
                    name="subjects"
                    type="number"
                    min={0}
                    max={50}
                    required
                    defaultValue={plan.maxSubjects}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Máximo de créditos pendientes">
                  <input
                    name="credits"
                    type="number"
                    min={0}
                    max={200}
                    required
                    defaultValue={plan.maxCredits}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Desde el semestre">
                  <input
                    name="semester"
                    type="number"
                    min={1}
                    max={30}
                    required
                    defaultValue={plan.fromSemester}
                    className={fieldClass}
                  />
                </Field>
                <Button disabled={disabled}>Guardar política</Button>
              </div>
            </form>
          ))}
        </section>
      )}
      {!paymentsOnly && tab === 'reportes' && allow('MONOGRAFICO_REPORTES') && (
        <Report items={data.items} groups={data.groups} />
      )}
      <EntityDialog
        open={!!review}
        onClose={() => setReview(null)}
        title="Revisión final de Secretaría"
        description="La validación vuelve a comprobar la elegibilidad académica y los documentos solicitados."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!review) return;
            const f = new FormData(e.currentTarget);
            run(`${base(review)}/validate`, {
              documentsComplete: true,
              observation: String(f.get('observation') ?? ''),
            });
          }}
        >
          <p className="text-sm">
            {review?.code} · {review?.offer}
          </p>
          <Field label="Observación">
            <textarea
              name="observation"
              maxLength={1000}
              defaultValue={review?.observation ?? ''}
              className={fieldClass}
            />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" required className="mt-1" />
            He revisado el expediente y confirmo que la documentación está completa.
          </label>
          <Button disabled={disabled}>Validar expediente</Button>
        </form>
      </EntityDialog>
      <EntityDialog
        open={!!simulation}
        onClose={() => setSimulation(null)}
        title={
          simulation?.channel === 'CAJA' ? 'Simulador de Caja local' : 'Simulador de pago virtual'
        }
        description="Demostración sin movimiento de dinero ni datos bancarios."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!simulation) return;
            const f = new FormData(e.currentTarget);
            run(`${base(simulation.row)}/simulate`, {
              channel: simulation.channel,
              outcome: f.get('outcome'),
              idempotencyKey: simulation.key,
              simulationAcknowledged: true,
            });
          }}
        >
          <p className="text-lg font-bold">
            {simulation && money(simulation.row.amount, simulation.row.currency)}
          </p>
          <Field label="Resultado a simular">
            <select name="outcome" className={fieldClass}>
              <option value="APROBADO">Pago aprobado</option>
              <option value="RECHAZADO">Pago rechazado (permite reintentar)</option>
            </select>
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input required type="checkbox" className="mt-1" />
            Entiendo que este pago y su recibo son de demostración.
          </label>
          <Button disabled={disabled}>Ejecutar simulación</Button>
        </form>
      </EntityDialog>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
function GradeForm({
  participant,
  disabled,
  submit,
}: {
  participant: Participant;
  disabled: boolean;
  submit: (body: Record<string, unknown>) => void;
}) {
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit({
          studentId: participant.id,
          grade: Number(f.get('grade')),
          observation: String(f.get('observation') ?? ''),
        });
      }}
    >
      <Field label={`Nota de ${participant.registration} (0–100)`}>
        <input
          name="grade"
          type="number"
          min={0}
          max={100}
          step="0.01"
          required
          defaultValue={participant.grade ?? ''}
          className={fieldClass}
        />
      </Field>
      <Field label="Observación de progreso">
        <input name="observation" maxLength={1000} className={fieldClass} />
      </Field>
      <Button disabled={disabled}>Guardar nota</Button>
    </form>
  );
}
function GroupCard({
  group,
  items,
  coordinators,
  editable,
  disabled,
  save,
  remit,
}: {
  group: Group;
  items: Enrollment[];
  coordinators: Workspace['coordinators'];
  editable: boolean;
  disabled: boolean;
  save: (body: Record<string, unknown>) => void;
  remit: () => void;
}) {
  const [remitting, setRemitting] = useState(false);
  const paid = items.filter((r) => r.paid && !['CANCELADA', 'RECHAZADA'].includes(r.status));
  const income = paid.reduce((sum, r) => sum + r.amount, 0);
  return (
    <article className="rounded-2xl border bg-white p-5">
      <h2 className="text-lg font-bold">{group.title}</h2>
      <p className="mt-1 text-sm text-slate-600">
        Coordinador: {group.coordinator} · {paid.reduce((n, r) => n + r.participants.length, 0)}{' '}
        estudiantes pagados ·{' '}
        {group.remittedAt ? `Notas remitidas el ${date(group.remittedAt)}` : 'Notas por remitir'}
      </p>
      {editable && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save({
              coordinatorId: f.get('coordinator') || undefined,
              whatsappUrl: f.get('whatsapp'),
              teachingBudget: Number(f.get('teaching')),
              materialsBudget: Number(f.get('materials')),
            });
          }}
        >
          <Field label="Coordinador del monográfico">
            <select name="coordinator" defaultValue={group.coordinatorId} className={fieldClass}>
              <option value="">Sin asignar</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Invitación al grupo de WhatsApp">
            <input
              name="whatsapp"
              type="url"
              defaultValue={group.whatsappUrl}
              placeholder="https://chat.whatsapp.com/…"
              className={fieldClass}
            />
          </Field>
          <Field label="Presupuesto de docencia (DOP)">
            <input
              name="teaching"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={group.teachingBudget}
              className={fieldClass}
            />
          </Field>
          <Field label="Presupuesto de materiales (DOP)">
            <input
              name="materials"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={group.materialsBudget}
              className={fieldClass}
            />
          </Field>
          <Button disabled={disabled}>Guardar grupo y presupuesto</Button>
        </form>
      )}
      <p className="mt-4 text-sm">
        Ingresos registrados: {money(income)} · Presupuesto:{' '}
        {money(group.teachingBudget + group.materialsBudget)} · Diferencia:{' '}
        {money(income - group.teachingBudget - group.materialsBudget)}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            exportCsv(
              `plantilla-${group.id}`,
              ['Curso', 'Coordinador', 'Matrícula', 'Estudiante', 'WhatsApp', 'Nota', 'Remisión'],
              paid.flatMap((r) =>
                r.participants.map((p) => [
                  group.title,
                  group.coordinator,
                  p.registration,
                  p.name,
                  p.phone ?? '',
                  p.grade ?? '',
                  group.remittedAt ?? 'Borrador',
                ]),
              ),
            )
          }
        >
          Exportar plantilla académica
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            exportCsv(
              `presupuesto-${group.id}`,
              [
                'Curso',
                'Coordinador',
                'Cupos',
                'Precio',
                'Proyección cupo completo',
                'Ingresos registrados',
                'Docencia',
                'Materiales',
                'Diferencia',
              ],
              [
                [
                  group.title,
                  group.coordinator,
                  group.capacity,
                  group.price,
                  group.capacity * group.price,
                  income,
                  group.teachingBudget,
                  group.materialsBudget,
                  income - group.teachingBudget - group.materialsBudget,
                ],
              ],
            )
          }
        >
          Exportar presupuesto y plantilla docente
        </Button>
        {editable && !group.remittedAt && (
          <Button disabled={disabled} onClick={() => setRemitting(true)}>
            Remitir notas a Dirección
          </Button>
        )}
      </div>
      <EntityDialog
        open={remitting}
        onClose={() => setRemitting(false)}
        title="Remitir plantilla de calificaciones"
        description="Confirma la plantilla final. Las notas quedarán cerradas para edición. La remisión se registra en SIGMA; descarga la plantilla para entregarla por el canal institucional."
      >
        <Button
          disabled={disabled}
          onClick={() => {
            remit();
            setRemitting(false);
          }}
        >
          Confirmar remisión
        </Button>
      </EntityDialog>
    </article>
  );
}
function Report({ items, groups }: { items: Enrollment[]; groups: Group[] }) {
  const payments = items
    .flatMap((r) => r.payments.map((p) => ({ ...p, currency: r.currency })))
    .filter((p) => p.status === 'APROBADO');
  return (
    <section className="space-y-4 rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-bold">Informe para Subdirección Académica</h2>
      <p className="text-sm text-slate-600">
        Los importes de demostración se presentan separados de los registros históricos. Exporta la
        información consolidada para la revisión institucional.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {['CAJA', 'VIRTUAL', 'HISTORICO'].map((channel) => (
          <div key={channel} className="rounded-xl border p-4">
            <h3 className="font-semibold">
              {channel === 'HISTORICO'
                ? 'Pagos históricos'
                : `Simulación ${channel === 'CAJA' ? 'Caja local' : 'Tesorería central'}`}
            </h3>
            {[...new Set(payments.map((p) => p.currency))].map((currency) => (
              <p key={currency} className="mt-2 text-xl">
                {money(
                  payments
                    .filter(
                      (p) =>
                        p.currency === currency &&
                        (channel === 'HISTORICO'
                          ? !p.simulated
                          : p.simulated && p.channel === channel),
                    )
                    .reduce((n, p) => n + p.amount, 0),
                  currency,
                )}
              </p>
            ))}
          </div>
        ))}
      </div>
      <p>
        {items.length} expedientes · {items.filter((r) => r.paid).length} saldados ·{' '}
        {
          items.filter(
            (r) => r.debtOpenedAt && !r.paid && !['CANCELADA', 'RECHAZADA'].includes(r.status),
          ).length
        }{' '}
        deudas activas · {groups.filter((g) => g.remittedAt).length} cursos con notas remitidas.
      </p>
      <Button
        onClick={() =>
          exportCsv(
            'informe-ucotesis',
            [
              'Inscripción',
              'Curso',
              'Recinto',
              'Carrera',
              'Modalidad',
              'Estado',
              'Matrícula',
              'Estudiante',
              'Contacto confirmado',
              'Deuda abierta',
              'Monto',
              'Moneda',
              'Canal',
              'Pagado',
              'Nota',
              'Remisión',
            ],
            items.flatMap((r) =>
              r.participants.map((p) => [
                r.code,
                r.offer,
                r.campus,
                r.career,
                r.teachingMode ?? '',
                r.status,
                p.registration,
                p.name,
                p.contactConfirmed ? 'Sí' : 'No',
                r.debtOpenedAt ?? '',
                r.amount,
                r.currency,
                r.channel ?? '',
                r.paid ? 'Sí' : 'No',
                p.grade ?? '',
                r.remittedAt ?? '',
              ]),
            ),
          )
        }
      >
        Exportar informe consolidado
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          exportCsv(
            'ingresos-ucotesis',
            [
              'Inscripción',
              'Referencia',
              'Fecha',
              'Canal',
              'Simulado',
              'Estado',
              'Monto',
              'Moneda',
            ],
            items.flatMap((r) =>
              r.payments.map((p) => [
                r.code,
                p.reference,
                p.createdAt,
                p.channel ?? 'Histórico',
                p.simulated ? 'Sí' : 'No',
                p.status,
                p.amount,
                r.currency,
              ]),
            ),
          )
        }
      >
        Exportar ingresos por canal
      </Button>
    </section>
  );
}
function exportCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const raw = String(v);
    return `"${(/^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw).replaceAll('"', '""')}"`;
  };
  const blob = new Blob(
    ['\uFEFF' + [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')],
    { type: 'text/csv;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
