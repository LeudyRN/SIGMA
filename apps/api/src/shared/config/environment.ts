export interface AppEnvironment {
  API_PORT: number;
  CORS_ORIGIN: string;
  DATABASE_HOST: string;
  DATABASE_NAME: string;
  DATABASE_PASSWORD: string;
  DATABASE_PORT: number;
  DATABASE_URL: string;
  DATABASE_USER: string;

  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;

  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;

  NODE_ENV: string;
}

const developmentDefaults: AppEnvironment = {
  API_PORT: 3001,
  CORS_ORIGIN: 'http://localhost:3000',

  DATABASE_HOST: 'localhost',
  DATABASE_NAME: 'sigma_ucotesis',
  DATABASE_PASSWORD: '',
  DATABASE_PORT: 3306,
  DATABASE_URL: 'mysql://root:@localhost:3306/sigma_ucotesis',
  DATABASE_USER: 'root',

  JWT_ACCESS_SECRET: 'development-access-secret-change-me',
  JWT_ACCESS_EXPIRES_IN: '15m',

  JWT_REFRESH_SECRET: 'development-refresh-secret-change-me',
  JWT_REFRESH_EXPIRES_IN: '7d',

  NODE_ENV: 'development',
};

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

    DATABASE_HOST: readString(
      input,
      'DATABASE_HOST',
      developmentDefaults.DATABASE_HOST,
    ),

    DATABASE_NAME: readString(
      input,
      'DATABASE_NAME',
      developmentDefaults.DATABASE_NAME,
    ),

    DATABASE_PASSWORD: readString(
      input,
      'DATABASE_PASSWORD',
      developmentDefaults.DATABASE_PASSWORD,
    ),

    DATABASE_PORT: Number(
      input.DATABASE_PORT ?? developmentDefaults.DATABASE_PORT,
    ),

    DATABASE_URL: readString(
      input,
      'DATABASE_URL',
      developmentDefaults.DATABASE_URL,
    ),

    DATABASE_USER: readString(
      input,
      'DATABASE_USER',
      developmentDefaults.DATABASE_USER,
    ),

    JWT_ACCESS_SECRET: readString(
      input,
      'JWT_ACCESS_SECRET',
      developmentDefaults.JWT_ACCESS_SECRET,
    ),

    JWT_ACCESS_EXPIRES_IN: readString(
      input,
      'JWT_ACCESS_EXPIRES_IN',
      developmentDefaults.JWT_ACCESS_EXPIRES_IN,
    ),

    JWT_REFRESH_SECRET: readString(
      input,
      'JWT_REFRESH_SECRET',
      developmentDefaults.JWT_REFRESH_SECRET,
    ),

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

  if (
    !Number.isInteger(environment.DATABASE_PORT) ||
    environment.DATABASE_PORT < 1
  ) {
    throw new Error('DATABASE_PORT debe ser un puerto válido.');
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
