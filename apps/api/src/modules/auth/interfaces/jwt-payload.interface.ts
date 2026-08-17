export interface JwtPayload {
  sub: string;
  email: string;
  matricula: string;
  roles: string[];
  jti: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}
