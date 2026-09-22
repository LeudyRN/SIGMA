'use client';

import { OperationsPanel } from '@/components/operations/operations-panel';
import { MonographWorkspace } from '@/components/monograph/monograph-workspace';
import { StudentProcessPanel } from '@/components/students/student-process-panel';
import { useAuthStore } from '@/store/auth-store';

type ProcessMode = 'offers' | 'enrollments' | 'payments' | 'invoices';

export function RoleAwareProcessPanel({ mode }: { mode: ProcessMode }) {
  const user = useAuthStore((state) => state.user);
  if (user?.roles.some((role) => role.code === 'ESTUDIANTE')) {
    if (mode === 'enrollments') return <MonographWorkspace />;
    return <StudentProcessPanel mode={mode} />;
  }
  const operationalMode = {
    offers: 'ofertas',
    enrollments: 'inscripciones',
    payments: 'pagos',
    invoices: 'facturas',
  } as const;
  return <OperationsPanel mode={operationalMode[mode]} />;
}
