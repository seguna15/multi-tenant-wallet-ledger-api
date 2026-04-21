import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { AuthRepository } from "@modules/auth/auth.repository";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { ClsService } from "nestjs-cls";
import { TenantStore } from "@common/cls/tenant-store.interface";
import { LoginDto, RegisterDto } from "@modules/auth/dto";
import { TokenPair, TokenPayload } from "@modules/auth/types/auth.types";
import * as argon from "argon2";
import * as crypto from "crypto";


@Injectable()
export class AuthService {
  private readonly refreshTokenTtlMs: number;
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly clsService: ClsService<TenantStore>,
    private readonly authRepository: AuthRepository,
  ) {
    const days = this.config.get<number>('REFRESH_TOKEN_EXPIRY_DAYS', 1);
    this.refreshTokenTtlMs = days * 24 * 60 * 60 * 1000;
    this.accessTokenExpiresIn = this.config.get<string>(
      'ACCESS_TOKEN_EXPIRES_IN',
      '15m',
    );
    this.refreshTokenExpiresIn = `${days}d`;
  }

  async register(dto: RegisterDto): Promise<TokenPair> {
    try {
      const existing = await this.authRepository.findUserByEmail(dto.email);
      if (existing) {
        throw new ConflictException('Email already registered');
      }

      const passwordHash = await argon.hash(dto.password);
      const user = await this.authRepository.createUser({
        email: dto.email,
        passwordHash,
      });

      return this.issueTokenPair({
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Registration failed');
    }
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    try {
      const user = await this.authRepository.findUserByEmail(dto.email);

      if (
        !user ||
        !(await this.validatePassword(user.passwordHash, dto.password))
      ) {
        throw new UnauthorizedException('Invalid credentials');
      }

      return this.issueTokenPair({
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException('Login failed');
    }
  }

  async refreshToken(incomingToken: string): Promise<TokenPair> {
    try {
      const tokenHash = this.hashToken(incomingToken);
      const stored =
        await this.authRepository.findRefreshTokenByHash(tokenHash);

      if (!stored) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (stored.revoked) {
        await this.authRepository.revokeFamilyByFamilyId(stored.familyId);
        throw new UnauthorizedException(
          'Refresh token reuse detected. All sessions invalidated.',
        );
      }

      const now = new Date();
      if (stored.absoluteExpireAt < now) {
        await this.authRepository.revokeRefreshToken(stored.id);
        throw new UnauthorizedException('Refresh token expired');
      }

      // Fetch email for JWT payload
      const user = await this.authRepository.findUserById(
        stored.userId,
        stored.tenantId,
      );
      if (!user) {
        throw new UnauthorizedException('User no longer exists');
      }

      const newRaw = this.generateRawToken();
      const newHash = this.hashToken(newRaw);

      await this.authRepository.rotateRefreshToken(
        stored.id,
        newHash, // recorded on old token as replacedByHash
        {
          tokenHash: newHash,
          familyId: stored.familyId,
          userId: stored.userId,
          tenantId: stored.tenantId,
          expiresAt: this.slidingExpiry(),
          absoluteExpireAt: stored.absoluteExpireAt, // never moves across rotations
        },
      );

      const accessToken = this.signAccessToken({
        userId: stored.userId,
        email: user.email,
        tenantId: stored.tenantId,
      });
      return { accessToken, refreshToken: newRaw };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException('Token refresh failed');
    }
  }

  async logout(token: string): Promise<void> {
    try {
      const stored = await this.authRepository.findRefreshTokenByHash(
        this.hashToken(token),
      );

      if (!stored || stored.revoked) {
        return;
      }

      // Revoke the whole family so all devices sharing it are logged out
      await this.authRepository.revokeFamilyByFamilyId(stored.familyId);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException('Logout failed');
    }
  }

  async logoutAll(userId: string): Promise<void> {
    try {
      await this.authRepository.revokeAllRefreshTokensForUser(userId);
    } catch {
      throw new InternalServerErrorException('Logout-all failed');
    }
  }

  private validatePassword(hash: string, password: string): Promise<boolean> {
    return argon.verify(hash, password);
  }

  private async issueTokenPair(payload: TokenPayload): Promise<TokenPair> {
    const expiresAt = this.slidingExpiry();
    const rawRefreshToken = this.generateRawToken();

    await this.authRepository.createRefreshToken({
      tokenHash: this.hashToken(rawRefreshToken),
      familyId: crypto.randomUUID(),
      userId: payload.userId,
      tenantId: payload.tenantId,
      expiresAt,
      absoluteExpireAt: expiresAt,
    });

    return {
      accessToken: this.signAccessToken(payload),
      refreshToken: rawRefreshToken,
    };
  }

  private signAccessToken(payload: TokenPayload): string {
    return this.jwtService.sign({
      sub: payload.userId,
      email: payload.email,
      tenantId: payload.tenantId,
    });
  }

  private generateRawToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private slidingExpiry(): Date {
    return new Date(Date.now() + this.refreshTokenTtlMs);
  }
}