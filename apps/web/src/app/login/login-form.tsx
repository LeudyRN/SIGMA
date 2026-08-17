'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Eye,
  EyeOff,
  IdCard,
  LoaderCircle,
  LockKeyhole,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { AuthUser } from '@/store/auth-store';

const loginSchema = z.object({
  matricula: z
    .string()
    .trim()
    .min(1, 'La matrícula es obligatoria.')
    .regex(/^\d+$/, 'La matrícula solo puede contener números.')
    .length(9, 'La matrícula debe contener exactamente 9 dígitos.'),

  password: z
    .string()
    .min(1, 'La contraseña es obligatoria.')
    .min(5, 'La contraseña debe tener al menos 5 caracteres.')
    .max(128, 'La contraseña supera el máximo permitido.'),
});

type LoginValues = z.infer<typeof loginSchema>;

interface LoginResponse {
  accessExpiresIn: number;
  accessToken: string;
  refreshExpiresIn: number;
  refreshToken: string;
  user: AuthUser;
}

export function LoginForm() {
  const router = useRouter();

  const setUser = useAuthStore(
    (state) => state.setUser,
  );

  const [showPassword, setShowPassword] =
    useState(false);

  const {
    formState: {
      errors,
      isSubmitting,
    },
    handleSubmit,
    register,
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),

    defaultValues: {
      matricula: '',
      password: '',
    },

    mode: 'onTouched',
  });

  async function onSubmit(
    values: LoginValues,
  ): Promise<void> {
    try {
      const response = await apiFetch(
        '/auth/login',
        {
          method: 'POST',

          body: JSON.stringify({
            matricula:
              values.matricula.trim(),
            password: values.password,
          }),
        },
      );

      /*
       * Credenciales incorrectas
       */
      if (response.status === 401) {
        toast.error(
          'No se pudo iniciar sesión',
          {
            description:
              'La matrícula o la contraseña son incorrectas.',
          },
        );

        return;
      }

      /*
       * Usuario bloqueado/inactivo/pendiente
       */
      if (response.status === 403) {
        let description =
          'Tu cuenta no se encuentra disponible para iniciar sesión.';

        try {
          const error = (await response.json()) as {
            message?: string;
          };

          if (error.message) {
            description = error.message;
          }
        } catch {
          // Mantener mensaje genérico
        }

        toast.error(
          'Acceso no disponible',
          {
            description,
          },
        );

        return;
      }

      /*
       * Otros errores del servidor
       */
      if (!response.ok) {
        toast.error(
          'No se pudo iniciar sesión',
          {
            description:
              'Ocurrió un problema al validar tus credenciales. Intenta nuevamente.',
          },
        );

        return;
      }

      const result =
        (await response.json()) as LoginResponse;

      /*
       * Guardar usuario autenticado.
       */
      setUser(result.user);

      /*
       * Mostrar confirmación.
       */
      toast.success(
        'Inicio de sesión exitoso',
        {
          description: `Bienvenido${result.user.name ? `, ${result.user.name}` : ''}.`,
        },
      );

      /*
       * Entrar a SIGMA.
       */
      router.replace('/app');
      router.refresh();
    } catch {
      toast.error(
        'No se pudo conectar con SIGMA',
        {
          description:
            'Verifica tu conexión e intenta nuevamente.',
        },
      );
    }
  }

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      {/* MATRÍCULA */}
      <div>
        <label
          htmlFor="matricula"
          className="text-foreground text-sm font-semibold"
        >
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
            inputMode="numeric"
            autoComplete="username"
            maxLength={9}
            placeholder="Ej. 100576672"
            aria-invalid={
              Boolean(errors.matricula)
            }
            aria-describedby={
              errors.matricula
                ? 'matricula-error'
                : undefined
            }
            className="border-border bg-background focus:border-primary focus:ring-primary/15 h-12 w-full rounded-xl border pr-4 pl-11 text-sm transition outline-none focus:ring-4"
            {...register('matricula')}
          />
        </div>

        {errors.matricula && (
          <p
            id="matricula-error"
            role="alert"
            className="text-error mt-2 text-sm"
          >
            {errors.matricula.message}
          </p>
        )}
      </div>

      {/* CONTRASEÑA */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <label
            htmlFor="password"
            className="text-foreground text-sm font-semibold"
          >
            Contraseña
          </label>

          <span className="text-muted-foreground text-xs">
            Acceso institucional
          </span>
        </div>

        <div className="relative mt-2">
          <LockKeyhole
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 left-3 size-5 -translate-y-1/2"
          />

          <input
            id="password"
            type={
              showPassword
                ? 'text'
                : 'password'
            }
            autoComplete="current-password"
            placeholder="Tu contraseña"
            aria-invalid={
              Boolean(errors.password)
            }
            aria-describedby={
              errors.password
                ? 'password-error'
                : undefined
            }
            className="border-border bg-background focus:border-primary focus:ring-primary/15 h-12 w-full rounded-xl border pr-12 pl-11 text-sm transition outline-none focus:ring-4"
            {...register('password')}
          />

          <button
            type="button"
            onClick={() =>
              setShowPassword(
                (current) => !current,
              )
            }
            onMouseDown={(event) =>
              event.preventDefault()
            }
            className="text-muted-foreground hover:text-foreground focus-visible:ring-primary absolute top-1/2 right-3 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-lg outline-none focus-visible:ring-2"
            aria-label={
              showPassword
                ? 'Ocultar contraseña'
                : 'Mostrar contraseña'
            }
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff
                aria-hidden="true"
                className="size-5"
              />
            ) : (
              <Eye
                aria-hidden="true"
                className="size-5"
              />
            )}
          </button>
        </div>

        {errors.password && (
          <p
            id="password-error"
            role="alert"
            className="text-error mt-2 text-sm"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      {/* BOTÓN */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <LoaderCircle
              aria-hidden="true"
              className="size-5 animate-spin"
            />

            Validando acceso...
          </>
        ) : (
          'Iniciar sesión'
        )}
      </Button>
    </form>
  );
}