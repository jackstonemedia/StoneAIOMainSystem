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
  listFacebookPages, subscribePageToLeadgenWebhook, subscribeAppToWebhook
} from './facebook-ads.service.js';
type AdPlatform = 'GOOGLE' | 'FACEBOOK';

const STATE_PREFIX_GOOGLE = 'google_ads:';
const STATE_PREFIX_FACEBOOK = 'fb_ads:';

// ─── OAuth Initiation ─────────────────────────────────────────────────────────

export async function initGoogleOAuth(workspaceId: string, userId: string): Promise<string> {
  const state = STATE_PREFIX_GOOGLE + crypto.randomUUID();
  await db.adsOAuthState.create({
    data: {
      state,
      workspaceId,
      userId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return buildGoogleAuthUrl(state);
}

export async function initFacebookOAuth(workspaceId: string, userId: string): Promise<string> {
  const state = STATE_PREFIX_FACEBOOK + crypto.randomUUID();
  await db.adsOAuthState.create({
    data: {
      state,
      workspaceId,
      userId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return buildFacebookAuthUrl(state);
}

async function consumeState(state: string): Promise<{ workspaceId: string; userId: string }> {
  const record = await db.adsOAuthState.findUnique({ where: { state } });
  if (!record) throw new Error('Invalid or expired OAuth state');
  if (record.expiresAt < new Date()) {
    await db.adsOAuthState.delete({ where: { state } }).catch(() => {});
    throw new Error('OAuth state expired');
  }
  await db.adsOAuthState.delete({ where: { state } });
  return { workspaceId: record.workspaceId, userId: record.userId };
}

// ─── Google OAuth Callback ────────────────────────────────────────────────────

export async function handleGoogleCallback(code: string, state: string) {
  const { workspaceId, userId } = await consumeState(state);

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
  const { workspaceId, userId } = await consumeState(state);

  const existing = await db.adAccount.findUnique({ where: { workspaceId_platform: { workspaceId, platform: 'FACEBOOK' } } });
  if (existing && existing.status !== 'DISCONNECTED') {
    return { type: 'already_connected' as const, workspaceId };
  }

  const shortTokens = await exchangeFacebookCode(code);
  const tokens = await getLongLivedFacebookToken(shortTokens.access_token);
  const accounts = await listFacebookAdAccounts(tokens.access_token);
  const pages = await listFacebookPages(tokens.access_token);
  return { type: 'account_picker' as const, accounts, pages, tokens, workspaceId, userId };
}

export async function completeFacebookConnect(
  workspaceId: string,
  userId: string,
  tokens: Awaited<ReturnType<typeof getLongLivedFacebookToken>>,
  accountId: string,
  accountName: string,
  pages: Awaited<ReturnType<typeof listFacebookPages>> = [],
) {
  const encAccessToken = encryptString(tokens.access_token);
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

  // Encrypt page tokens and prepare for JSON storage
  const encryptedPages = pages.map(p => ({
    id: p.id,
    name: p.name,
    accessToken: encryptString(p.access_token),
    category: p.category,
  }));

  // Subscribe pages to webhook
  for (const page of pages) {
    try {
      await subscribePageToLeadgenWebhook(page.id, page.access_token);
    } catch (e) {
      console.error(`[AdsAccountService] Failed to subscribe page ${page.id}:`, e);
    }
  }
  
  // Also ensure app is subscribed to the page object
  try {
    await subscribeAppToWebhook();
  } catch (e) {
    console.error(`[AdsAccountService] Failed to subscribe app to webhook:`, e);
  }

  await db.adAccount.upsert({
    where: { workspaceId_platform: { workspaceId, platform: 'FACEBOOK' } },
    create: {
      workspaceId,
      platform: 'FACEBOOK',
      externalAccountId: accountId,
      accountName,
      accessToken: encAccessToken,
      facebookPages: JSON.stringify(encryptedPages),
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
      facebookPages: JSON.stringify(encryptedPages),
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
  if (platform === 'FACEBOOK') {
    const account = await db.adAccount.findUnique({ where: { workspaceId_platform: { workspaceId, platform } } });
    if (account && account.facebookPages) {
      try {
        const pages = JSON.parse(account.facebookPages) as Array<{id: string, accessToken: string}>;
        for (const p of pages) {
          const pt = decryptString(p.accessToken);
          // Unsubscribe page
          await fetch(`https://graph.facebook.com/v22.0/${p.id}/subscribed_apps`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: pt }),
          }).catch(console.error);
        }
      } catch (e) {
        console.error('[AdsAccountService] Failed to unsubscribe pages on disconnect:', e);
      }
    }
  }

  await db.adAccount.updateMany({
    where: { workspaceId, platform },
    data: { status: 'DISCONNECTED', accessToken: '', refreshToken: '', facebookPages: '[]', disconnectedAt: new Date() },
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

// ─── Token Refresh (Facebook) ─────────────────────────────────────────────

export async function maybeRefreshFacebookToken(workspaceId: string): Promise<string | null> {
  const result = await getDecryptedTokens(workspaceId, 'FACEBOOK');
  if (!result) return null;
  const { account, accessToken } = result;

  // Refresh if less than 7 days remaining
  const shouldRefresh = account.tokenExpiresAt && account.tokenExpiresAt.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
  if (!shouldRefresh) return accessToken;

  try {
    const newTokens = await getLongLivedFacebookToken(accessToken);
    const enc = encryptString(newTokens.access_token);
    const expiresAt = newTokens.expires_in ? new Date(Date.now() + newTokens.expires_in * 1000) : null;
    await db.adAccount.update({
      where: { id: account.id },
      data: { accessToken: enc, tokenExpiresAt: expiresAt, tokenLastRefreshedAt: new Date() },
    });
    return newTokens.access_token;
  } catch (e) {
    console.error('[AdAccountService] Facebook Token refresh failed:', e);
    await db.adAccount.update({ where: { id: account.id }, data: { status: 'NEEDS_ATTENTION' } });
    return null;
  }
}

// ─── Retrieve Page Token ──────────────────────────────────────────────────

export async function getFacebookPageAccessToken(workspaceId: string, pageId: string): Promise<string | null> {
  const account = await db.adAccount.findUnique({
    where: { workspaceId_platform: { workspaceId, platform: 'FACEBOOK' } },
  });
  if (!account || !account.facebookPages) return null;
  try {
    const pages = JSON.parse(account.facebookPages) as Array<{id: string, accessToken: string}>;
    const page = pages.find(p => p.id === pageId);
    if (page) return decryptString(page.accessToken);
  } catch (e) {
    console.error('[AdsAccountService] Failed to parse facebookPages:', e);
  }
  return null;
}
