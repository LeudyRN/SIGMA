import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'SIGMA | UCOTESIS',
    template: '%s | SIGMA',
  },
  description:
    'Sistema de gestión e inscripción virtual de tesis y monográficos de UCOTESIS, UASD Recinto Santiago.',
  openGraph: {
    type: 'website',
    locale: 'es_DO',
    title: 'SIGMA | UCOTESIS',
    description:
      'Gestión e inscripción virtual de tesis y monográficos para UASD Recinto Santiago.',
    images: [
      {
        url: '/og.png',
        width: 1732,
        height: 909,
        alt: 'SIGMA - Tesis y Monográficos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SIGMA | UCOTESIS',
    description: 'Gestión e inscripción virtual de tesis y monográficos.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
