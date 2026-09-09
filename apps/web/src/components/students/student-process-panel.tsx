'use client';

import Link from 'next/link';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeDollarSign,
  BookOpenCheck,
  Download,
  FileText,
  LoaderCircle,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch, readApiError } from '@/lib/api';
import { humanizeSystemValue } from '@/lib/humanize-system-value';

type ProcessMode = 'offers' | 'enrollments' | 'payments' | 'invoices';
interface Offer {
  id: string;
  title: string;
  description: string | null;
  modality: string;
  teachingMode?: string | null;
  period: string;
  campus: string;
  career: string;
  registrationStart: string;
  registrationEnd: string;
  available: number;
  availability: 'ABIERTA' | 'PROXIMAMENTE' | 'AGOTADA' | 'SOLICITADA';
  canEnroll: boolean;
  existingEnrollment: { id: string; status: string; statusName: string } | null;
  amount: number;
  currency: string;
  areas: string[];
  requirements: Array<{ name: string; required: boolean }>;
}
interface Enrollment {
  id: string;
  code: string;
  status: string;
  statusName: string;
  requestedAt: string;
  amount: number;
  currency: string;
  offer: {
    title: string;
    modality: string;
    teachingMode?: string | null;
    campus: string;
    career: string;
  };
  payments: Array<{
    id: string;
    reference: string;
    status: string;
    method: string;
    amount: number;
    createdAt: string;
    invoice: { number: string; receipt: string; pdfUrl: string | null } | null;
    proofStatus: string | null;
    proofObservation: string | null;
    bankAccount: string | null;
  }>;
}
interface BankAccount {
  id: string;
  bank: string;
  accountNumber: string;
  accountType: string;
  documentType: string;
  holderDocument: string;
  holderName: string;
  currency: string;
  instructions: string | null;
}

async function read<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<T>;
}
async function write(path: string, body: object) {
  const response = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json();
}

export function StudentProcessPanel({ mode }: { mode: ProcessMode }) {
  const client = useQueryClient();
  const offers = useQuery({
    queryKey: ['student-portal', 'offers'],
    queryFn: () => read<{ items: Offer[] }>('/student-portal/offers'),
    enabled: mode === 'offers',
  });
  const enrollments = useQuery({
    queryKey: ['student-portal', 'enrollments'],
    queryFn: () => read<{ items: Enrollment[] }>('/student-portal/enrollments'),
    enabled: mode !== 'offers',
  });
  const accounts = useQuery({
    queryKey: ['student-portal', 'bank-accounts'],
    queryFn: () => read<{ items: BankAccount[] }>('/payments/bank-accounts/public'),
    enabled: mode === 'payments',
  });
  const request = useMutation({
    mutationFn: (offerId: string) => write('/student-portal/enrollments', { offerId }),
    onSuccess: () => {
      toast.success(
        'Solicitud creada. Confirma tu contacto y sigue la revisión de Secretaría en Gestión de monográficos.',
      );
      void client.invalidateQueries({ queryKey: ['student-portal'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const payment = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiFetch('/payments/transfers', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(await readApiError(response));
      return response.json();
    },
    onSuccess: (result: { message?: string }) => {
      toast.success('Transferencia enviada para validación.', { description: result.message });
      void client.invalidateQueries({ queryKey: ['student-portal', 'enrollments'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const copy = {
    offers: ['Oferta disponible', 'Selecciona tesis o monográfico según tu recinto y carrera.'],
    enrollments: ['Mi inscripción', 'Seguimiento de tus solicitudes en UCOTESIS.'],
    payments: [
      'Mis pagos',
      'Registra la intención y consulta el estado informado por el proveedor.',
    ],
    invoices: ['Mis facturas', 'Comprobantes digitales vinculados a pagos aprobados.'],
  }[mode];
  const loading =
    (offers.isPending && mode === 'offers') ||
    (enrollments.isPending && mode !== 'offers') ||
    (accounts.isPending && mode === 'payments');
  return (
    <section className="w-full space-y-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-bold tracking-widest text-blue-700 uppercase">
          Portal estudiantil
        </p>
        <h1 className="mt-1 text-3xl font-bold">{copy[0]}</h1>
        <p className="mt-2 text-slate-600">{copy[1]}</p>
      </header>
      {loading && (
        <p className="rounded-2xl border bg-white p-8 text-center">
          <LoaderCircle className="mx-auto size-6 animate-spin" />
        </p>
      )}
      {mode === 'offers' && offers.isError && <LoadError onRetry={() => void offers.refetch()} />}
      {mode !== 'offers' && enrollments.isError && (
        <LoadError onRetry={() => void enrollments.refetch()} />
      )}
      {mode === 'payments' && accounts.isError && (
        <LoadError onRetry={() => void accounts.refetch()} />
      )}
      {mode === 'offers' && !offers.isError && (
        <div className="grid gap-5 lg:grid-cols-2">
          {offers.data?.items.map((offer) => (
            <article key={offer.id} className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {offer.modality} ·{' '}
                    {humanizeSystemValue(offer.teachingMode ?? 'Modalidad por definir')}
                  </span>
                  <h2 className="mt-3 text-xl font-bold">{offer.title}</h2>
                </div>
                <strong className="text-lg">
                  {new Intl.NumberFormat('es-DO', {
                    style: 'currency',
                    currency: offer.currency,
                  }).format(offer.amount)}
                </strong>
              </div>
              <p className="mt-3 text-sm text-slate-600">{offer.description}</p>
              <p className="mt-4 flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-blue-700" /> {offer.campus} · {offer.career}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {offer.available} cupos disponibles · Cierra{' '}
                {new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(
                  new Date(offer.registrationEnd),
                )}
              </p>
              <OfferAvailability offer={offer} />
              <div className="mt-4 flex flex-wrap gap-2">
                {offer.areas.map((area) => (
                  <span key={area} className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                    {area}
                  </span>
                ))}
              </div>
              <Button
                type="button"
                className="mt-5 w-full"
                onClick={() => request.mutate(offer.id)}
                disabled={request.isPending || !offer.canEnroll}
              >
                <BookOpenCheck className="size-4" />{' '}
                {offer.availability === 'SOLICITADA'
                  ? 'Solicitud registrada'
                  : offer.availability === 'PROXIMAMENTE'
                    ? 'Inscripción aún no abierta'
                    : offer.availability === 'AGOTADA'
                      ? 'Sin cupos disponibles'
                      : 'Solicitar inscripción'}
              </Button>
            </article>
          ))}
          {offers.data?.items.length === 0 && (
            <Empty text="No hay ofertas publicadas para tu recinto y carrera." />
          )}
        </div>
      )}
      {mode === 'enrollments' && !enrollments.isError && (
        <EnrollmentList items={enrollments.data?.items ?? []} />
      )}
      {mode === 'payments' && !enrollments.isError && !accounts.isError && (
        <div className="space-y-4">
          {(enrollments.data?.items ?? []).map((item) => (
            <PaymentCard
              key={item.id}
              enrollment={item}
              accounts={accounts.data?.items ?? []}
              pending={payment.isPending}
              onPay={(formData) => payment.mutate(formData)}
            />
          ))}
          {enrollments.data?.items.length === 0 && (
            <Empty text="Primero debes solicitar una inscripción disponible." />
          )}
        </div>
      )}
      {mode === 'invoices' && !enrollments.isError && (
        <InvoiceList enrollments={enrollments.data?.items ?? []} />
      )}
    </section>
  );
}

function OfferAvailability({ offer }: { offer: Offer }) {
  const start = new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(offer.registrationStart));
  const messages = {
    ABIERTA: 'Inscripciones abiertas.',
    PROXIMAMENTE: `Publicada. Podrás solicitarla desde ${start}.`,
    AGOTADA: 'La oferta alcanzó el límite de cupos.',
    SOLICITADA: `Ya tienes una solicitud en estado ${offer.existingEnrollment?.statusName ?? offer.existingEnrollment?.status ?? 'registrada'}.`,
  };
  return (
    <p
      className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
        offer.availability === 'ABIERTA'
          ? 'bg-emerald-50 text-emerald-800'
          : offer.availability === 'PROXIMAMENTE'
            ? 'bg-blue-50 text-blue-800'
            : 'bg-amber-50 text-amber-800'
      }`}
    >
      {messages[offer.availability]}
    </p>
  );
}

function EnrollmentList({ items }: { items: Enrollment[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <article key={item.id} className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-blue-700">{item.code}</p>
              <h2 className="mt-1 text-xl font-bold">{item.offer.title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {item.offer.modality} ·{' '}
                {humanizeSystemValue(item.offer.teachingMode ?? 'Modalidad por definir')} ·{' '}
                {item.offer.campus} · {item.offer.career}
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
              {item.statusName}
            </span>
          </div>
          <p className="mt-4 text-sm">
            Monto:{' '}
            <strong>
              {new Intl.NumberFormat('es-DO', {
                style: 'currency',
                currency: item.currency,
              }).format(item.amount)}
            </strong>
          </p>
          <Link
            href="/app/monograficos"
            className="mt-4 inline-block text-sm font-semibold text-blue-700 underline"
          >
            Seguir recepción, revisión, pago y grupo
          </Link>
        </article>
      ))}
      {items.length === 0 && <Empty text="No tienes inscripciones registradas." />}
    </div>
  );
}
function PaymentCard({
  enrollment,
  accounts,
  pending,
  onPay,
}: {
  enrollment: Enrollment;
  accounts: BankAccount[];
  pending: boolean;
  onPay: (formData: FormData) => void;
}) {
  const latest = enrollment.payments[0];
  const payable = ['ELEGIBLE', 'PENDIENTE_PAGO', 'PAGO_PROCESANDO'].includes(enrollment.status);
  const [accountId, setAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  return (
    <article className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{enrollment.offer.title}</h2>
          <p className="text-sm text-slate-500">{enrollment.code}</p>
        </div>
        <BadgeDollarSign className="size-6 text-blue-700" />
      </div>
      {latest && latest.status !== 'RECHAZADO' ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold">{latest.reference}</p>
          <p className="mt-1 text-xs text-slate-500">
            {latest.method} · {humanizeSystemValue(latest.status)}
          </p>
          {latest.proofStatus && (
            <p className="mt-2 text-xs font-bold text-blue-700">
              Comprobante: {humanizeSystemValue(latest.proofStatus)}
            </p>
          )}
          {latest.proofObservation && (
            <p className="mt-1 text-xs text-red-700">{latest.proofObservation}</p>
          )}
        </div>
      ) : !payable ? (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          Esta inscripción se encuentra en estado {enrollment.statusName} y no admite nuevos pagos.
        </p>
      ) : (
        <div className="mt-4">
          <p className="mb-3 text-sm text-slate-600">
            Selecciona la cuenta institucional, registra la referencia y adjunta el comprobante.
            Tesorería revisará la transferencia antes de confirmar la inscripción.
          </p>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!file) return toast.error('Adjunta el comprobante.');
              const data = new FormData();
              data.set('enrollmentId', enrollment.id);
              data.set('bankAccountId', accountId);
              data.set('reference', reference);
              data.set('paidAt', new Date(paidAt).toISOString());
              data.set('proof', file);
              onPay(data);
            }}
          >
            {!accounts.length && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 sm:col-span-2">
                UCOTESIS todavía no ha configurado una cuenta bancaria activa. No podrás enviar la
                transferencia hasta que se publique una.
              </p>
            )}
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-bold">Cuenta bancaria</span>
              <select
                required
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="h-11 w-full rounded-xl border px-3"
              >
                <option value="">Seleccionar</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bank} · {account.accountType} · {account.accountNumber} ·{' '}
                    {account.holderName}
                  </option>
                ))}
              </select>
            </label>
            {accountId && (
              <BankAccountDetail account={accounts.find((item) => item.id === accountId)} />
            )}
            <label>
              <span className="mb-1 block text-xs font-bold">Referencia bancaria</span>
              <input
                required
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="h-11 w-full rounded-xl border px-3"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">Fecha y hora</span>
              <input
                required
                type="datetime-local"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
                className="h-11 w-full rounded-xl border px-3"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-bold">
                Captura o comprobante (PNG, JPG o PDF)
              </span>
              <input
                required
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-xl border p-2 text-sm"
              />
            </label>
            <Button className="sm:col-span-2" type="submit" disabled={pending || !accounts.length}>
              Enviar transferencia
            </Button>
          </form>
        </div>
      )}
    </article>
  );
}
function BankAccountDetail({ account }: { account?: BankAccount }) {
  if (!account) return null;
  return (
    <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-950 sm:col-span-2">
      <strong>{account.holderName}</strong>
      <br />
      {account.documentType}: {account.holderDocument}
      <br />
      {account.instructions}
    </div>
  );
}
function InvoiceList({ enrollments }: { enrollments: Enrollment[] }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const invoices = enrollments.flatMap((enrollment) =>
    enrollment.payments
      .filter((payment) => payment.invoice)
      .map((payment) => ({ ...payment.invoice!, payment })),
  );
  async function downloadInvoice(pdfUrl: string, number: string) {
    setDownloading(number);
    try {
      const path = pdfUrl.startsWith('/api/') ? pdfUrl.slice(4) : pdfUrl;
      const response = await apiFetch(path);
      if (!response.ok) throw new Error(await readApiError(response));
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `factura-${number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible descargar la factura.');
    } finally {
      setDownloading(null);
    }
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {invoices.map(({ number, receipt, pdfUrl, payment }) => (
        <article key={number} className="rounded-3xl border bg-white p-6 shadow-sm">
          <FileText className="size-7 text-blue-700" />
          <h2 className="mt-4 font-bold">Factura {number}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Recibo {receipt} · {payment.reference}
          </p>
          {pdfUrl ? (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              disabled={downloading === number}
              onClick={() => void downloadInvoice(pdfUrl, number)}
            >
              {downloading === number ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Descargar PDF
            </Button>
          ) : (
            <p className="mt-4 text-sm text-amber-700">PDF pendiente de emisión.</p>
          )}
        </article>
      ))}
      {invoices.length === 0 && (
        <Empty text="Las facturas aparecerán después de la aprobación real del pago." />
      )}
    </div>
  );
}
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-red-200 bg-white p-8 text-center text-sm text-red-700">
      <p>No fue posible cargar la información del proceso.</p>
      <Button type="button" variant="outline" className="mt-4" onClick={onRetry}>
        <RefreshCw className="size-4" /> Reintentar
      </Button>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-3xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">
      {text}
    </p>
  );
}
