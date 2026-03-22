import { TenantStore } from "@common/cls/tenant-store.interface";
import { PrismaClient } from "@prisma/client";
import { ClsService } from "nestjs-cls";
import { Logger } from "@nestjs/common";

export abstract class BaseRepository {
  protected readonly logger: Logger;
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly clsService: ClsService<TenantStore>,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Resolves tenantId from CLS. Throws if no tenant context exists —
   * this is intentional; a missing tenant on a scoped query is always
   * a programmer error, not a user error.
   */
  protected get tenantId(): string {
    const tenantId = this.clsService.get('tenantId');
    if (!tenantId) {
      this.logger.error('Tenant ID not found in CLS context');
      throw new Error('Tenant ID not found in context');
    }
    return tenantId;
  }

  /**
   * Resolves userId from CLS. Only available on routes protected by both
   * API key + JWT guards. Throws if called on a tenant-only request,
   * which surfaces the misconfiguration immediately.
   */
  protected get currentUserId(): string {
    const userId = this.clsService.get('userId');
    if (!userId) {
      this.logger.warn('User ID not found in CLS context');
      throw new Error('User ID not found in context');
    }
    return userId;
  }

  /**
   * Wraps `where` in an AND clause scoped to the current tenant.
   *
   * - Short-circuits when `isGlobalAdmin` is true (outbox processor,
   *   webhook handlers, cron jobs — any path without a real tenant context).
   * - Accepts an explicit `tenantId` override for webhook ingestion paths
   *   that carry a tenant ID in the payload but have no authenticated user.
   * - Chainable: pass the result directly into `withJoinedTenant`.
   *
   * @example
   * // Single scope
   * where: this.withTenant({ isActive: true })
   * // → { AND: [{ isActive: true }, { tenantId: '...' }] }
   *
   * @example
   * // Chained with joined scope
   * where: this.withJoinedTenant(this.withTenant({ type: 'DEBIT' }), 'wallet')
   * // → { AND: [{ AND: [{ type: 'DEBIT' }, { tenantId }] }, { wallet: { tenantId } }] }
   */
  protected withTenant<T extends object>(
    where: T = {} as T,
    tenantId?: string,
  ): object {
    if (!tenantId && this.clsService.get('isGlobalAdmin')) {
      return where;
    }

    return {
      AND: [where, { tenantId: tenantId ?? this.tenantId }],
    };
  }

  /**
   * Wraps `where` in an AND clause that asserts tenant ownership through
   * a relation field instead of (or in addition to) a direct `tenantId`.
   *
   * The primary use case is cross-tenant FK validation: you hold a `walletId`
   * from the request body and want to verify the wallet belongs to the calling
   * tenant in the same query — no separate round-trip needed.
   *
   * - Short-circuits when `isGlobalAdmin` is true.
   * - Call multiple times to assert ownership through several relations.
   *
   * @param relation  The relation field on this model that carries tenantId.
   *                  e.g. 'wallet', 'transfer'
   *
   * @example
   * // Assert wallet belongs to tenant when querying journal entries
   * where: this.withJoinedTenant(this.withTenant({}), 'wallet')
   * // → { AND: [{AND: [{}, { tenantId }]}, { wallet: { tenantId } }] }
   *
   * @example
   * // Multiple relations
   * where: this.withJoinedTenant(
   *   this.withJoinedTenant(this.withTenant({}), 'wallet'),
   *   'transfer',
   * )
   */
  protected withJoinedTenant<T extends object>(
    where: T = {} as T,
    relation: string,
    tenantId?: string,
  ): object {
    if (this.clsService.get('isGlobalAdmin')) {
      return where;
    }

    return {
      AND: [where, { [relation]: { tenantId: tenantId ?? this.tenantId } }],
    };
  }
}