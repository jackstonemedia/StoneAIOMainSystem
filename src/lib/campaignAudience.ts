/**
 * Campaign audience display — the editor's TARGET AUDIENCE count.
 *
 * A campaign whose real recipients are direct CampaignRecipient rows (e.g. a
 * CRM bulk-email draft, built from the contacts the user selected) shows
 * that count — never a smart list's count. The rule matches the send-side
 * resolution in `resolveCampaignRecipientContactIds`
 * (api/services/email-marketing/campaigns.service.ts): direct rows count
 * only when no list / segment / smartList audience is set. A set audience
 * always wins, so picking a list in the editor switches both the display
 * and the send to that list.
 *
 * When no direct recipients apply, the count is the selected smart list's
 * count, exactly as before.
 */

export type AudienceCount = { count: number | 'All'; isDirect: boolean };

export function getDirectRecipientCount(campaign: unknown): number {
  const recipients = (campaign as any)?.recipients;
  return Array.isArray(recipients) ? recipients.length : 0;
}

export function deriveAudienceCount(
  campaign: unknown,
  selectedSmartList: { contactCount?: number; _count?: { items?: number } } | undefined,
  audience: { smartListId?: string; segmentId?: string; listId?: string }
): AudienceCount {
  const directCount = getDirectRecipientCount(campaign);
  const hasAudienceId = Boolean(audience.smartListId || audience.segmentId || audience.listId);
  if (directCount > 0 && !hasAudienceId) {
    return { count: directCount, isDirect: true };
  }
  return {
    count: selectedSmartList?.contactCount ?? selectedSmartList?._count?.items ?? 'All',
    isDirect: false,
  };
}
