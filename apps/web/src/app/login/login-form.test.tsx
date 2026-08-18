import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  replace: vi.fn(),
  readApiError: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: mocks.apiFetch,
  readApiError: mocks.readApiError,
}));

function renderLoginForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows and hides the password without changing its value', async () => {
    const user = userEvent.setup();
    renderLoginForm();
    const password = screen.getByLabelText(/^contraseña$/i);

    await user.type(password, 'abcde');
    expect(password).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /mostrar contraseña/i }));
    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue('abcde');

    await user.click(screen.getByRole('button', { name: /ocultar contraseña/i }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('keeps credentials out of the URL and validates empty fields', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(await screen.findByText(/código de empleado es obligatorio/i)).toBeVisible();
    expect(screen.getByText(/contraseña es obligatoria/i)).toBeVisible();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('accepts an existing short password and enters with the database response', async () => {
    mocks.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: '1',
          uuid: 'database-user',
          matricula: '999999999',
          employeeCode: '',
          email: 'usuario@uasd.edu.do',
          name: 'Usuario SIGMA',
          roles: [{ code: 'ADMIN', name: 'Administrador' }],
        },
      }),
    } as Response);
    const user = userEvent.setup();
    renderLoginForm();

    await user.type(screen.getByLabelText(/matrícula o código de empleado/i), '999999999');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'abcde');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/app'));
    expect(mocks.apiFetch).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identificador: '999999999', password: 'abcde' }),
    });
  });
});
