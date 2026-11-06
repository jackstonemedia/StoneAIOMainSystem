/**
 * Secret Stripping & Sanitization — Stone AIO
 * Spec Section 2.10
 *
 * Strips API keys, auth tokens, passwords, and secret strings from data
 * before it is passed to the AI model or sent over SSE to the client.
 */

const SECRET_PATTERNS = [
  // Bearer tokens
  /bearer\s+[a-zA-Z0-9_\-.]{15,}/gi,
  // Generic API keys / hex tokens / hashes
  /(?:api[_-]?key|token|secret|password|passwd|auth[_-]?key)\s*[:=]\s*["']?([a-zA-Z0-9_\-.]{8,})["']?/gi,
  // Google API key (AIza...)
  /AIza[0-9A-Za-z_-]{30,45}/g,
  // OpenAI / standard sk- keys
  /sk-[a-zA-Z0-9]{20,}/g,
  // GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_)
  /gh[pousr]_[a-zA-Z0-9]{30,}/g,
  // JWT tokens
  /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
  // Postgres / DB URLs containing credentials
  /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^/]+/gi,
  // Generic basic auth in URLs
  /https?:\/\/[^:]+:[^@]+@[^/]+/gi,
];

const SENSITIVE_KEY_NAMES = new Set([
  'password',
  'passwd',
  'secret',
  'apikey',
  'api_key',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'authorization',
  'authheader',
  'auth_header',
  'privatekey',
  'private_key',
  'secretkey',
  'secret_key',
]);

export function sanitizeSecretString(input: string): string {
  if (!input || typeof input !== 'string') return input;

  let sanitized = input;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

export function sanitizeSecrets<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeSecretString(data) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeSecrets(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
      if (SENSITIVE_KEY_NAMES.has(lowerKey)) {
        sanitizedObj[key] = '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitizeSecrets(value);
      }
    }
    return sanitizedObj as T;
  }

  return data;
}
