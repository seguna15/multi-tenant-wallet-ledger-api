import * as crypto from "crypto";

const API_KEY_PREFIX = "lapi_";

/**
 * Generates a cryptographically random API key.
 * Returns the plain key — store the hash, return this once to the caller.
 */
export function generateApiKey(): string {
    return `${API_KEY_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
}

/** SHA-256 of the plain key — deterministic, safe for DB unique lookup. */
export function hashApiKey(plainKey: string): Promise<string> {
    return Promise.resolve(crypto.createHash("sha256").update(plainKey).digest("hex"));
}   

/** Same hash used in strategy validation. */
export function verifyApiKey(plainKey: string, hash: string): boolean {
    const computed  = crypto.createHash("sha256").update(plainKey).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}

/** Generate webhook secret. */
export function generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString("hex");
}