'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, LoaderCircle, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch, readApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  url: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

interface NotificationResponse {
  unreadCount: number;
  items: NotificationItem[];
}

async function loadNotifications(): Promise<NotificationResponse> {
  const response = await apiFetch('/notifications');
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<NotificationResponse>;
}

export function NotificationCenter() {
  const queryClient = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: loadNotifications,
    refetchInterval:
      typeof document !== 'undefined' && document.visibilityState === 'visible' ? 20_000 : false,

    refetchOnWindowFocus: true,
  });

  /*
  useEffect(() => {
    const source = new EventSource('/api/notifications/stream', {
      withCredentials: true,
    });
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    source.addEventListener('notifications', refresh);
    return () => {
      source.removeEventListener('notifications', refresh);
      source.close();
    };
  }, [queryClient]);
*/

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const action = useMutation({
    mutationFn: async ({ path, method }: { path: string; method: 'PATCH' | 'DELETE' }) => {
      const response = await apiFetch(path, { method });
      if (!response.ok) throw new Error(await readApiError(response));
    },
    onSuccess: () => {
      setConfirmClear(false);
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const data = notifications.data;

  return (
    <div ref={panelRef} className="relative ml-auto">
      <button
        type="button"
        aria-label={`Centro de notificaciones${data?.unreadCount ? `, ${data.unreadCount} sin leer` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <Bell aria-hidden="true" className="size-5" />
        {!!data?.unreadCount && (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] leading-5 font-bold text-white">
            {data.unreadCount > 99 ? '99+' : data.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          aria-label="Centro de notificaciones"
          className="absolute top-12 right-0 z-50 flex max-h-[min(620px,calc(100vh-96px))] w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex items-center gap-3 border-b p-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-slate-950">Notificaciones</h2>
              <p className="text-xs text-slate-500">
                {data?.unreadCount ?? 0} sin leer · sincronizadas con SIGMA
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar notificaciones"
              onClick={() => setOpen(false)}
              className="grid size-9 place-items-center rounded-lg hover:bg-slate-100"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-b bg-slate-50 p-3">
            <button
              type="button"
              disabled={!data?.unreadCount || action.isPending}
              onClick={() => action.mutate({ path: '/notifications/read-all', method: 'PATCH' })}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              <CheckCheck aria-hidden="true" className="size-4" /> Marcar todas como leídas
            </button>
            {confirmClear ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ path: '/notifications', method: 'DELETE' })}
                  className="rounded-lg bg-red-600 px-2.5 py-2 text-xs font-bold text-white"
                >
                  Confirmar eliminación
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!data?.items.length || action.isPending}
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 aria-hidden="true" className="size-4" /> Eliminar todas
              </button>
            )}
          </div>

          <div className="min-h-32 overflow-y-auto">
            {notifications.isLoading && (
              <div className="grid min-h-40 place-items-center text-slate-500">
                <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />
              </div>
            )}
            {notifications.isError && (
              <p className="p-6 text-center text-sm text-red-700">
                No fue posible cargar las notificaciones.
              </p>
            )}
            {data?.items.length === 0 && (
              <div className="p-8 text-center">
                <Bell aria-hidden="true" className="mx-auto size-8 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-700">No tienes notificaciones</p>
                <p className="mt-1 text-sm text-slate-500">Los avisos de SIGMA aparecerán aquí.</p>
              </div>
            )}
            {data?.items.map((item) => (
              <article
                key={item.id}
                className={cn(
                  'group relative border-b p-4 last:border-b-0',
                  !item.read && 'bg-blue-50/70',
                )}
              >
                <div className="flex gap-3">
                  <span
                    className={cn(
                      'mt-2 size-2 shrink-0 rounded-full',
                      item.read ? 'bg-slate-300' : 'bg-blue-600',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    {item.url ? (
                      <Link
                        href={item.url}
                        onClick={() => {
                          if (!item.read)
                            action.mutate({
                              path: `/notifications/${item.id}/read`,
                              method: 'PATCH',
                            });
                          setOpen(false);
                        }}
                        className="font-bold text-slate-900 hover:text-blue-700"
                      >
                        {item.title}
                      </Link>
                    ) : (
                      <p className="font-bold text-slate-900">{item.title}</p>
                    )}
                    <p className="mt-1 text-sm leading-5 text-slate-600">{item.message}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {new Intl.DateTimeFormat('es-DO', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(item.createdAt))}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!item.read && (
                        <button
                          type="button"
                          onClick={() =>
                            action.mutate({
                              path: `/notifications/${item.id}/read`,
                              method: 'PATCH',
                            })
                          }
                          className="text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Marcar como leída
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          action.mutate({ path: `/notifications/${item.id}`, method: 'DELETE' })
                        }
                        className="text-xs font-semibold text-red-700 hover:underline"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
