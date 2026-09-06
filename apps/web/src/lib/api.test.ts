import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';

describe('apiFetch', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renueva la sesión y repite la solicitud que encontró el token vencido', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response('{"items":[]}', { status: 200 }));

    const response = await apiFetch('/ucotesis/periods');

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/ucotesis/periods',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/ucotesis/periods',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('comparte una sola renovación entre solicitudes simultáneas', async () => {
    const attempts = new Map<string, number>();

    fetchMock.mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/auth/refresh') {
        return new Response(null, { status: 200 });
      }

      const count = attempts.get(path) ?? 0;
      attempts.set(path, count + 1);
      return new Response(null, { status: count === 0 ? 401 : 200 });
    });

    const responses = await Promise.all([
      apiFetch('/notifications'),
      apiFetch('/ucotesis/periods'),
      apiFetch('/projects'),
    ]);

    expect(responses.every((response) => response.ok)).toBe(true);
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input) === '/api/auth/refresh'),
    ).toHaveLength(1);
  });

  it('no intenta renovar una respuesta inválida del inicio de sesión', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identificador: 'E001', password: 'incorrecta' }),
    });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
