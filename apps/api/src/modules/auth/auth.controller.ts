import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { AuthTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ACCESS_COOKIE, getCookie, REFRESH_COOKIE } from './utils/cookies';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    matricula: string;
    codigoEmpleado: string;
    roles: string[];
  };
}

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión en SIGMA' })
  @ApiResponse({ status: 200, description: 'Inicio de sesión exitoso.' })
  @ApiResponse({
    status: 401,
    description: 'Matrícula/código de empleado o contraseña incorrectos.',
  })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokens = await this.authService.login(dto, { ip, userAgent });
    this.setAuthCookies(response, tokens);

    return {
      user: tokens.user,
      accessExpiresIn: tokens.accessExpiresIn,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Renovar y rotar la sesión actual' })
  async refresh(
    @Req() request: Request,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = getCookie(request, REFRESH_COOKIE);
    if (!refreshToken) {
      throw new UnauthorizedException('No existe una sesión renovable.');
    }

    const tokens = await this.authService.refresh(refreshToken, {
      ip,
      userAgent,
    });
    this.setAuthCookies(response, tokens);

    return {
      user: tokens.user,
      accessExpiresIn: tokens.accessExpiresIn,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Revocar y cerrar la sesión actual' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const actorId = await this.authService.logout(
      getCookie(request, REFRESH_COOKIE),
    );
    if (actorId) response.locals.auditUserId = actorId;
    response.clearCookie(ACCESS_COOKIE, this.cookieOptions());
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth(ACCESS_COOKIE)
  @ApiOperation({
    summary: 'Obtener el usuario autenticado desde la base de datos',
  })
  async me(@Req() request: AuthenticatedRequest) {
    if (!request.user) {
      throw new UnauthorizedException('No existe una sesión activa.');
    }

    return this.authService.getProfile(request.user.id);
  }

  private setAuthCookies(response: Response, tokens: AuthTokens): void {
    response.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...this.cookieOptions(),
      maxAge: tokens.accessExpiresIn * 1000,
    });
    response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.cookieOptions(),
      maxAge: tokens.refreshExpiresIn * 1000,
    });
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
    };
  }
}
