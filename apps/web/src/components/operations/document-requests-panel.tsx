'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiJson } from '@/lib/api';
import { humanizeSystemValue } from '@/lib/humanize-system-value';

type Item = Record<string, unknown>;
export function DocumentRequestsPanel({
  enrollments,
  isStudent,
  canManage,
  onSelect,
}: {
  enrollments: Item[];
  isStudent: boolean;
  canManage: boolean;
  onSelect: (enrollmentId: string, requestId: string, type: string) => void;
}) {
  const client = useQueryClient();
  const [enrollmentId, setEnrollmentId] = useState('');
  const [type, setType] = useState('');
  const [instructions, setInstructions] = useState('');
  const available = enrollments.filter(
    (e) => !['CANCELADA', 'RECHAZADA'].includes(String(e.status)),
  );
  const save = useMutation({
    mutationFn: () =>
      apiJson('/enrollments/document-requests', {
        method: 'POST',
        body: JSON.stringify({ enrollmentId, type, instructions }),
      }),
    onSuccess: () => {
      toast.success('Solicitud enviada al estudiante.');
      setType('');
      setInstructions('');
      void client.invalidateQueries({ queryKey: ['operations'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const requests = enrollments.flatMap((e) =>
    ((e.documentRequests as Item[]) ?? []).map((r) => {
      const documents = ((e.documents as Item[]) ?? [])
        .filter((d) => d.requestId === r.id)
        .sort((a, b) => Number(BigInt(String(b.id)) - BigInt(String(a.id))));
      return { enrollment: e, request: r, latest: documents[0] };
    }),
  );
  return (
    <section className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">Documentos solicitados</h2>
      <p className="text-sm text-slate-600">
        Coordinación solicita el documento e indica qué debe contener. El estudiante lo adjunta y
        recibe el resultado de la revisión; si requiere corrección, puede enviar una nueva versión.
      </p>
      {canManage && (
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="text-sm font-semibold">
            Inscripción
            <select
              required
              className="mt-1 block w-full rounded-xl border p-3"
              value={enrollmentId}
              onChange={(e) => setEnrollmentId(e.target.value)}
            >
              <option value="">Seleccionar inscripción</option>
              {available.map((e) => (
                <option key={String(e.id)} value={String(e.id)}>
                  {String(e.code)} · {String((e.offer as Item)?.title ?? '')}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Documento requerido
            <input
              required
              maxLength={80}
              className="mt-1 block w-full rounded-xl border p-3"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="Ej.: Documento de identidad"
            />
          </label>
          <label className="text-sm font-semibold md:col-span-2">
            Instrucciones para el estudiante
            <textarea
              required
              maxLength={500}
              className="mt-1 block w-full rounded-xl border p-3"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>
          <Button disabled={save.isPending || !available.length} type="submit">
            Solicitar documento
          </Button>
        </form>
      )}
      {!enrollments.length && (
        <p className="text-sm">
          {isStudent
            ? 'Primero debes tener una inscripción para enviar documentos.'
            : 'No hay inscripciones disponibles para solicitar documentos.'}{' '}
          <Link
            className="font-semibold text-blue-700 underline"
            href={isStudent ? '/app/ofertas' : '/app/inscripciones'}
          >
            Ver {isStudent ? 'ofertas' : 'inscripciones'}
          </Link>
        </p>
      )}
      {!requests.length && enrollments.length > 0 && (
        <p className="text-sm text-slate-600">
          No hay documentos solicitados.{' '}
          {isStudent
            ? 'Aquí aparecerán las solicitudes de Coordinación.'
            : 'Selecciona una inscripción para enviar la primera solicitud.'}
        </p>
      )}
      {requests.map(({ enrollment, request, latest }) => (
        <article key={String(request.id)} className="rounded-2xl border p-4">
          <p className="font-semibold">
            {String(enrollment.code)} · {String(request.type)}
          </p>
          <p className="mt-1 text-sm">{String(request.instructions)}</p>
          <p className="mt-2 text-sm font-semibold">
            {latest ? humanizeSystemValue(String(latest.status)) : 'Pendiente de envío'}
          </p>
          {latest?.observation ? (
            <p className="mt-1 text-sm">Observación: {String(latest.observation)}</p>
          ) : null}
          {isStudent &&
            !['CANCELADA', 'RECHAZADA'].includes(String(enrollment.status)) &&
            (!latest || latest.status === 'RECHAZADO') && (
              <Button
                className="mt-3"
                variant="outline"
                onClick={() =>
                  onSelect(String(enrollment.id), String(request.id), String(request.type))
                }
              >
                {latest ? 'Corregir documento' : 'Adjuntar documento'}
              </Button>
            )}
        </article>
      ))}
    </section>
  );
}
