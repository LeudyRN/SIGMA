import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { MonographWorkspace } from './monograph-workspace';
import { apiJson } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

vi.mock('@/lib/api', () => ({ apiJson: vi.fn() }));

const enrollment = {
  id: '12',
  code: 'INS-12',
  offerId: '1',
  offer: 'Curso',
  teachingMode: 'VIRTUAL',
  degreeType: 'Monográfico',
  career: 'Informática',
  campus: 'Santiago',
  status: 'PENDIENTE_PAGO',
  receivedAt: '2026-09-22' as string | null,
  validatedAt: '2026-09-22' as string | null,
  debtOpenedAt: '2026-09-22' as string | null,
  channel: 'CAJA',
  amount: 2000,
  currency: 'DOP',
  paid: false,
  whatsappUrl: null,
  remittedAt: null,
  observation: null,
  participants: [],
  documents: [],
  payments: [],
};
function show(permissions: string[], row = enrollment, role = 'SECRETARIA') {
  useAuthStore.setState({
    user: {
      id: '1',
      uuid: 'secretaria',
      name: 'Secretaría',
      email: '',
      employeeCode: '',
      matricula: '',
      roles: [{ code: role, name: role }],
      permissions,
    },
  });
  vi.mocked(apiJson).mockResolvedValue({
    items: [row],
    contact: { phone: '', confirmed: true },
    groups: [],
    coordinators: [],
    plans: [],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MonographWorkspace paymentsOnly />
    </QueryClientProvider>,
  );
}
afterEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null });
});

it('Secretaría puede abrir la deuda desde la pantalla de pagos', async () => {
  show(['MONOGRAFICO_LEER', 'MONOGRAFICO_VALIDAR'], { ...enrollment, debtOpenedAt: null });
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Abrir deuda · pago pendiente' }));
  await waitFor(() =>
    expect(apiJson).toHaveBeenCalledWith('/monograph/enrollments/12/debt', {
      method: 'POST',
      body: '{}',
    }),
  );
});

it.each(['APROBADO', 'RECHAZADO'])(
  'Secretaría registra %s mediante el pago y no el estado de inscripción',
  async (outcome) => {
    show(['MONOGRAFICO_LEER', 'MONOGRAFICO_PAGOS_GESTIONAR']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Registrar resultado de pago' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Resultado a simular' }),
      outcome,
    );
    await user.click(screen.getByRole('checkbox', { name: /Entiendo que este pago/ }));
    await user.click(screen.getByRole('button', { name: 'Ejecutar simulación' }));
    await waitFor(() =>
      expect(apiJson).toHaveBeenCalledWith('/monograph/enrollments/12/simulate', {
        method: 'POST',
        body: expect.any(String),
      }),
    );
    const request = vi.mocked(apiJson).mock.calls.find(([path]) => path.endsWith('/simulate'));
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      channel: 'CAJA',
      outcome,
      simulationAcknowledged: true,
      idempotencyKey: expect.any(String),
    });
  },
);

it('no ofrece aprobación al personal que solo puede revisar expedientes', async () => {
  show(['MONOGRAFICO_LEER', 'MONOGRAFICO_VALIDAR']);
  await screen.findByText('Curso');
  expect(
    screen.queryByRole('button', { name: 'Registrar resultado de pago' }),
  ).not.toBeInTheDocument();
});

it('el estudiante ve la recepción pendiente cuando se marcó procesamiento sin crear una deuda', async () => {
  show(
    ['MONOGRAFICO_LEER'],
    {
      ...enrollment,
      status: 'PAGO_PROCESANDO',
      receivedAt: null,
      validatedAt: null,
      debtOpenedAt: null,
    },
    'ESTUDIANTE',
  );
  expect(await screen.findByText('Pendiente de recepción')).toBeVisible();
  expect(screen.getByText('Sin deuda abierta')).toBeVisible();
  expect(screen.queryByText('PAGO_PROCESANDO')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Registrar resultado de pago' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Elegir pago virtual' })).not.toBeInTheDocument();
});
