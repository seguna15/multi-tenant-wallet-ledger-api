import { Tenant } from "@prisma-client";

export interface CreateTenantResult {
    tenant: Tenant;
    apiKey: string; // Plaintext API key, only returned on creation
    webhookSecret?: string; // Plaintext webhook secret, only returned on creation if provided
}


export interface RotateTenantApiKeyResult {
    apiKey: string; // New plaintext API key, only returned on rotation
}

export interface RotateTenantWebhookSecretResult {
  webhookSecret: string; // New plaintext secret, only returned on rotation
}
