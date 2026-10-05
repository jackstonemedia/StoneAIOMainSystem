/**
 * Crypto Tokens Utility — Stone AIO
 *
 * Provides cryptographic HMAC signing and verification for:
 * - Unsubscribe links (preventing cross-tenant/forged unsubscription)
 * - Click & open tracking parameters (preventing open redirect abuse)
 * - Safe URL redirect validation (preventing open redirects)
 */

import { createHmac, timingSafeEqual } from 'crypto';

const FALLBACK_DEV_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export function getHmacKey(): string {
  const key = process.env.CHANNEL_ENCRYPTION_KEY;
  if (key && key.length >= 32) {
    return key;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CHANNEL_ENCRYPTION_KEY must be configured in production');
  }
  return FALLBACK_DEV_KEY;
}

/** Generates a SHA-256 HMAC hexadecimal signature for a given string payload. */
export function generateHmacSignature(payload: string, customKey?: string): string {
  const key = customKey ?? getHmacKey();
  return createHmac('sha256', key).update(payload).digest('hex');
}

/** Verifies a SHA-256 HMAC signature against a payload using constant-time comparison. */
export function verifyHmacSignature(payload: string, signature: string, customKey?: string): boolean {
  if (!signature || typeof signature !== 'string') return false;
  try {
    const expected = generateHmacSignature(payload, customKey);
    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

export interface UnsubscribePayload {
  workspaceId: string;
  contactId: string;
  createdAt?: number;
}

/**
 * Creates an HMAC-signed unsubscribe token.
 * Format: `<base64url(payload)>.<hex(signature)>`
 */
export function createUnsubscribeToken(workspaceId: string, contactId: string): string {
  const payload: UnsubscribePayload = {
    workspaceId,
    contactId,
    createdAt: Date.now(),
  };
  const jsonStr = JSON.stringify(payload);
  const encodedPayload = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const signature = generateHmacSignature(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Validates and decodes an HMAC-signed unsubscribe token.
 * Returns `{ workspaceId, contactId }` on success, or `null` if forged or invalid.
 */
export function verifyUnsubscribeToken(token: string): { workspaceId: string; contactId: string } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  if (!verifyHmacSignature(encodedPayload, signature)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const parsed = JSON.parse(jsonStr) as UnsubscribePayload;
    if (!parsed.workspaceId || !parsed.contactId) {
      return null;
    }
    return {
      workspaceId: parsed.workspaceId,
      contactId: parsed.contactId,
    };
  } catch {
    return null;
  }
}

export interface ClickTrackingParams {
  url: string;
  workspaceId: string;
  contactId: string;
}

/**
 * Creates an HMAC signature for email click-tracking parameters.
 */
export function createClickTrackingSignature(params: ClickTrackingParams): string {
  const payload = `${params.workspaceId}:${params.contactId}:${params.url}`;
  return generateHmacSignature(payload);
}

/**
 * Verifies an HMAC signature for email click-tracking parameters.
 */
export function verifyClickTrackingSignature(params: ClickTrackingParams, signature: string): boolean {
  const payload = `${params.workspaceId}:${params.contactId}:${params.url}`;
  return verifyHmacSignature(payload, signature);
}

/**
 * Validates whether a target redirect URL is safe to navigate to.
 * - Rejects non-HTTP(S) protocols (javascript:, data:, file:, etc.)
 * - Rejects protocol-relative URLs (//example.com, /\example.com)
 * - Allows relative paths (/dashboard, /login)
 * - If allowedHosts is supplied, strictly requires URL hostname to match.
 */
export function isSafeRedirectUrl(targetUrl: string, allowedHosts?: string[]): boolean {
  if (!targetUrl || typeof targetUrl !== 'string') return false;
  const trimmed = targetUrl.trim();
  if (!trimmed) return false;

  // Protocol-relative URL check (e.g., //evil.com, /\evil.com)
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.startsWith('\\/')) {
    return false;
  }

  // Safe relative path (e.g. /dashboard, /settings?tab=general)
  if (trimmed.startsWith('/')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    if (allowedHosts && allowedHosts.length > 0) {
      const hostname = parsed.hostname.toLowerCase();
      return allowedHosts.some(allowed => {
        const normAllowed = allowed.toLowerCase().replace(/:\d+$/, '');
        if (normAllowed.startsWith('*.')) {
          const rootDomain = normAllowed.slice(2);
          return hostname === rootDomain || hostname.endsWith(`.${rootDomain}`);
        }
        return hostname === normAllowed;
      });
    }

    return true;
  } catch {
    return false;
  }
}
