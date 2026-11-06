/**
 * Stage S2: Secret Stripping & Injection Defense Tests
 * Spec Section 2.10
 */

import { describe, it, expect } from 'vitest';
import { sanitizeSecrets, sanitizeSecretString } from '../services/assistant/tools/sanitizer.js';

describe('Secret Stripping & Data Sanitization', () => {
  it('strips Bearer tokens from strings', () => {
    const raw = 'Authorization: Bearer ya29.a0AfH6SMBabc123456789xyz_testToken';
    const clean = sanitizeSecretString(raw);
    expect(clean).not.toContain('ya29.a0AfH6SMBabc123456789xyz_testToken');
    expect(clean).toContain('[REDACTED]');
  });

  it('strips OpenAI API keys (sk-...)', () => {
    const raw = 'Using OpenAI key sk-proj1234567890abcdef1234567890abcdef in request';
    const clean = sanitizeSecretString(raw);
    expect(clean).not.toContain('sk-proj1234567890abcdef1234567890abcdef');
    expect(clean).toContain('[REDACTED]');
  });

  it('strips Google API keys (AIza...)', () => {
    const raw = 'Loaded API key AIzaSyA1234567890abcdefGhIjKlMnOpQrStU for Gemini';
    const clean = sanitizeSecretString(raw);
    expect(clean).not.toContain('AIzaSyA1234567890abcdefGhIjKlMnOpQrStU');
    expect(clean).toContain('[REDACTED]');
  });

  it('strips GitHub tokens (ghp_...)', () => {
    const raw = 'Token is ghp_1234567890abcdefghijklmnopqrstuvwxyz12';
    const clean = sanitizeSecretString(raw);
    expect(clean).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz12');
    expect(clean).toContain('[REDACTED]');
  });

  it('strips Database credentials from Postgres URLs', () => {
    const raw = 'Connected to postgresql://postgres:supersecretpassword123@ep-cool-db.us-east-1.pooler.railway.app:5432/railway';
    const clean = sanitizeSecretString(raw);
    expect(clean).not.toContain('supersecretpassword123');
    expect(clean).toContain('[REDACTED]');
  });

  it('redacts sensitive object keys recursively', () => {
    const payload = {
      user: {
        id: 'u1',
        name: 'Jane Doe',
        password: 'PlainTextPassword123!',
        apiKey: 'secret-key-value',
      },
      headers: {
        authorization: 'Bearer sensitive-token-here-12345',
      },
      metadata: [
        { key: 'access_token', token: 'jwt.token.here' },
        { key: 'public_info', note: 'safe content' },
      ],
    };

    const sanitized = sanitizeSecrets(payload);

    expect(sanitized.user.password).toBe('[REDACTED]');
    expect(sanitized.user.apiKey).toBe('[REDACTED]');
    expect(sanitized.headers.authorization).toBe('[REDACTED]');
    expect(sanitized.metadata[0].token).toBe('[REDACTED]');
    expect(sanitized.metadata[1].note).toBe('safe content');
    expect(sanitized.user.name).toBe('Jane Doe');
  });
});
