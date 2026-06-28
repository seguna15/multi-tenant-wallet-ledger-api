import { UserRole } from "@prisma-client";

export interface RequestUser {
    userId: string;
    email: string;
    tenantId: string;
    role: UserRole;
}

export interface JwtPayload {
    sub: string; // User ID
    email: string;
    tenantId: string; // Tenant ID
    role: UserRole;
}

export interface CreateRefreshTokenData {
  tokenHash: string;
  familyId: string;
  userId: string;
  tenantId: string;
  expiresAt: Date;
  absoluteExpireAt: Date;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface TokenPayload {
    userId: string;
    tenantId: string;
    email: string;
    role: UserRole;
}