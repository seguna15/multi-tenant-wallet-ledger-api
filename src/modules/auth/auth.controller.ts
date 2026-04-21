import { ApiKeyGuard } from "@common/guards/api-key.guard";
import { TenantClsGuard } from "@common/guards/tenant-cls.guard";
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Request, Response } from 'express';
import { AuthService } from "@modules/auth/auth.service";
import { RequestUser } from "@modules/auth/types/auth.types";
import { LoginDto, RegisterDto } from "@modules/auth/dto";
import { JwtAuthGuard } from "@common/guards/jwt-auth.guard";
import { UserClsGuard } from "@common/guards/user-cls.guard";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { ConfigService } from "@nestjs/config";

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('Auth')
@ApiSecurity('x-api-key')
@UseGuards(ApiKeyGuard, TenantClsGuard)
@Controller('auth')
export class AuthController {
  private readonly cookieMaxAgeMs: number;
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    const days = this.config.get<number>('REFRESH_TOKEN_EXPIRY_DAYS', 1);
    this.cookieMaxAgeMs = days * 24 * 60 * 60 * 1000;
    this.isProduction = this.config.get<string>('NODE_ENV') === 'production';
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user within the current tenant' })
  @ApiOkResponse({ description: 'User registered, access token returned' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const { accessToken, refreshToken } = await this.authService.register(dto);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive access token. Refresh token set as HTTP-only cookie.' })
  @ApiOkResponse({ description: 'Access token returned, refresh token set as cookie' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const { accessToken, refreshToken } = await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }


  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate token pair using the refresh_token cookie' })
  @ApiOkResponse({
    description: 'New access token returned, new refresh cookie set',
  })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('No refresh token provided');

    const { accessToken, refreshToken } =
      await this.authService.refreshToken(token);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout by revoking the provided refresh token' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await this.authService.logout(token);
    }
    this.clearRefreshCookie(res);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard, UserClsGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Logout from all sessions by revoking all refresh tokens for the user',
  })
  async logoutAll(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    console.log(`Logging out all sessions for user ${user.userId} in tenant ${user.tenantId}`);
    await this.authService.logoutAll(user.userId);
    this.clearRefreshCookie(res);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      maxAge: this.cookieMaxAgeMs,
      path: '/',
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      path: '/',
    });
  }
}