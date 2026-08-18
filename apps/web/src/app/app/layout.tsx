import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app/app-shell';

export const metadata: Metadata = {
  title: 'Módulos del sistema',
  description: 'Mapa funcional y plan de implementación de SIGMA.',
  openGraph: { images: [] },
  twitter: { images: [] },
};

export default async function SigmaAppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const hasSession =
    cookieStore.has('sigma_access_token') || cookieStore.has('sigma_refresh_token');

  if (!hasSession) redirect('/login');

  return <AppShell>{children}</AppShell>;
}
