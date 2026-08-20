export interface AppEnvironment {
  API_PORT: number;
  CORS_ORIGIN: string;
  DATABASE_URL: string;

  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;

  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;

  NODE_ENV: string;
}

const developmentDefaults = {
  API_PORT: 3001,
  CORS_ORIGIN: 'http://localhost:3000',

  JWT_ACCESS_EXPIRES_IN: '15m',

  JWT_REFRESH_EXPIRES_IN: '7d',

  NODE_ENV: 'development',
};

function readRequiredString(
  input: Record<string, unknown>,
  key: string,
): string {
  const value = input[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `${key} es obligatorio y debe configurarse fuera del repositorio.`,
    );
  }

  return value;
}

function readString(
  input: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = input[key];

  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): AppEnvironment {
  const environment: AppEnvironment = {
    API_PORT: Number(input.API_PORT ?? developmentDefaults.API_PORT),

    CORS_ORIGIN: readString(
      input,
      'CORS_ORIGIN',
      developmentDefaults.CORS_ORIGIN,
    ),

    DATABASE_URL: readRequiredString(input, 'DATABASE_URL'),

    JWT_ACCESS_SECRET: readRequiredString(input, 'JWT_ACCESS_SECRET'),

    JWT_ACCESS_EXPIRES_IN: readString(
      input,
      'JWT_ACCESS_EXPIRES_IN',
      developmentDefaults.JWT_ACCESS_EXPIRES_IN,
    ),

    JWT_REFRESH_SECRET: readRequiredString(input, 'JWT_REFRESH_SECRET'),

    JWT_REFRESH_EXPIRES_IN: readString(
      input,
      'JWT_REFRESH_EXPIRES_IN',
      developmentDefaults.JWT_REFRESH_EXPIRES_IN,
    ),

    NODE_ENV: readString(input, 'NODE_ENV', developmentDefaults.NODE_ENV),
  };

  if (!Number.isInteger(environment.API_PORT) || environment.API_PORT < 1) {
    throw new Error('API_PORT debe ser un puerto válido.');
  }

  if (environment.NODE_ENV === 'production') {
    for (const key of [
      'DATABASE_URL',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
    ] as const) {
      if (!environment[key] || environment[key].includes('change-me')) {
        throw new Error(
          `${key} debe configurarse de forma segura en producción.`,
        );
      }
    }
  }

  return environment;
}
