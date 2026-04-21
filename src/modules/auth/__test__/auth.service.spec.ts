import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { RefreshToken, User } from '@prisma-client';
import { AuthRepository } from '../auth.repository';
import { AuthService } from '../auth.service';

jest.mock('argon2', () => ({ verify: jest.fn() }));
import * as argon from 'argon2';
const mockArgonVerify = argon.verify as jest.MockedFunction<
  typeof argon.verify
>;

const mockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-uuid-1',
  tenantId: 'tenant-uuid-1',
  email: 'alice@acme.com',
  passwordHash: '$argon2id$mocked',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockRefreshToken = (
  overrides: Partial<RefreshToken> = {},
): RefreshToken => ({
  id: 'rt-uuid-1',
  userId: 'user-uuid-1',
  tenantId: 'tenant-uuid-1',
  tokenHash: 'hashed-token',
  familyId: 'family-uuid-1',
  replacedByHash: null,
  revoked: false,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  absoluteExpireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let authRepo: jest.Mocked<AuthRepository>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;

  beforeEach(async () => {
    authRepo = {
      findUserByEmail: jest.fn(),
      findUserById: jest.fn(),
      createRefreshToken: jest.fn(),
      findRefreshTokenByHash: jest.fn(),
      rotateRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeFamilyByFamilyId: jest.fn(),
      revokeAllRefreshTokensForUser: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;

    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: authRepo },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(1) },
        },
        {
          provide: ClsService,
          useValue: { get: jest.fn().mockReturnValue('tenant-uuid-1') },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns a token pair on valid credentials', async () => {
      authRepo.findUserByEmail.mockResolvedValue(mockUser());
      authRepo.createRefreshToken.mockResolvedValue(mockRefreshToken());
      mockArgonVerify.mockResolvedValue(true);

      const result = await service.login({
        email: 'alice@acme.com',
        password: 'hunter2!!',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
    });

    it('signs the access token with sub, email, and tenantId', async () => {
      authRepo.findUserByEmail.mockResolvedValue(mockUser());
      authRepo.createRefreshToken.mockResolvedValue(mockRefreshToken());
      mockArgonVerify.mockResolvedValue(true);

      await service.login({ email: 'alice@acme.com', password: 'hunter2!!' });

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-uuid-1',
        email: 'alice@acme.com',
        tenantId: 'tenant-uuid-1',
      });
    });

    it('stores the refresh token hash — not the plaintext', async () => {
      authRepo.findUserByEmail.mockResolvedValue(mockUser());
      authRepo.createRefreshToken.mockResolvedValue(mockRefreshToken());
      mockArgonVerify.mockResolvedValue(true);

      const { refreshToken } = await service.login({
        email: 'alice@acme.com',
        password: 'hunter2!!',
      });
      const [stored] = authRepo.createRefreshToken.mock.calls[0];

      expect(stored.tokenHash).not.toBe(refreshToken);
      expect(stored.tokenHash).toHaveLength(64); // SHA-256 hex
    });

    it('throws UnauthorizedException when user is not found', async () => {
      authRepo.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@acme.com', password: 'hunter2!!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      authRepo.findUserByEmail.mockResolvedValue(mockUser());
      mockArgonVerify.mockResolvedValue(false);

      await expect(
        service.login({ email: 'alice@acme.com', password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns the same error message for unknown email and wrong password', async () => {
      authRepo.findUserByEmail.mockResolvedValue(null);
      const err1 = await service
        .login({ email: 'x@x.com', password: 'pass1234' })
        .catch((e) => e);

      authRepo.findUserByEmail.mockResolvedValue(mockUser());
      mockArgonVerify.mockResolvedValue(false);
      const err2 = await service
        .login({ email: 'alice@acme.com', password: 'wrongpass' })
        .catch((e) => e);

      expect(err1.message).toBe(err2.message);
    });

    it('throws InternalServerErrorException on unexpected repository error', async () => {
      authRepo.findUserByEmail.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(
        service.login({ email: 'alice@acme.com', password: 'hunter2!!' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ── refreshToken ──────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('returns a rotated token pair for a valid refresh token', async () => {
      authRepo.findRefreshTokenByHash.mockResolvedValue(mockRefreshToken());
      authRepo.findUserById.mockResolvedValue(mockUser());
      authRepo.rotateRefreshToken.mockResolvedValue(mockRefreshToken());

      const result = await service.refreshToken('valid-plain-token');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBeDefined();
      expect(authRepo.rotateRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('signs the new access token with sub, email, and tenantId', async () => {
      authRepo.findRefreshTokenByHash.mockResolvedValue(mockRefreshToken());
      authRepo.findUserById.mockResolvedValue(mockUser());
      authRepo.rotateRefreshToken.mockResolvedValue(mockRefreshToken());

      await service.refreshToken('valid-plain-token');

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-uuid-1',
        email: 'alice@acme.com',
        tenantId: 'tenant-uuid-1',
      });
    });

    it('throws UnauthorizedException when token is not found', async () => {
      authRepo.findRefreshTokenByHash.mockResolvedValue(null);

      await expect(service.refreshToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('revokes the token family and throws on reuse of a revoked token', async () => {
      authRepo.findRefreshTokenByHash.mockResolvedValue(
        mockRefreshToken({ revoked: true }),
      );
      authRepo.revokeFamilyByFamilyId.mockResolvedValue({ count: 2 });

      await expect(service.refreshToken('reused-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authRepo.revokeFamilyByFamilyId).toHaveBeenCalledWith(
        'family-uuid-1',
      );
    });

    it('revokes the expired token and throws UnauthorizedException', async () => {
      authRepo.findRefreshTokenByHash.mockResolvedValue(
        mockRefreshToken({ absoluteExpireAt: new Date(Date.now() - 1000) }),
      );
      authRepo.revokeRefreshToken.mockResolvedValue(
        mockRefreshToken({ revoked: true }),
      );

      await expect(service.refreshToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authRepo.revokeRefreshToken).toHaveBeenCalledWith('rt-uuid-1');
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      authRepo.findRefreshTokenByHash.mockResolvedValue(mockRefreshToken());
      authRepo.findUserById.mockResolvedValue(null);

      await expect(service.refreshToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws InternalServerErrorException on unexpected repository error', async () => {
      authRepo.findRefreshTokenByHash.mockRejectedValue(
        new Error('DB timeout'),
      );

      await expect(service.refreshToken('some-token')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes the entire token family', async () => {
      authRepo.findRefreshTokenByHash.mockResolvedValue(mockRefreshToken());
      authRepo.revokeFamilyByFamilyId.mockResolvedValue({ count: 1 });

      await service.logout('valid-token');

      expect(authRepo.revokeFamilyByFamilyId).toHaveBeenCalledWith(
        'family-uuid-1',
      );
    });

    it('is a no-op when token does not exist', async () => {
      authRepo.findRefreshTokenByHash.mockResolvedValue(null);

      await expect(service.logout('unknown-token')).resolves.toBeUndefined();
      expect(authRepo.revokeFamilyByFamilyId).not.toHaveBeenCalled();
    });

    it('is a no-op when token is already revoked', async () => {
      authRepo.findRefreshTokenByHash.mockResolvedValue(
        mockRefreshToken({ revoked: true }),
      );

      await expect(service.logout('already-revoked')).resolves.toBeUndefined();
      expect(authRepo.revokeFamilyByFamilyId).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException on unexpected repository error', async () => {
      authRepo.findRefreshTokenByHash.mockRejectedValue(
        new Error('DB timeout'),
      );

      await expect(service.logout('some-token')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── logoutAll ─────────────────────────────────────────────────────────────

  describe('logoutAll', () => {
    it('revokes all refresh tokens for the user', async () => {
      authRepo.revokeAllRefreshTokensForUser.mockResolvedValue({ count: 3 });

      await service.logoutAll('user-uuid-1');

      expect(authRepo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith(
        'user-uuid-1',
      );
    });

    it('throws InternalServerErrorException on unexpected repository error', async () => {
      authRepo.revokeAllRefreshTokensForUser.mockRejectedValue(
        new Error('DB timeout'),
      );

      await expect(service.logoutAll('user-uuid-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
