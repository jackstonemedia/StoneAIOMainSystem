/**
 * Ad Account Service — OAuth flows, token storage, connect/disconnect.
 * Tokens are encrypted with the existing encryptString/decryptString pattern.
 */

import { db } from '../../../infrastructure/database/client.js';
import { encryptString, decryptString } from '../channels/encryption.js';
import {
  buildGoogleAuthUrl, exchangeGoogleCode, refreshGoogleToken, listGoogleAdAccounts,
} from './google-ads.service.js';
import {
  buildFacebookAuthUrl, exchangeFacebookCode, getLongLivedFacebookToken, listFacebookAdAccounts,
} from './facebook-ads.service.js';
import type { AdPlatform } from '../../schemas/ads.schemas.js';

const STATE_PREFIX_GOOGLE = 'google_ads:';
const STATE_PREFIX_FACEBOOK = 'fb_ads:';

// In-memory state store for OAuth (production would use Redis/DB)
const oauthStateStore = new Map<string, { workspaceId: string; userId: string; expiresAt: number }>();

// ─── OAuth Initiation ─────────────────────────────────────────────────────────

export function initGoogleOAuth(workspaceId: string, userId: string): string {
  const state = STATE_PREFIX_GOOGLE + crypto.randomUUID();
  oauthStateStore.set(state, { workspaceId, userId, expiresAt: Date.now() + 10 * 60 * 1000 });
  return buildGoogleAuthUrl(state);
}

export function initFacebookOAuth(workspaceId: string, userId: string): string {
  const state = STATE_PREFIX_FACEBOOK + crypto.randomUUID();
  oauthStateStore.set(state, { workspaceId, userId, expiresAt: Date.now() + 10 * 60 * 1000 });
  return buildFacebookAuthUrl(state);
}

function consumeState(state: string): { workspaceId: string; userId: string } {
  const data = oauthStateStore.get(state);
  if (!data) throw new Error('Invalid or expired OAuth state');
  if (Date.now() > data.expiresAt) {
    oauthStateStore.delete(state);
    throw new Error('OAuth state expired');
  }
  oauthStateStore.delete(state);
  return data;
}

// ─── Google OAuth Callback ────────────────────────────────────────────────────

export async function handleGoogleCallback(code: string, state: string) {
  const { workspaceId, userId } = consumeState(state);

  // Check concurrent connect guard
  const existing = await db.adAccount.findUnique({ where: { workspaceId_platform: { workspaceId, platform: 'GOOGLE' } } });
  if (existing && existing.status !== 'DISCONNECTED') {
    return { type: 'already_connected' as const, workspaceId };
  }

  const tokens = await exchangeGoogleCode(code);
  const accounts = await listGoogleAdAccounts(tokens.access_token);
  return { type: 'account_picker' as const, accounts, tokens, workspaceId, userId };
}

export async function completeGoogleConnect(
  workspaceId: string,
  userId: string,
  tokens: Awaited<ReturnType<typeof exchangeGoogleCode>>,
  accountId: string,
  accountName: string,
) {
  const encAccessToken = encryptString(tokens.access_token);
  const encRefreshToken = tokens.refresh_token ? encryptString(tokens.refresh_token) : '';
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

  await db.adAccount.upsert({
    where: { workspaceId_platform: { workspaceId, platform: 'GOOGLE' } },
    create: {
      workspaceId,
      platform: 'GOOGLE',
      externalAccountId: accountId,
      accountName,
      accessToken: encAccessToken,
      refreshToken: encRefreshToken,
      tokenExpiresAt: expiresAt,
      tokenLastRefreshedAt: new Date(),
      status: 'ACTIVE',
      connectedByUserId: userId,
    },
    update: {
      externalAccountId: accountId,
      accountName,
      accessToken: encAccessToken,
      refreshToken: encRefreshToken,
      tokenExpiresAt: expiresAt,
      tokenLastRefreshedAt: new Date(),
      status: 'ACTIVE',
      connectedByUserId: userId,
      disconnectedAt: null,
    },
  });
}

// ─── Facebook OAuth Callback ──────────────────────────────────────────────────

export async function handleFacebookCallback(code: string, state: string) {
  const { workspaceId, userId } = consumeState(state);

  const existing = await db.adAccount.findUnique({ where: { workspaceId_platform: { workspaceId, platform: 'FACEBOOK' } } });
  if (existing && existing.status !== 'DISCONNECTED') {
    return { type: 'already_connected' as const, workspaceId };
  }

  const shortTokens = await exchangeFacebookCode(code);
  const tokens = await getLongLivedFacebookToken(shortTokens.access_token);
  const accounts = await listFacebookAdAccounts(tokens.access_token);
  return { type: 'account_picker' as const, accounts, tokens, workspaceId, userId };
}

export async function completeFacebookConnect(
  workspaceId: string,
  userId: string,
  tokens: Awaited<ReturnType<typeof getLongLivedFacebookToken>>,
  accountId: string,
  accountName: string,
) {
  const encAccessToken = encryptString(tokens.access_token);
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

  await db.adAccount.upsert({
    where: { workspaceId_platform: { workspaceId, platform: 'FACEBOOK' } },
    create: {
      workspaceId,
      platform: 'FACEBOOK',
      externalAccountId: accountId,
      accountName,
      accessToken: encAccessToken,
      refreshToken: '',
      tokenExpiresAt: expiresAt,
      tokenLastRefreshedAt: new Date(),
      status: 'ACTIVE',
      connectedByUserId: userId,
    },
    update: {
      externalAccountId: accountId,
      accountName,
      accessToken: encAccessToken,
      tokenExpiresAt: expiresAt,
      tokenLastRefreshedAt: new Date(),
      status: 'ACTIVE',
      connectedByUserId: userId,
      disconnectedAt: null,
    },
  });
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

export async function disconnectAdAccount(workspaceId: string, platform: 'GOOGLE' | 'FACEBOOK') {
  await db.adAccount.updateMany({
    where: { workspaceId, platform },
    data: { status: 'DISCONNECTED', accessToken: '', refreshToken: '', disconnectedAt: new Date() },
  });
}

// ─── Get Connected Accounts ───────────────────────────────────────────────────

export async function getAdAccounts(workspaceId: string) {
  return db.adAccount.findMany({
    where: { workspaceId },
    select: {
      id: true, platform: true, externalAccountId: true, accountName: true,
      status: true, connectedAt: true, connectedByUserId: true,
      lastSyncAt: true, tokenExpiresAt: true, disconnectedAt: true,
      createdAt: true, updatedAt: true,
    },
  });
}

// ─── Token Decryption (for internal service use) ──────────────────────────────

export async function getDecryptedTokens(workspaceId: string, platform: 'GOOGLE' | 'FACEBOOK') {
  const account = await db.adAccount.findUnique({
    where: { workspaceId_platform: { workspaceId, platform } },
  });
  if (!account || account.status === 'DISCONNECTED') return null;
  return {
    account,
    accessToken: decryptString(account.accessToken),
    refreshToken: account.refreshToken ? decryptString(account.refreshToken) : '',
  };
}

// ─── Token Refresh (Google only) ─────────────────────────────────────────────

export async function maybeRefreshGoogleToken(workspaceId: string): Promise<string | null> {
  const result = await getDecryptedTokens(workspaceId, 'GOOGLE');
  if (!result) return null;
  const { account, accessToken, refreshToken } = result;

  const shouldRefresh = account.tokenExpiresAt && account.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000;
  if (!shouldRefresh || !refreshToken) return accessToken;

  try {
    const newTokens = await refreshGoogleToken(refreshToken);
    const enc = encryptString(newTokens.access_token);
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
    await db.adAccount.update({
      where: { id: account.id },
      data: { accessToken: enc, tokenExpiresAt: expiresAt, tokenLastRefreshedAt: new Date() },
    });
    return newTokens.access_token;
  } catch (e) {
    console.error('[AdAccountService] Token refresh failed:', e);
    await db.adAccount.update({ where: { id: account.id }, data: { status: 'NEEDS_ATTENTION' } });
    return null;
  }
}
