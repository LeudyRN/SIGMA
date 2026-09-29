import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { apiJson } from '@/lib/api';
import { ProjectAdvisorsPanel } from './project-advisors-panel';

vi.mock('@/lib/api', () => ({ apiJson: vi.fn() }));
const advisor = {
  id: '4',
  name: 'Ana Pérez',
  email: 'ana@example.com',
  phone: '8095550100',
  specialty: 'Informática',
  participation: 'ASESOR',
  notes: 'Seleccionada por Coordinación.',
  active: true,
  version: 1,
};
const project = {
  id: '1',
  title: 'Proyecto de prueba',
  course: 'Monográfico',
  code: 'INS-1',
  canManage: false,
  advisors: [advisor],
  previousAssignments: [],
};
function mount(role: string) {
  useAuthStore.setState({
    user: {
      id: '1',
      uuid: 'u',
      name: 'Personal',
      email: 'personal@example.com',
      employeeCode: '',
      matricula: '',
      roles: [{ code: role, name: role }],
      permissions: ['COORDINACION_ACADEMICA_LEER'],
    },
  });
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={cache}>
      <ProjectAdvisorsPanel />
    </QueryClientProvider>,
  );
}
beforeEach(() => vi.mocked(apiJson).mockReset());
afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null });
});
describe('Registro de asesores', () => {
  it('muestra a Secretaría los contactos sin controles de escritura', async () => {
    vi.mocked(apiJson).mockResolvedValue({ projects: [project] });
    mount('SECRETARIA');
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText(/ana@example.com/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Registrar asesor o jurado' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Ana Pérez' })).not.toBeInTheDocument();
  });
  it('registra datos desde Coordinación sin solicitar una cuenta o perfil del asesor', async () => {
    vi.mocked(apiJson).mockResolvedValue({ projects: [{ ...project, canManage: true }] });
    mount('COORDINADOR');
    const interaction = userEvent.setup();
    await interaction.click(
      await screen.findByRole('button', { name: 'Registrar asesor o jurado' }),
    );
    await interaction.type(screen.getByLabelText('Nombre completo *'), 'María Santos');
    await interaction.type(screen.getByLabelText('Correo electrónico'), 'maria@example.com');
    await interaction.click(screen.getByRole('button', { name: 'Guardar datos' }));
    await waitFor(() =>
      expect(apiJson).toHaveBeenCalledWith('/project-advisors/projects/1', {
        method: 'POST',
        body: JSON.stringify({
          name: 'María Santos',
          email: 'maria@example.com',
          participation: 'ASESOR',
        }),
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Secretaría de UCOTESIS ya puede consultarlos',
    );
  });
  it('no consulta el registro desde un perfil de asesor', () => {
    mount('ASESOR');
    expect(screen.getByText(/disponible para Coordinación/)).toBeInTheDocument();
    expect(apiJson).not.toHaveBeenCalled();
  });
});
