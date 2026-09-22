import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationsPanel, readPath } from './operations-panel';
import { apiFetch, apiJson } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  apiJson: vi.fn(),
  readApiError: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null });
});

it.each(['VALIDANDO', 'PENDIENTE_PAGO'])(
  'offers manual transitions and submits their code from %s',
  async (status) => {
    useAuthStore.setState({
      user: {
        id: '1',
        uuid: 'admin',
        name: 'Administrador',
        email: '',
        employeeCode: '',
        matricula: '',
        permissions: ['*'],
        roles: [{ code: 'ADMIN', name: 'Administrador' }],
      },
    });
    const states = [
      'VALIDANDO',
      'ELEGIBLE',
      'PENDIENTE_PAGO',
      'PAGADA',
      'CONFIRMADA',
      'CANCELADA',
    ].map((code, index) => ({ id: String(index + 1), code, name: code, status: 'ACTIVO' }));
    states.push({ id: '7', code: 'INACTIVA', name: 'Estado inactivo', status: 'INACTIVO' });
    vi.mocked(apiJson).mockImplementation(async (path) =>
      path === '/enrollments/catalogs'
        ? { states }
        : { items: [{ id: '12', code: 'INS-12', status }] },
    );
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: '12', status: 'CANCELADA' }),
    } as Response);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <OperationsPanel mode="inscripciones" />
      </QueryClientProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'Cambiar estado' }));
    const select = screen.getByRole('combobox', { name: /Nuevo estado/ });
    expect(select).toHaveValue('');
    for (const code of [
      'ELEGIBLE',
      'PENDIENTE_PAGO',
      'PAGADA',
      'CONFIRMADA',
      'Estado inactivo',
      status,
    ]) {
      expect(within(select).queryByRole('option', { name: code })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Gestión de monográficos' })).toHaveAttribute(
      'href',
      '/app/monograficos',
    );
    await user.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    expect(apiFetch).not.toHaveBeenCalled();
    await user.selectOptions(select, 'CANCELADA');
    await user.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/enrollments/12/status', {
        method: 'PATCH',
        body: JSON.stringify({ statusCode: 'CANCELADA' }),
      }),
    );
    client.clear();
  },
);

describe('OperationsPanel table values', () => {
  it('shows a modality name instead of its JSON representation', () => {
    expect(readPath({ modality: { id: '2', name: 'Monográfico' } }, 'modality')).toBe(
      'Monográfico',
    );
  });

  it('summarizes a payment proof in language suitable for users', () => {
    expect(
      readPath(
        {
          proof: {
            status: 'VALIDADO',
            name: 'comprobante.jpg',
            mimeType: 'image/jpeg',
          },
        },
        'proof',
      ),
    ).toBe('Validado · comprobante.jpg');
  });
});

it('shows teaching mode from enrollments and projects, including unclassified offers', () => {
  expect(readPath({ offer: { teachingMode: 'VIRTUAL' } }, 'offer.teachingMode')).toBe('VIRTUAL');
  expect(
    readPath({ enrollment: { teachingMode: 'SEMIPRESENCIAL' } }, 'enrollment.teachingMode'),
  ).toBe('SEMIPRESENCIAL');
  expect(readPath({ teachingMode: null }, 'teachingMode')).toBe('Modalidad por definir');
});
