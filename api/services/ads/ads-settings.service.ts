/**
 * Ad Workspace Settings Service — get-or-create, update, pause-all.
 */

import { db } from '../../../infrastructure/database/client.js';
import type { UpdateSettingsInput } from '../../schemas/ads.schemas.js';
import { pauseAllActiveCampaigns } from './ads-campaign.service.js';

export async function getOrCreateSettings(workspaceId: string) {
  const existing = await db.adWorkspaceSettings.findUnique({ where: { workspaceId } });
  if (existing) return existing;

  return db.adWorkspaceSettings.create({
    data: {
      workspaceId,
      leadNotificationsEnabled: true,
      leadNotificationMode: 'IN_APP',
      aiAssistedCreativeDefault: true,
    },
  });
}

export async function updateSettings(workspaceId: string, input: UpdateSettingsInput) {
  const existing = await db.adWorkspaceSettings.findUnique({ where: { workspaceId } });

  const data: any = {};
  if (input.defaultDailyBudgetCents !== undefined) data.defaultDailyBudgetCents = input.defaultDailyBudgetCents;
  if (input.leadNotificationsEnabled !== undefined) data.leadNotificationsEnabled = input.leadNotificationsEnabled;
  if (input.leadNotificationMode !== undefined) data.leadNotificationMode = input.leadNotificationMode;
  if (input.aiAssistedCreativeDefault !== undefined) data.aiAssistedCreativeDefault = input.aiAssistedCreativeDefault;

  if (existing) {
    return db.adWorkspaceSettings.update({ where: { workspaceId }, data });
  }
  return db.adWorkspaceSettings.create({ data: { workspaceId, ...data } });
}

export async function pauseAllCampaigns(workspaceId: string, userId: string) {
  return pauseAllActiveCampaigns(workspaceId, userId);
}
