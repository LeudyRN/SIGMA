const API_URL = '/api';
const REFRESH_PATH = '/auth/refresh';
const PATHS_WITHOUT_AUTOMATIC_REFRESH = new Set([
  '/auth/login',
  REFRESH_PATH,
  '/auth/logout',
]);

let refreshRequest: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly code: 'HTTP' | 'NETWORK' | 'UNKNOWN',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const isFormData = init?.body instanceof FormData;
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,

      credentials: 'include',

      headers: {
        ...(init?.body && !isFormData
          ? {
              'Content-Type': 'application/json',
            }
          : {}),

        ...init?.headers,
      },
    });
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : 'No fue posible conectar con SIGMA.',

      null,
      'NETWORK',
    );
  }
}

function canRefresh(path: string): boolean {
  return !PATHS_WITHOUT_AUTOMATIC_REFRESH.has(path.split('?')[0]);
}

function refreshAccessToken(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = request(REFRESH_PATH, { method: 'POST' })
      .then((response) => response.ok)
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await request(path, init);

  if (response.status !== 401 || !canRefresh(path)) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  return refreshed ? request(path, init) : response;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);

  if (!response.ok) {
    throw new ApiError(await readApiError(response), response.status, 'HTTP');
  }

  return response.json() as Promise<T>;
}

export async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string | string[];
    };

    if (Array.isArray(body.message)) {
      return body.message.join(' ');
    }

    if (body.message) {
      return body.message;
    }
  } catch {
    // respuesta no JSON
  }

  if (response.status >= 500) {
    return 'El servidor de SIGMA no está disponible temporalmente.';
  }

  return 'No fue posible completar la solicitud.';
}

export function isAuthenticationError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'NETWORK';
}
