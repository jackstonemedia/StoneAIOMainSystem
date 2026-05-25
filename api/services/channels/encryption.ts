import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = process.env.CHANNEL_ENCRYPTION_KEY ?? '';
  if (hex.length !== 64) {
    throw new Error(
      'CHANNEL_ENCRYPTION_KEY must be a 64-char hex string. ' +
      'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/** Encrypts any JSON-serializable object. Returns a hex string. */
export function encryptJson(data: object): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: iv(24) + tag(32) + ciphertext
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}

/** Decrypts a hex string produced by encryptJson. */
export function decryptJson<T = Record<string, unknown>>(encryptedHex: string): T {
  const key = getKey();
  const iv = Buffer.from(encryptedHex.slice(0, 24), 'hex');
  const tag = Buffer.from(encryptedHex.slice(24, 56), 'hex');
  const ciphertext = Buffer.from(encryptedHex.slice(56), 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}

/** Encrypts a plain string. Returns a hex string. Used for API keys, tokens, etc. */
export function encryptString(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: iv(24) + tag(32) + ciphertext (same format as encryptJson)
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}

/** Decrypts a hex string produced by encryptString. */
export function decryptString(encryptedHex: string): string {
  const key = getKey();
  const iv = Buffer.from(encryptedHex.slice(0, 24), 'hex');
  const tag = Buffer.from(encryptedHex.slice(24, 56), 'hex');
  const ciphertext = Buffer.from(encryptedHex.slice(56), 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
