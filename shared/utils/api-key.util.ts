import * as crypto from "crypto";
import * as argon2 from "argon2";

const API_KEY_PREFIX = "lapi_";

/**
 * Generates a cryptographically random API key.
 * Returns the plain key — store the hash, return this once to the caller.
 */
export function generateApiKey(): string {
    return `${API_KEY_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
}

/**
 * Hashes an API key with argon2id before storage.
 * Never store the plain key.
 */
export function hashApiKey(plainKey: string): Promise<string> {
    return argon2.hash(plainKey, {type: argon2.argon2id});
}   

/**
 * Verifies a plain API key against its stored hash.
 * Used in the API key Passport strategy.
 */
export function verifyApiKey(plainKey: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, plainKey);
}