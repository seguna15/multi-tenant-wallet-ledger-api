import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.WEBHOOK_ENCRYPTION_KEY!, 'hex');

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(12); // GCM recommends 12 bytes IV
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv) as crypto.CipherGCM;
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encrypted: string): string {
    const [ivHex, tagHex, encryptedHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(tag);
    return decipher.update(encryptedText) + decipher.final('utf8');
}