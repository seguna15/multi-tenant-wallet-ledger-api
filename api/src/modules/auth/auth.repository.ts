import { TenantStore } from "@common/cls/tenant-store.interface";
import { PrismaService } from "@common/database/prisma.service";
import { BaseRepository } from "@common/repositories/base.repository";
import { Injectable } from "@nestjs/common";
import { User, RefreshToken, UserRole } from "@prisma-client";
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

  findAdminUserByEmail(email: string): Promise<User | null> {
    // Intentionally unscoped — dashboard login has no API key context.
    // Restricted to admin roles so customers can never use this path.
    return this.prisma.user.findFirst({
      where: {
        email,
        role: { in: [UserRole.TENANT_ADMIN, UserRole.SYSTEM_ADMIN] },
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
   * Token-based auth flows (refresh, logout) authenticate by possession of a
   * valid refresh token, not via a CLS-populating guard — admin routes in
   * particular run no TenantClsGuard/UserClsGuard before reaching here, so
   * CLS may be empty. Callers pass the tenantId straight off the looked-up
   * token/user record; CLS remains the fallback for guarded /auth/* routes.
   */
  rotateRefreshToken(
    oldId: string,
    replacedByHash: string,
    newData: CreateRefreshTokenData,
    tenantId?: string,
  ): Promise<RefreshToken> {
    return this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { id: oldId, tenantId: tenantId ?? this.tenantId },
        data: { revoked: true, replacedByHash },
      });
      return tx.refreshToken.create({ data: newData });
    });
  }

  /** Revokes every active token in a family — used on logout and reuse detection */
  revokeFamilyByFamilyId(
    familyId: string,
    tenantId?: string,
  ): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, tenantId: tenantId ?? this.tenantId, revoked: false },
      data: { revoked: true },
    });
  }

  revokeRefreshToken(id: string, tenantId?: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id, tenantId: tenantId ?? this.tenantId },
      data: { revoked: true },
    });
  }

  revokeAllRefreshTokensForUser(
    userId: string,
    tenantId?: string,
  ): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, tenantId: tenantId ?? this.tenantId },
      data: { revoked: true },
    });
  }

  deleteExpiredRefreshTokens(): Promise<{ count: number }> {
    return this.prisma.refreshToken.deleteMany({
      where: { absoluteExpireAt: { lt: new Date() } },
    });
  }
}