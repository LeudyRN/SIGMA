import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BadgeCheck, GraduationCap, ShieldCheck } from 'lucide-react';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Acceso institucional a SIGMA UCOTESIS.',
};

export default function LoginPage() {
  return (
    <main className="bg-surface grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="bg-institutional relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-32 -right-24 size-96 rounded-full border border-white/10" />
          <div className="absolute -bottom-48 -left-36 size-[34rem] rounded-full border border-blue-300/15" />
        </div>
        <Link href="/" className="relative flex w-fit items-center gap-3 rounded-lg">
          <span className="grid size-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <GraduationCap aria-hidden="true" className="size-6" />
          </span>
          <span>
            <span className="block text-xl leading-none font-bold tracking-[0.18em]">SIGMA</span>
            <span className="mt-1 block text-[0.65rem] tracking-[0.13em] text-blue-100 uppercase">
              UCOTESIS
            </span>
          </span>
        </Link>
        <div className="relative max-w-xl">
          <p className="text-sm font-bold tracking-[0.16em] text-blue-200 uppercase">
            Portal institucional
          </p>
          <h1 className="mt-4 text-4xl leading-tight font-bold">
            Tu proceso de grado, organizado y accesible.
          </h1>
          <p className="mt-5 text-lg leading-8 text-blue-100">
            Consulta requisitos, valida tu elegibilidad y da seguimiento a tesis o monográficos
            desde un mismo espacio.
          </p>
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <ShieldCheck aria-hidden="true" className="size-5 text-emerald-300" />
              <span className="text-sm font-medium">Acceso protegido por roles</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <BadgeCheck aria-hidden="true" className="size-5 text-blue-200" />
              <span className="text-sm font-medium">Trazabilidad institucional</span>
            </div>
          </div>
        </div>
        <p className="relative text-sm text-blue-200">
          Universidad Autónoma de Santo Domingo • Recinto Santiago
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm font-medium lg:hidden"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> Volver al inicio
          </Link>
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="bg-institutional grid size-11 place-items-center rounded-xl text-white">
              <GraduationCap aria-hidden="true" className="size-6" />
            </span>
            <div>
              <p className="text-institutional text-xl font-bold tracking-[0.16em]">SIGMA</p>
              <p className="text-muted-foreground text-xs">UCOTESIS</p>
            </div>
          </div>
          <p className="text-primary text-sm font-bold tracking-[0.14em] uppercase">Bienvenido</p>
          <h2 className="text-institutional mt-2 text-3xl font-bold tracking-tight">
            Inicia sesión en SIGMA
          </h2>
          <p className="text-muted-foreground mt-3 leading-7">
            Utiliza la cuenta proporcionada por la coordinación o administración del sistema.
          </p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
