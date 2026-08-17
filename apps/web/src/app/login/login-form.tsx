'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, IdCard, LoaderCircle, LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { apiFetch, readApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { AuthUser } from '@/store/auth-store';

const loginSchema = z.object({
  matricula: z
    .string()
    .trim()
    .min(5, 'Escribe una matrícula válida.')
    .max(30, 'La matrícula no puede superar 30 caracteres.')
    .regex(/^[A-Za-z0-9-]+$/, 'Usa únicamente letras, números y guiones.'),
  password: z
    .string()
    .min(1, 'Escribe tu contraseña.')
    .max(128, 'La contraseña supera el máximo permitido.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { matricula: '', password: '' },
  });

  async function onSubmit(values: LoginValues): Promise<void> {
    setServerError(null);
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        setServerError(await readApiError(response));
        return;
      }
      const result = (await response.json()) as { user: AuthUser };
      setUser(result.user);
      router.push('/app');
      router.refresh();
    } catch {
      setServerError('No se pudo conectar con SIGMA. Verifica que la API esté iniciada.');
    }
  }

  return (
    <form
      className="mt-8 space-y-5"
      method="post"
      action="/api/auth/login"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div>
        <label htmlFor="matricula" className="text-foreground text-sm font-semibold">
          Matrícula
        </label>
        <div className="relative mt-2">
          <IdCard
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 left-3 size-5 -translate-y-1/2"
          />
          <input
            id="matricula"
            type="text"
            inputMode="text"
            autoComplete="username"
            placeholder="Ej. 100000000"
            aria-invalid={Boolean(errors.matricula)}
            aria-describedby={errors.matricula ? 'matricula-error' : undefined}
            className="border-border bg-background focus:border-primary focus:ring-primary/15 h-12 w-full rounded-xl border pr-4 pl-11 text-sm transition outline-none focus:ring-4"
            {...register('matricula')}
          />
        </div>
        {errors.matricula && (
          <p id="matricula-error" className="text-error mt-2 text-sm">
            {errors.matricula.message}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="password" className="text-foreground text-sm font-semibold">
            Contraseña
          </label>
          <span className="text-muted-foreground text-xs">Acceso institucional</span>
        </div>
        <div className="relative mt-2">
          <LockKeyhole
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 left-3 size-5 -translate-y-1/2"
          />
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Tu contraseña"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="border-border bg-background focus:border-primary focus:ring-primary/15 h-12 w-full rounded-xl border pr-12 pl-11 text-sm transition outline-none focus:ring-4"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-lg"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-error mt-2 text-sm">
            {errors.password.message}
          </p>
        )}
      </div>

      {serverError && (
        <div
          role="alert"
          className="border-error/20 bg-error/5 text-error rounded-xl border px-4 py-3 text-sm"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> Validando acceso...
          </>
        ) : (
          'Iniciar sesión'
        )}
      </Button>
    </form>
  );
}
