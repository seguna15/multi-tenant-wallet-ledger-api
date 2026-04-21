export interface RequestUser {
    userId: string;
    email: string;
    tenantId: string;
}

export interface JwtPayload {
    sub: string; // User ID
    email: string;
    tenantId: string; // Tenant ID
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
    email: string
}