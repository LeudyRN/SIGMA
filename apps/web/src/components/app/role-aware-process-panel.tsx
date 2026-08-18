'use client';

import { ShieldCheck } from 'lucide-react';
import { StudentProcessPanel } from '@/components/students/student-process-panel';
import { useAuthStore } from '@/store/auth-store';

type ProcessMode = 'offers' | 'enrollments' | 'payments' | 'invoices';

export function RoleAwareProcessPanel({ mode }: { mode: ProcessMode }) {
  const user = useAuthStore((state) => state.user);
  if (user?.roles.some((role) => role.code === 'ESTUDIANTE')) {
    return <StudentProcessPanel mode={mode} />;
  }
  const names = {
    offers: 'Ofertas',
    enrollments: 'Inscripciones',
    payments: 'Pagos',
    invoices: 'Facturas',
  };
  return (
    <section className="mx-auto max-w-6xl rounded-3xl border bg-white p-8 shadow-sm">
      <ShieldCheck className="size-8 text-blue-700" />
      <p className="mt-5 text-sm font-bold tracking-widest text-blue-700 uppercase">
        Área autorizada
      </p>
      <h1 className="mt-1 text-3xl font-bold">{names[mode]}</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Esta sesión muestra únicamente las operaciones habilitadas para{' '}
        {user?.roles.map((role) => role.name).join(', ') || 'el rol actual'}.
      </p>
    </section>
  );
}
