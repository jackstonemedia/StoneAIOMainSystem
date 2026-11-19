/**
 * In-app notification preferences — Tier 3 Tranche A, Fix 11.
 *
 * The Settings toggles were local useState that only ever showed a toast:
 * nothing was persisted and no producer read them. Preferences live in
 * NotificationPreference (one row per toggle key; a missing row means the
 * default, enabled). Only keys with a real producer belong in
 * NOTIFICATION_KEYS — a toggle that promises a notification no code ever
 * sends is a lie, not a setting. Today that is only 'new_contact' (ad
 * leads syncing into contacts); deal_won, task_overdue, campaign_sent,
 * apt_created, inbound_sms, review_received and weekly_summary have no
 * producer, so they have no toggle. When a producer is built, add its key
 * here and to NOTIF_PREFS in Settings.tsx.
 */
import { db } from '../../../infrastructure/database/client.js';

export const NOTIFICATION_KEYS = ['new_contact'] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

export const NOTIFICATION_DEFAULTS: Record<NotificationKey, boolean> = {
  new_contact: true,
};

export async function getNotificationPreferences(
  workspaceId: string,
): Promise<Record<string, boolean>> {
  const rows = await db.notificationPreference.findMany({ where: { workspaceId } });
  const prefs: Record<string, boolean> = { ...NOTIFICATION_DEFAULTS };
  for (const row of rows) {
    if ((NOTIFICATION_KEYS as readonly string[]).includes(row.key)) {
      prefs[row.key] = row.enabled;
    }
  }
  return prefs;
}

export async function setNotificationPreferences(
  workspaceId: string,
  prefs: Record<string, boolean>,
): Promise<Record<string, boolean>> {
  for (const key of NOTIFICATION_KEYS) {
    if (prefs[key] === undefined) continue;
    await db.notificationPreference.upsert({
      where: { workspaceId_key: { workspaceId, key } },
      update: { enabled: !!prefs[key] },
      create: { workspaceId, key, enabled: !!prefs[key] },
    });
  }
  return getNotificationPreferences(workspaceId);
}

export async function isNotificationEnabled(
  workspaceId: string,
  key: NotificationKey,
): Promise<boolean> {
  const row = await db.notificationPreference.findUnique({
    where: { workspaceId_key: { workspaceId, key } },
  });
  return row ? row.enabled : NOTIFICATION_DEFAULTS[key];
}
