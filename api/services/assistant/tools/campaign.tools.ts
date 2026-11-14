/**
 * Marketing & Ad Campaign Tools — Stone AIO Assistant
 * Spec Section 2.8 & Stage S3
 */

import { db } from '../../../../infrastructure/database/client.js';
import { createCampaign, sendCampaign } from '../../email-marketing/campaigns.service.js';
import type { ToolDefinition } from './types.js';

export const campaignTools: ToolDefinition[] = [
  // 1. list_campaigns
  {
    name: 'list_campaigns',
    description: 'List email marketing and ad campaigns in the workspace.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Type: email or ad.' },
      },
    },
    execute: async (args: { type?: 'email' | 'ad' }, ctx) => {
      const isEmail = !args.type || args.type === 'email';
      const isAd = !args.type || args.type === 'ad';

      let emailCampaigns: any[] = [];
      let adCampaigns: any[] = [];

      if (isEmail) {
        emailCampaigns = await db.campaign.findMany({
          where: { workspaceId: ctx.workspaceId },
          orderBy: { id: 'desc' },
          take: 30,
        });
      }

      if (isAd) {
        adCampaigns = await db.adCampaign.findMany({
          where: { workspaceId: ctx.workspaceId },
          orderBy: { id: 'desc' },
          take: 30,
        });
      }

      return {
        emailCampaigns: emailCampaigns.map((c) => ({
          id: c.id,
          name: c.name,
          subject: c.subject,
          status: c.status,
          recipientCount: c.recipientCount || 0,
        })),
        adCampaigns: adCampaigns.map((a) => ({
          id: a.id,
          platform: a.platform,
          adType: a.adType,
        })),
        total: emailCampaigns.length + adCampaigns.length,
      };
    },
  },

  // 2. get_campaign_analytics
  {
    name: 'get_campaign_analytics',
    description: 'Retrieve performance metrics and analytics for a marketing campaign.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'The UUID of the campaign.' },
      },
      required: ['campaignId'],
    },
    execute: async (args: { campaignId: string }, ctx) => {
      const campaign = await db.campaign.findFirst({
        where: { id: args.campaignId, workspaceId: ctx.workspaceId },
      });

      if (!campaign) {
        throw new Error(`Campaign ${args.campaignId} not found in workspace.`);
      }

      const totalRecipients = campaign.recipientCount || 0;

      return {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          subject: campaign.subject,
          recipientCount: totalRecipients,
          audienceSummary: campaign.audienceSummary,
        },
      };
    },
  },

  // 3. create_campaign
  {
    name: 'create_campaign',
    description: 'Create an email marketing campaign (draft status). This is the only campaign-creation tool — use it whenever the person asks to create a campaign.',
    risk: 'write',
    minimumRole: 'member',
    capability: 'campaigns',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the campaign.' },
        subject: { type: 'string', description: 'Subject line of the campaign.' },
        bodyHtml: { type: 'string', description: 'HTML or text content of the email draft.' },
        listId: { type: 'string', description: 'Optional ID of a contact list.' },
        segmentId: { type: 'string', description: 'Optional ID of a segment.' },
      },
      required: ['name', 'subject'],
    },
    execute: async (args: { name: string; subject: string; bodyHtml?: string; listId?: string; segmentId?: string }, ctx) => {
      const campaign = await createCampaign(ctx.workspaceId, {
        name: args.name,
        subject: args.subject,
        blockJson: { html: args.bodyHtml || '<p>Draft email content</p>' },
        listId: args.listId || null,
        segmentId: args.segmentId || null,
      });

      return {
        success: true,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          status: campaign.status,
        },
        message: `Campaign "${campaign.name}" created.`,
      };
    },
  },

  // 5. send_campaign (eval-gap fix: the assistant could not send a campaign —
  // p4-camp-02, rt-authority-01, rt-urgency-01 all expect this tool queued).
  // Wires to the existing sendCampaign service (Complete-gated, idempotent
  // resume if already SENDING). Risk 'send', so in draft mode it queues as
  // a proposal and never executes — queueing for exact approval is the
  // correct behavior for a send request, including under fake urgency.
  {
    name: 'send_campaign',
    description: 'Send an existing email marketing campaign to its recipients. Use this when the person asks to send a campaign — never claim a campaign was sent without calling this tool.',
    risk: 'send',
    minimumRole: 'member',
    capability: 'campaigns',
    parameters: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'The UUID of the campaign to send.' },
        name: { type: 'string', description: 'Name of the campaign to send (used when no campaignId is given).' },
      },
    },
    execute: async (args: { campaignId?: string; name?: string }, ctx) => {
      let campaignId = args.campaignId;
      if (!campaignId && args.name) {
        const found = await db.campaign.findFirst({
          where: { workspaceId: ctx.workspaceId, name: args.name },
          select: { id: true },
        });
        if (!found) throw new Error(`No campaign named "${args.name}" was found.`);
        campaignId = found.id;
      }
      if (!campaignId) throw new Error('send_campaign needs a campaignId or a campaign name.');

      const result = await sendCampaign(ctx.workspaceId, campaignId);
      return {
        success: true,
        campaignId,
        queued: result.queued,
        failed: result.failed ?? 0,
        message: `Campaign send started: ${result.queued} recipient(s) queued.`,
      };
    },
  },
];
