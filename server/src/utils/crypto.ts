import crypto from 'node:crypto';

// Use a 32-byte key for AES-256-GCM
const algorithm = 'aes-256-gcm';
const getMasterKey = () => {
    const key = process.env.ENCRYPTION_MASTER_KEY;
    if (!key || Buffer.from(key).length !== 32) { // Allow raw string if 32 bytes or base64 decoding to 32
        // Try base64
        if (key && Buffer.from(key, 'base64').length === 32) {
            return Buffer.from(key, 'base64');
        }
        // Try hex
        if (key && Buffer.from(key, 'hex').length === 32) {
            return Buffer.from(key, 'hex');
        }
        // Fallback to strict utf8
        if (key && Buffer.from(key, 'utf8').length === 32) {
            return Buffer.from(key, 'utf8');
        }
        throw new Error('ENCRYPTION_MASTER_KEY must be exactly 32 bytes long in base64, hex, or utf8 string.');
    }
    return Buffer.from(key);
};

export const encryptText = (text: string): string => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(algorithm, getMasterKey(), iv);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag().toString('base64');

    // Format: iv:encrypted:authTag
    return `${iv.toString('base64')}:${encrypted}:${authTag}`;
};

export const decryptText = (encryptedData: string): string => {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
    }

    const [ivStr, encStr, authTagStr] = parts;
    const iv = Buffer.from(ivStr, 'base64');
    const authTag = Buffer.from(authTagStr, 'base64');

    const decipher = crypto.createDecipheriv(algorithm, getMasterKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encStr, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};
