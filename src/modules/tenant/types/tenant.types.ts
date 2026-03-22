import { Tenant } from "@prisma/client";

export interface CreateTenantResult {
    tenant: Tenant;
    apiKey: string; // Plaintext API key, only returned on creation
}
