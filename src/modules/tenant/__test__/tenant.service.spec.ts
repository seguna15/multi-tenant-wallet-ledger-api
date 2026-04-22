import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Tenant } from '@prisma/client';
import { TenantRepository } from '../tenant.repository';
import { TenantService } from '../tenant.service';

jest.mock('@shared/utils/api-key.util', () => ({
  generateApiKey: jest.fn(),
  hashApiKey: jest.fn(),
}));

import { generateApiKey, hashApiKey } from '@shared/utils/api-key.util';

const mockGenerateApiKey = generateApiKey as jest.MockedFunction<
  typeof generateApiKey
>;
const mockHashApiKey = hashApiKey as jest.MockedFunction<typeof hashApiKey>;

// Helper to build a Prisma known request error — mirrors the real constructor shape
const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('error', {
    code,
    clientVersion: '7.0.0',
  });

const mockTenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'Acme Corp',
  apiKeyHash: '$argon2id$mocked_hash',
  apiKeyLastUsedAt: null,
  apiKeyExpiresAt: null,
  webhookUrl: null,
  webhookSecret: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('TenantService', () => {
  let service: TenantService;
  let repo: jest.Mocked<TenantRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: TenantRepository,
          useValue: {
            createSingleTenant: jest.fn(),
            findSingleTenant: jest.fn(),
            updateSingleTenant: jest.fn(),
            softDeleteSingleTenant: jest.fn(),
            rotateApiKey: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(TenantService);
    repo = module.get(TenantRepository);

    mockGenerateApiKey.mockReturnValue('lk_mockedplaintextkey');
    mockHashApiKey.mockResolvedValue('$argon2id$mocked_hash');
  });

  afterEach(() => jest.clearAllMocks());

  // ── createSingleTenant ────────────────────────────────────────────────────

  describe('createSingleTenant', () => {
    it('returns the created tenant and the plaintext API key', async () => {
      repo.createSingleTenant.mockResolvedValue(mockTenant());

      const result = await service.createSingleTenant({ name: 'Acme Corp' });

      expect(result.tenant).toEqual(mockTenant());
      expect(result.apiKey).toBe('lk_mockedplaintextkey');
    });

    it('passes the hash — not the plaintext key — to the repository', async () => {
      repo.createSingleTenant.mockResolvedValue(mockTenant());

      const { apiKey } = await service.createSingleTenant({
        name: 'Acme Corp',
      });
      const [createInput] = repo.createSingleTenant.mock.calls[0];

      expect(createInput.apiKeyHash).toBe('$argon2id$mocked_hash');
      expect(createInput.apiKeyHash).not.toBe(apiKey);
    });

    it('hashes the generated key before calling the repository', async () => {
      repo.createSingleTenant.mockResolvedValue(mockTenant());

      await service.createSingleTenant({ name: 'Acme Corp' });

      expect(mockHashApiKey).toHaveBeenCalledWith('lk_mockedplaintextkey');
    });

    it('generates a unique key per registration', async () => {
      mockGenerateApiKey
        .mockReturnValueOnce('lk_key_one')
        .mockReturnValueOnce('lk_key_two');
      repo.createSingleTenant.mockResolvedValue(mockTenant());

      const [r1, r2] = await Promise.all([
        service.createSingleTenant({ name: 'Tenant A' }),
        service.createSingleTenant({ name: 'Tenant B' }),
      ]);

      expect(r1.apiKey).not.toBe(r2.apiKey);
    });

    it('forwards optional webhook fields to the repository', async () => {
      repo.createSingleTenant.mockResolvedValue(mockTenant());

      await service.createSingleTenant({
        name: 'Acme Corp',
        webhookUrl: 'https://acme.com/webhook',
      });

      expect(repo.createSingleTenant).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookUrl: 'https://acme.com/webhook',
          webhookSecret: 'secret',
        }),
      );
    });

    it('throws InternalServerErrorException on P2002 apiKeyHash collision', async () => {
      repo.createSingleTenant.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.createSingleTenant({ name: 'Acme Corp' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('re-throws unexpected errors unmodified', async () => {
      const unexpected = new Error('DB connection lost');
      repo.createSingleTenant.mockRejectedValue(unexpected);

      await expect(
        service.createSingleTenant({ name: 'Acme Corp' }),
      ).rejects.toThrow('DB connection lost');
    });
  });

  // ── updateSingleTenant ────────────────────────────────────────────────────

  describe('updateSingleTenant', () => {
    it('returns the updated tenant', async () => {
      repo.updateSingleTenant.mockResolvedValue(
        mockTenant({ name: 'New Name' }),
      );

      const result = await service.updateSingleTenant(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        { name: 'New Name' },
      );

      expect(result.name).toBe('New Name');
    });

    it('throws NotFoundException on P2025 — id not found or belongs to another tenant', async () => {
      repo.updateSingleTenant.mockRejectedValue(prismaError('P2025'));

      await expect(
        service.updateSingleTenant('a1b2c3d4-e5f6-7890-abcd-ef1234567890', {
          name: 'x',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('re-throws unexpected errors unmodified', async () => {
      repo.updateSingleTenant.mockRejectedValue(new Error('timeout'));

      await expect(
        service.updateSingleTenant('a1b2c3d4-e5f6-7890-abcd-ef1234567890', {
          name: 'x',
        }),
      ).rejects.toThrow('timeout');
    });
  });

  // ── softDeleteSingleTenant ────────────────────────────────────────────────

  describe('softDeleteSingleTenant', () => {
    it('throws NotFoundException when tenant does not exist', async () => {
      repo.findSingleTenant.mockResolvedValue(null);

      await expect(
        service.softDeleteSingleTenant('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when tenant is already deactivated', async () => {
      repo.findSingleTenant.mockResolvedValue(mockTenant({ isActive: false }));

      await expect(
        service.softDeleteSingleTenant('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
      ).rejects.toThrow(ConflictException);
    });

    it('deactivates an active tenant and returns void', async () => {
      repo.findSingleTenant.mockResolvedValue(mockTenant({ isActive: true }));
      repo.softDeleteSingleTenant.mockResolvedValue(
        mockTenant({ isActive: false }),
      );

      await expect(
        service.softDeleteSingleTenant('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
      ).resolves.toBeUndefined();

      expect(repo.softDeleteSingleTenant).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );
    });

    it('does not call softDelete when tenant is not found', async () => {
      repo.findSingleTenant.mockResolvedValue(null);

      await expect(
        service.softDeleteSingleTenant('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
      ).rejects.toThrow(NotFoundException);

      expect(repo.softDeleteSingleTenant).not.toHaveBeenCalled();
    });

    it('does not call softDelete when tenant is already inactive', async () => {
      repo.findSingleTenant.mockResolvedValue(mockTenant({ isActive: false }));

      await expect(
        service.softDeleteSingleTenant('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
      ).rejects.toThrow(ConflictException);

      expect(repo.softDeleteSingleTenant).not.toHaveBeenCalled();
    });
  });

  describe('rotateApiKey', () => {
    it('returns a new plaintext API key', async () => {
      mockGenerateApiKey.mockReturnValue('lk_newkey');
      mockHashApiKey.mockResolvedValue('$argon2id$new_hash');
      repo.findSingleTenant.mockResolvedValue(mockTenant());
      repo.rotateApiKey.mockResolvedValue(
        mockTenant({ apiKeyHash: '$argon2id$new_hash' }),
      );

      const result = await service.rotateTenantApiKey(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );

      expect(result.apiKey).toBe('lk_newkey');
    });

    it('stores the new hash, not the plaintext key', async () => {
      mockGenerateApiKey.mockReturnValue('lk_newkey');
      mockHashApiKey.mockResolvedValue('$argon2id$new_hash');
      repo.findSingleTenant.mockResolvedValue(mockTenant());
      repo.rotateApiKey.mockResolvedValue(mockTenant());

      await service.rotateTenantApiKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890');

      expect(repo.rotateApiKey).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        '$argon2id$new_hash', // hash, not plaintext
      );
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      repo.findSingleTenant.mockResolvedValue(null);

      await expect(
        service.rotateTenantApiKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when tenant is deactivated', async () => {
      repo.findSingleTenant.mockResolvedValue(mockTenant({ isActive: false }));

      await expect(
        service.rotateTenantApiKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws InternalServerErrorException on P2002 hash collision', async () => {
      repo.findSingleTenant.mockResolvedValue(mockTenant());
      repo.rotateApiKey.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: '7.0.0',
        }),
      );

      await expect(
        service.rotateTenantApiKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
