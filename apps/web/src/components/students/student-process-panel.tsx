'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, BookOpenCheck, FileText, LoaderCircle, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch, readApiError } from '@/lib/api';

type ProcessMode = 'offers' | 'enrollments' | 'payments' | 'invoices';
interface Offer {
  id: string;
  title: string;
  description: string | null;
  modality: string;
  period: string;
  campus: string;
  career: string;
  registrationEnd: string;
  available: number;
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
  offer: { title: string; modality: string; campus: string; career: string };
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
      toast.success('Solicitud creada. Continúa con el pago.');
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
    (offers.isPending && mode === 'offers') || (enrollments.isPending && mode !== 'offers');
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
      {mode === 'offers' && (
        <div className="grid gap-5 lg:grid-cols-2">
          {offers.data?.items.map((offer) => (
            <article key={offer.id} className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {offer.modality}
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
                disabled={request.isPending || offer.available === 0}
              >
                <BookOpenCheck className="size-4" /> Solicitar inscripción
              </Button>
            </article>
          ))}
          {offers.data?.items.length === 0 && (
            <Empty text="No hay ofertas publicadas para tu recinto y carrera." />
          )}
        </div>
      )}
      {mode === 'enrollments' && <EnrollmentList items={enrollments.data?.items ?? []} />}
      {mode === 'payments' && (
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
      {mode === 'invoices' && <InvoiceList enrollments={enrollments.data?.items ?? []} />}
    </section>
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
                {item.offer.modality} · {item.offer.campus} · {item.offer.career}
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
            {latest.method} · {latest.status}
          </p>
          {latest.proofStatus && (
            <p className="mt-2 text-xs font-bold text-blue-700">
              Comprobante: {latest.proofStatus}
            </p>
          )}
          {latest.proofObservation && (
            <p className="mt-1 text-xs text-red-700">{latest.proofObservation}</p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="mb-3 text-sm text-slate-600">
            Selecciona un método para registrar la intención. SIGMA no simula aprobaciones: el
            estado final debe llegar del proveedor.
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
  const invoices = enrollments.flatMap((enrollment) =>
    enrollment.payments
      .filter((payment) => payment.invoice)
      .map((payment) => ({ ...payment.invoice!, payment })),
  );
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
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex font-bold text-blue-700"
            >
              Descargar PDF
            </a>
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
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-3xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">
      {text}
    </p>
  );
}
