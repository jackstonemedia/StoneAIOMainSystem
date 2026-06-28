/**
 * Dedup Service — Lead Studio
 * Fuzzy deduplication using normalized name + city + state fingerprinting.
 * Checks against the user_lead_history table to prevent serving repeat leads.
 */

import { db } from '../../../infrastructure/database/client.js';

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|company|ltd|the|a|an|and|&)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export interface LeadFingerprint {
  normalizedName: string;
  city: string;
  state: string;
  phone?: string;
}

export function buildFingerprint(
  businessName?: string,
  city?: string,
  state?: string,
  phone?: string
): LeadFingerprint | null {
  if (!businessName || !city || !state) return null;
  return {
    normalizedName: normalizeName(businessName),
    city: city.trim().toLowerCase(),
    state: state.trim().toUpperCase().slice(0, 2),
    phone,
  };
}

/**
 * Check if a batch of fingerprints already exist in user's history.
 * Returns a Set of fingerprint keys that are already seen.
 */
export async function loadExistingFingerprints(
  workspaceId: string,
  userId: string,
  fingerprints: LeadFingerprint[]
): Promise<Set<string>> {
  if (fingerprints.length === 0) return new Set();

  const names = [...new Set(fingerprints.map(f => f.normalizedName))];
  const existing = await db.userLeadHistory.findMany({
    where: {
      workspaceId,
      userId,
      normalizedName: { in: names },
    },
    select: { normalizedName: true, city: true, state: true },
  });

  return new Set(existing.map(e => `${e.normalizedName}::${e.city}::${e.state}`));
}

export function getFingerprintKey(fp: LeadFingerprint): string {
  return `${fp.normalizedName}::${fp.city}::${fp.state}`;
}

/**
 * Persist new fingerprints to user_lead_history.
 */
export async function storeFingerprints(
  workspaceId: string,
  userId: string,
  fingerprints: LeadFingerprint[]
): Promise<void> {
  if (fingerprints.length === 0) return;

  const now = new Date();
  for (const fp of fingerprints) {
    try {
      await db.userLeadHistory.upsert({
        where: {
          workspaceId_userId_normalizedName_city_state: {
            workspaceId,
            userId,
            normalizedName: fp.normalizedName,
            city: fp.city,
            state: fp.state,
          },
        },
        create: {
          workspaceId,
          userId,
          normalizedName: fp.normalizedName,
          city: fp.city,
          state: fp.state,
          phone: fp.phone,
          firstSeenAt: now,
          lastSeenAt: now,
          timesReturned: 1,
        },
        update: {
          lastSeenAt: now,
          timesReturned: { increment: 1 },
        },
      });
    } catch { /* unique constraint race — safe to ignore */ }
  }
}

/**
 * Get or create today's quota record.
 */
export async function getQuota(workspaceId: string, userId: string): Promise<{ leadsUsed: number; leadsRequested: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const record = await db.dailyLeadQuota.findFirst({
      where: { workspaceId, userId, date: { gte: today } },
    });
    return record ?? { leadsUsed: 0, leadsRequested: 0 };
  } catch {
    return { leadsUsed: 0, leadsRequested: 0 };
  }
}

export async function incrementQuota(workspaceId: string, userId: string, count: number): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    await (db as any).$executeRaw`
      INSERT INTO daily_lead_quotas (workspace_id, user_id, date, leads_used, leads_requested)
      VALUES (${workspaceId}, ${userId}, CURRENT_DATE, ${count}, ${count})
      ON CONFLICT (workspace_id, user_id, date)
      DO UPDATE SET 
        leads_used = daily_lead_quotas.leads_used + ${count},
        leads_requested = daily_lead_quotas.leads_requested + ${count}
    `;
  } catch (e: any) {
    // fallback for SQLite dev
  }
}
