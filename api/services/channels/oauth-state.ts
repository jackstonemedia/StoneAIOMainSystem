import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed OAuth state — Tier 2 Fix 1.
 *
 * OAuth `state` used to be unsigned base64 JSON trusted verbatim on callback,
 * so anyone could craft a state naming a victim workspace and bind their own
 * Gmail/Outlook/Meta account to it. The state is now HMAC-SHA256 signed with
 * a server secret and expires 10 minutes after issue.
 *
 * Format: base64url(JSON).base64url(HMAC-SHA256(base64url(JSON)))
 * JSON body: { workspaceId, userId, provider, exp }
 *
 * The callbacks authenticate via this state (resolveWorkspace skips JWT for
 * OAuth callback redirects, which carry no Authorization header), so a valid
 * signature is the ONLY trust anchor — never trust an unsigned state.
 */

export interface OAuthStatePayload {
  workspaceId: string;
  userId: string;
  provider: string;
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET ?? '';
  if (!secret) {
    throw new Error(
      'OAuth state signing is not configured: set OAUTH_STATE_SECRET in the server environment. ' +
        'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return secret;
}

/** Sign an OAuth state payload. Throws if OAUTH_STATE_SECRET is not configured. */
export function signOAuthState(payload: OAuthStatePayload): string {
  const body = { ...payload, exp: Date.now() + STATE_TTL_MS };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

/**
 * Verify a signed state string. Returns the payload.
 * Throws on malformed / tampered / expired state or a missing secret.
 * Callers must also check the returned provider matches the callback route.
 */
export function verifyOAuthState(raw: string): OAuthStatePayload {
  const parts = typeof raw === 'string' ? raw.split('.') : [];
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid OAuth state format');
  }
  const [encoded, sig] = parts;
  const expected = createHmac('sha256', getSecret()).update(encoded).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(sig, 'base64url');
  } catch {
    throw new Error('Invalid OAuth state signature');
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('Invalid OAuth state signature');
  }
  let body: any;
  try {
    body = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid OAuth state payload');
  }
  if (!body || typeof body.workspaceId !== 'string' || typeof body.userId !== 'string' || typeof body.provider !== 'string') {
    throw new Error('Invalid OAuth state payload');
  }
  if (typeof body.exp !== 'number' || Date.now() > body.exp) {
    throw new Error('OAuth state expired');
  }
  return { workspaceId: body.workspaceId, userId: body.userId, provider: body.provider };
}
