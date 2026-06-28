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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from '@modules/auth/auth.service';
import { LoginDto } from '@modules/auth/dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminJwtAuthGuard } from '@common/guards/admin-jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { RequestUser } from '@modules/auth/types/auth.types';

// Separate cookie names prevent dashboard sessions from colliding with frontend sessions
const ACCESS_COOKIE = 'admin_access_token';
const REFRESH_COOKIE = 'admin_refresh_token';
const ROLE_COOKIE = 'admin_user_role';

@ApiTags('Admin — Auth')
@Controller('admin/auth')
export class AdminAuthController {
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
    this.accessMaxAgeMs = this.parseExpiry(
      this.config.get<string>('ACCESS_TOKEN_EXPIRES_IN', '15m'),
    );
    this.isProduction = this.config.get<string>('NODE_ENV') === 'production';
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dashboard login — TENANT_ADMIN and SYSTEM_ADMIN only',
  })
  @ApiOkResponse({ description: 'Admin auth cookies set' })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or insufficient role',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { accessToken, refreshToken } =
      await this.authService.dashboardLogin(dto);
    this.setAuthCookies(res, accessToken, refreshToken);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Rotate admin token pair using the admin_refresh_token cookie',
  })
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
  @ApiOperation({ summary: 'Logout — clears all admin auth cookies' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await this.authService.logout(token);
    this.clearAuthCookies(res);
  }

  @Post('logout-all')
  @UseGuards(AdminJwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout from all admin sessions' })
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
      path: '/'
    });

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
