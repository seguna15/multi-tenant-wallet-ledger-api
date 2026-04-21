import { TenantStore } from "@common/cls/tenant-store.interface";
import { PrismaService } from "@common/database/prisma.service";
import { BaseRepository } from "@common/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { User, RefreshToken } from "@prisma-client";
import { ClsService } from "nestjs-cls";
import { CreateRefreshTokenData } from "./types/auth.types";


@Injectable()
export class AuthRepository extends BaseRepository {
  constructor(prisma: PrismaService, clsService: ClsService<TenantStore>) {
    super(prisma, clsService);
  }

  createUser(data: { email: string; passwordHash: string }): Promise<User> {
    return this.prisma.user.create({
      data: {
        ...data,
        tenantId: this.tenantId,
      },
    });
  }

  findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: this.tenantId,
          email,
        },
      },
    });
  }

  findUserById(id: string, tenantId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id, tenantId: tenantId ?? this.tenantId },
    });
  }

  createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
  }

  /**
   * Atomic rotation: marks old token revoked + records which token replaced it,
   * then inserts the new token — all in one transaction.
   */
  rotateRefreshToken(
    oldId: string,
    replacedByHash: string,
    newData: CreateRefreshTokenData,
  ): Promise<RefreshToken> {
    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { id: oldId, tenantId: this.tenantId },
        data: { revoked: true, replacedByHash },
      });
      return tx.refreshToken.create({ data: newData });
    });
  }

  /** Revokes every active token in a family — used on logout and reuse detection */
  revokeFamilyByFamilyId(familyId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, tenantId: this.tenantId, revoked: false },
      data: { revoked: true },
    });
  }

  revokeRefreshToken(id: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id, ...this.tenantFilter },
      data: { revoked: true },
    });
  }

  revokeAllRefreshTokensForUser(userId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, tenantId: this.tenantId },
      data: { revoked: true },
    });
  }

  deleteExpiredRefreshTokens(): Promise<{ count: number }> {
    return this.prisma.refreshToken.deleteMany({
      where: { absoluteExpireAt: { lt: new Date() } },
    });
  }
}