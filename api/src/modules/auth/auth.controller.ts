import { ApiKeyGuard } from '@common/guards/api-key.guard';
import { TenantClsGuard } from '@common/guards/tenant-cls.guard';
import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from '@modules/auth/auth.service';
import { RequestUser } from '@modules/auth/types/auth.types';
import { LoginDto, RegisterDto } from '@modules/auth/dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { UserClsGuard } from '@common/guards/user-cls.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

const REFRESH_COOKIE = 'refresh_token';
const ACCESS_COOKIE = 'access_token';
const ROLE_COOKIE = 'user_role';

@ApiTags('Auth')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard, TenantClsGuard)
@Controller('auth')
export class AuthController {
  private readonly refreshMaxAgeMs: number;
  private readonly accessMaxAgeMs: number;
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    const days = this.config.get<number>('REFRESH_TOKEN_EXPIRY_DAYS', 1);
    this.refreshMaxAgeMs = days * 24 * 60 * 60 * 1000;

    const accessExpiry = this.config.get<string>(
      'ACCESS_TOKEN_EXPIRES_IN',
      '15m',
    );
    this.accessMaxAgeMs = this.parseExpiry(accessExpiry);

    this.isProduction = this.config.get<string>('NODE_ENV') === 'production';
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user within the current tenant' })
  @ApiOkResponse({ description: 'Auth cookies set, no body' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { accessToken, refreshToken } = await this.authService.register(dto);
    this.setAuthCookies(res, accessToken, refreshToken);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login — access and refresh tokens set as HTTP-only cookies',
  })
  @ApiOkResponse({ description: 'Auth cookies set, no body' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { accessToken, refreshToken } = await this.authService.login(dto);
    this.setAuthCookies(res, accessToken, refreshToken);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Rotate token pair using the refresh_token cookie' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new ForbiddenException('No refresh token provided');

    const { accessToken, refreshToken } =
      await this.authService.refreshToken(token);
    this.setAuthCookies(res, accessToken, refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout — clears all auth cookies' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await this.authService.logout(token);
    this.clearAuthCookies(res);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard, UserClsGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout from all sessions' })
  async logoutAll(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.userId, user.tenantId);
    this.clearAuthCookies(res);
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const base = {
      secure: this.isProduction,
      sameSite: 'lax' as const,
      path: '/',
    };

    res.cookie(ACCESS_COOKIE, accessToken, {
      ...base,
      httpOnly: true,
      maxAge: this.accessMaxAgeMs,
    });

    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...base,
      httpOnly: true,
      maxAge: this.refreshMaxAgeMs,
      path: '/',
    });

    // Readable by JS — lets the frontend know the user's role without decoding a JWT
    const { role } = this.jwtService.decode(accessToken) as { role: string };
    res.cookie(ROLE_COOKIE, role, {
      ...base,
      httpOnly: false,
      maxAge: this.refreshMaxAgeMs,
    });
  }

  private clearAuthCookies(res: Response): void {
    const opts = { path: '/', maxAge: 0 };
    res.clearCookie(ACCESS_COOKIE, { ...opts, httpOnly: true });
    res.clearCookie(REFRESH_COOKIE, {
      ...opts,
      httpOnly: true,
      path: '/',
    });
    res.clearCookie(ROLE_COOKIE, opts);
  }

  // Converts "15m", "1h", "7d" → milliseconds
  private parseExpiry(expiry: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60_000;
    return parseInt(match[1]) * (units[match[2]] ?? 60_000);
  }
}
