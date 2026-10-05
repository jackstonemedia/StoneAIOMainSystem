import { describe, it, expect } from 'vitest';
import {
  generateHmacSignature,
  verifyHmacSignature,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  createClickTrackingSignature,
  verifyClickTrackingSignature,
  isSafeRedirectUrl,
} from '../crypto-tokens.js';

describe('Crypto Tokens — HMAC Signing & Unsubscribe Security (C4)', () => {
  it('generates and verifies HMAC signatures accurately', () => {
    const payload = 'workspace_123:contact_456';
    const sig = generateHmacSignature(payload);
    expect(sig).toBeDefined();
    expect(typeof sig).toBe('string');
    expect(sig.length).toBe(64); // SHA-256 hex is 64 chars

    expect(verifyHmacSignature(payload, sig)).toBe(true);
    expect(verifyHmacSignature(payload + '_tampered', sig)).toBe(false);
    expect(verifyHmacSignature(payload, sig.slice(0, -1) + 'a')).toBe(false);
  });

  it('generates and verifies unsubscribe tokens', () => {
    const wsId = 'ws_alpha_1';
    const contactId = 'ct_bravo_2';
    const token = createUnsubscribeToken(wsId, contactId);

    expect(token).toContain('.');
    const verified = verifyUnsubscribeToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.workspaceId).toBe(wsId);
    expect(verified?.contactId).toBe(contactId);
  });

  it('rejects tampered unsubscribe tokens', () => {
    const token = createUnsubscribeToken('ws_1', 'ct_1');
    const [payload, sig] = token.split('.');

    // Tamper payload (e.g. attacker changing contactId)
    const forgedPayload = Buffer.from(JSON.stringify({ workspaceId: 'ws_1', contactId: 'ct_victim' })).toString('base64url');
    const forgedToken = `${forgedPayload}.${sig}`;

    expect(verifyUnsubscribeToken(forgedToken)).toBeNull();

    // Tamper signature
    const corruptSigToken = `${payload}.${sig.slice(0, 10)}${'0'.repeat(54)}`;
    expect(verifyUnsubscribeToken(corruptSigToken)).toBeNull();

    // Malformed token without signature
    expect(verifyUnsubscribeToken('invalid-unsplit-token')).toBeNull();
    expect(verifyUnsubscribeToken('')).toBeNull();
  });

  it('generates and verifies click tracking signatures', () => {
    const params = {
      url: 'https://client-domain.com/landing-page',
      workspaceId: 'ws_123',
      contactId: 'ct_456',
    };

    const sig = createClickTrackingSignature(params);
    expect(verifyClickTrackingSignature(params, sig)).toBe(true);

    // Tampered URL
    expect(
      verifyClickTrackingSignature(
        { ...params, url: 'https://evil-phishing.com' },
        sig
      )
    ).toBe(false);

    // Tampered workspace
    expect(
      verifyClickTrackingSignature(
        { ...params, workspaceId: 'ws_other' },
        sig
      )
    ).toBe(false);
  });

  describe('isSafeRedirectUrl (Open Redirect Prevention)', () => {
    it('allows valid relative URLs', () => {
      expect(isSafeRedirectUrl('/dashboard')).toBe(true);
      expect(isSafeRedirectUrl('/settings?tab=profile')).toBe(true);
      expect(isSafeRedirectUrl('/portal/invoice/123')).toBe(true);
    });

    it('rejects protocol-relative URLs', () => {
      expect(isSafeRedirectUrl('//evil.com')).toBe(false);
      expect(isSafeRedirectUrl('///evil.com')).toBe(false);
      expect(isSafeRedirectUrl('/\\evil.com')).toBe(false);
    });

    it('rejects dangerous protocols', () => {
      expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeRedirectUrl('data:text/html,<h1>XSS</h1>')).toBe(false);
      expect(isSafeRedirectUrl('file:///etc/passwd')).toBe(false);
    });

    it('validates against allowed hosts when specified', () => {
      const allowed = ['stoneaio.com', '*.stoneaio.com', 'clientsite.org'];

      expect(isSafeRedirectUrl('https://stoneaio.com/features', allowed)).toBe(true);
      expect(isSafeRedirectUrl('https://app.stoneaio.com/dashboard', allowed)).toBe(true);
      expect(isSafeRedirectUrl('https://clientsite.org/welcome', allowed)).toBe(true);

      // Disallowed external domains
      expect(isSafeRedirectUrl('https://evil-phishing.com', allowed)).toBe(false);
      expect(isSafeRedirectUrl('https://stoneaio.com.attacker.org', allowed)).toBe(false);
    });

    it('accepts any valid http/https URL when no host restriction is provided', () => {
      expect(isSafeRedirectUrl('https://example.com/blog')).toBe(true);
      expect(isSafeRedirectUrl('http://example.org')).toBe(true);
    });
  });
});
