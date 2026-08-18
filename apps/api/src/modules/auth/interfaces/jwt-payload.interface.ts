export interface JwtPayload {
  sub: string;
  email: string;
  matricula: string;
  codigoEmpleado: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
  jti: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  matricula: string;
  codigoEmpleado: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
}
