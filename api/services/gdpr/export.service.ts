/**
 * GDPR workspace export — complete-platform item 5.
 *
 * The registry below was generated from prisma/schema.prisma (2026-11-19):
 * every model with a `workspaceId` relation (89 direct tables) plus every
 * child model that hangs off a workspace-scoped parent (26 child tables,
 * fetched by the parent ids). If a new workspace-scoped model is added to
 * the schema and not to this registry, the export's `missingTables` check
 * in the test will fail — the registry must be updated with the model.
 *
 * NEVER exported (credentials, not data): WorkspaceInvite.token,
 * Integration access/refresh tokens, ChannelConnection.credentialsJson,
 * WebhookEndpoint/WorkflowWebhook secrets, AdAccount tokens,
 * InboxChannel.embedToken, WorkflowCredential.dataEncrypted.
 */
import { db } from '../../../infrastructure/database/client.js';

export interface ExportTable {
  /** Key in the export's `data` object (the Prisma delegate name). */
  key: string;
  /** Prisma delegate on `db`, e.g. `contact`. */
  delegate: string;
  /** Fields stripped from every row before it leaves the server. */
  omit?: string[];
}

export const EXPORT_DIRECT_TABLES: ExportTable[] = [
  { key: 'aIAction', delegate: 'aIAction' },
  { key: 'agentAutonomyGrant', delegate: 'agentAutonomyGrant' },
  { key: 'agentConversation', delegate: 'agentConversation' },
  { key: 'agentAuditLog', delegate: 'agentAuditLog' },
  { key: 'agentMemory', delegate: 'agentMemory' },
  { key: 'agentTokenUsage', delegate: 'agentTokenUsage' },
  { key: 'inboxChannel', delegate: 'inboxChannel', omit: ["embedToken"] },
  { key: 'inboxLabel', delegate: 'inboxLabel' },
  { key: 'inboxTeam', delegate: 'inboxTeam' },
  { key: 'cannedResponse', delegate: 'cannedResponse' },
  { key: 'inboxContact', delegate: 'inboxContact' },
  { key: 'inboxConversation', delegate: 'inboxConversation' },
  { key: 'inboxAgentSignature', delegate: 'inboxAgentSignature' },
  { key: 'workspaceMember', delegate: 'workspaceMember' },
  { key: 'workspaceInvite', delegate: 'workspaceInvite', omit: ["token"] },
  { key: 'agent', delegate: 'agent' },
  { key: 'contact', delegate: 'contact' },
  { key: 'company', delegate: 'company' },
  { key: 'deal', delegate: 'deal' },
  { key: 'task', delegate: 'task' },
  { key: 'integration', delegate: 'integration', omit: ["accessToken", "refreshToken"] },
  { key: 'channelConnection', delegate: 'channelConnection', omit: ["credentialsJson"] },
  { key: 'appointment', delegate: 'appointment' },
  { key: 'conversation', delegate: 'conversation' },
  { key: 'crmDocument', delegate: 'crmDocument' },
  { key: 'crmSettings', delegate: 'crmSettings' },
  { key: 'bulkAction', delegate: 'bulkAction' },
  { key: 'pipeline', delegate: 'pipeline' },
  { key: 'smartList', delegate: 'smartList' },
  { key: 'notification', delegate: 'notification' },
  { key: 'notificationPreference', delegate: 'notificationPreference' },
  { key: 'customField', delegate: 'customField' },
  { key: 'tag', delegate: 'tag' },
  { key: 'wonLostReason', delegate: 'wonLostReason' },
  { key: 'opportunityActivityLog', delegate: 'opportunityActivityLog' },
  { key: 'opportunitySavedView', delegate: 'opportunitySavedView' },
  { key: 'webhookEndpoint', delegate: 'webhookEndpoint', omit: ["secret"] },
  { key: 'attachment', delegate: 'attachment' },
  { key: 'workflow', delegate: 'workflow' },
  { key: 'workflowRun', delegate: 'workflowRun' },
  { key: 'automationFolder', delegate: 'automationFolder' },
  { key: 'automationTable', delegate: 'automationTable' },
  { key: 'release', delegate: 'release' },
  { key: 'workflowCredential', delegate: 'workflowCredential', omit: ["dataEncrypted"] },
  { key: 'workflowSchedule', delegate: 'workflowSchedule' },
  { key: 'workflowWebhook', delegate: 'workflowWebhook', omit: ["secret"] },
  { key: 'crmTriggerSubscription', delegate: 'crmTriggerSubscription' },
  { key: 'adAccount', delegate: 'adAccount', omit: ["accessToken", "refreshToken"] },
  { key: 'adCampaign', delegate: 'adCampaign' },
  { key: 'adLead', delegate: 'adLead' },
  { key: 'adWorkspaceSettings', delegate: 'adWorkspaceSettings' },
  { key: 'leadGenerationJob', delegate: 'leadGenerationJob' },
  { key: 'lead', delegate: 'lead' },
  { key: 'userLeadHistory', delegate: 'userLeadHistory' },
  { key: 'dailyLeadQuota', delegate: 'dailyLeadQuota' },
  { key: 'helpCenterPortal', delegate: 'helpCenterPortal' },
  { key: 'contactSegment', delegate: 'contactSegment' },
  { key: 'inboxCampaign', delegate: 'inboxCampaign' },
  { key: 'emailList', delegate: 'emailList' },
  { key: 'contactListMembership', delegate: 'contactListMembership' },
  { key: 'segment', delegate: 'segment' },
  { key: 'emailTemplate', delegate: 'emailTemplate' },
  { key: 'campaign', delegate: 'campaign' },
  { key: 'automation', delegate: 'automation' },
  { key: 'automationEnrollment', delegate: 'automationEnrollment' },
  { key: 'emailEvent', delegate: 'emailEvent' },
  { key: 'suppressionEntry', delegate: 'suppressionEntry' },
  { key: 'autonomousSdrAgent', delegate: 'autonomousSdrAgent' },
  { key: 'sendingDomain', delegate: 'sendingDomain' },
  { key: 'businessProfile', delegate: 'businessProfile' },
  { key: 'campaignDraft', delegate: 'campaignDraft' },
  { key: 'reactionRule', delegate: 'reactionRule' },
  { key: 'campaignEmail', delegate: 'campaignEmail' },
  { key: 'recipientState', delegate: 'recipientState' },
  { key: 'assistantConversation', delegate: 'assistantConversation' },
  { key: 'assistantToolCall', delegate: 'assistantToolCall' },
  { key: 'assistantSettings', delegate: 'assistantSettings' },
  { key: 'assistantWorkspaceSettings', delegate: 'assistantWorkspaceSettings' },
  { key: 'assistantUsage', delegate: 'assistantUsage' },
  { key: 'assistantMemory', delegate: 'assistantMemory' },
  { key: 'assistantScheduledTask', delegate: 'assistantScheduledTask' },
  { key: 'assistantTaskRun', delegate: 'assistantTaskRun' },
  { key: 'assistantProject', delegate: 'assistantProject' },
  { key: 'landingPage', delegate: 'landingPage' },
  { key: 'landingPageView', delegate: 'landingPageView' },
  { key: 'formResponse', delegate: 'formResponse' },
  { key: 'funnel', delegate: 'funnel' },
  { key: 'funnelStep', delegate: 'funnelStep' },
  { key: 'funnelStepView', delegate: 'funnelStepView' },
];

export interface ExportChildTable extends ExportTable {
  /** Parent table key (must be a direct table). */
  parent: string;
  /** FK scalar on the child pointing at the parent. */
  fk: string;
}

export const EXPORT_CHILD_TABLES: ExportChildTable[] = [
  { key: 'agentConversationMessage', delegate: 'agentConversationMessage', parent: 'agentConversation', fk: 'conversationId' },
  { key: 'inboxChannelAgent', delegate: 'inboxChannelAgent', parent: 'inboxChannel', fk: 'inboxChannelId' },
  { key: 'inboxTeamMember', delegate: 'inboxTeamMember', parent: 'inboxTeam', fk: 'teamId' },
  { key: 'inboxMessage', delegate: 'inboxMessage', parent: 'inboxConversation', fk: 'conversationId' },
  { key: 'inboxConversationLabel', delegate: 'inboxConversationLabel', parent: 'inboxConversation', fk: 'conversationId' },
  { key: 'inboxConversationParticipant', delegate: 'inboxConversationParticipant', parent: 'inboxConversation', fk: 'conversationId' },
  { key: 'agentRun', delegate: 'agentRun', parent: 'agent', fk: 'agentId' },
  { key: 'conversationMessage', delegate: 'conversationMessage', parent: 'conversation', fk: 'conversationId' },
  { key: 'contactEvent', delegate: 'contactEvent', parent: 'contact', fk: 'contactId' },
  { key: 'companyEvent', delegate: 'companyEvent', parent: 'company', fk: 'companyId' },
  { key: 'pipelineStage', delegate: 'pipelineStage', parent: 'pipeline', fk: 'pipelineId' },
  { key: 'smartListItem', delegate: 'smartListItem', parent: 'smartList', fk: 'smartListId' },
  { key: 'opportunityLineItem', delegate: 'opportunityLineItem', parent: 'deal', fk: 'dealId' },
  { key: 'contactRelation', delegate: 'contactRelation', parent: 'contact', fk: 'sourceContactId' },
  { key: 'automationTableField', delegate: 'automationTableField', parent: 'automationTable', fk: 'tableId' },
  { key: 'automationTableRecord', delegate: 'automationTableRecord', parent: 'automationTable', fk: 'tableId' },
  { key: 'nativeWorkflowDefinition', delegate: 'nativeWorkflowDefinition', parent: 'workflow', fk: 'workflowId' },
  { key: 'adMetricSnapshot', delegate: 'adMetricSnapshot', parent: 'adCampaign', fk: 'campaignId' },
  { key: 'helpCenterCategory', delegate: 'helpCenterCategory', parent: 'helpCenterPortal', fk: 'portalId' },
  { key: 'helpCenterArticle', delegate: 'helpCenterArticle', parent: 'helpCenterPortal', fk: 'portalId' },
  { key: 'campaignRecipient', delegate: 'campaignRecipient', parent: 'campaign', fk: 'campaignId' },
  { key: 'sdrLeadDossier', delegate: 'sdrLeadDossier', parent: 'autonomousSdrAgent', fk: 'agentId' },
  { key: 'writingSample', delegate: 'writingSample', parent: 'businessProfile', fk: 'profileId' },
  { key: 'assistantMessage', delegate: 'assistantMessage', parent: 'assistantConversation', fk: 'conversationId' },
  { key: 'assistantProjectFile', delegate: 'assistantProjectFile', parent: 'assistantProject', fk: 'projectId' },
  { key: 'assistantProjectLink', delegate: 'assistantProjectLink', parent: 'assistantProject', fk: 'projectId' },
];

export interface WorkspaceExport {
  exportedAt: string;
  workspace: { id: string; name: string; plan: string };
  /** Row count per table key. */
  counts: Record<string, number>;
  totalRows: number;
  /** One array per table key. */
  data: Record<string, any[]>;
}

function stripRow(row: any, omit?: string[]): any {
  if (!omit || omit.length === 0) return row;
  const out: any = { ...row };
  for (const f of omit) delete out[f];
  return out;
}

/**
 * Builds the full workspace export: every workspace-scoped table (direct)
 * plus every child table (by parent ids). Dates serialize to ISO strings
 * via JSON.stringify; no BigInt/Decimal fields exist in the schema.
 * Secrets listed in the registry header are stripped before return.
 */
export async function buildWorkspaceExport(workspaceId: string): Promise<WorkspaceExport> {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new Error('Workspace not found');

  const data: Record<string, any[]> = {};
  const counts: Record<string, number> = {};
  const idsByKey: Record<string, string[]> = {};

  for (const table of EXPORT_DIRECT_TABLES) {
    const delegate: any = (db as any)[table.delegate];
    if (!delegate?.findMany) throw new Error(`Export registry: missing delegate db.${table.delegate}`);
    const rows = await delegate.findMany({ where: { workspaceId } });
    const clean = rows.map((r: any) => stripRow(r, table.omit));
    data[table.key] = clean;
    counts[table.key] = clean.length;
    idsByKey[table.key] = rows.map((r: any) => r.id).filter(Boolean);
  }

  for (const table of EXPORT_CHILD_TABLES) {
    const delegate: any = (db as any)[table.delegate];
    if (!delegate?.findMany) throw new Error(`Export registry: missing delegate db.${table.delegate}`);
    const parentIds = idsByKey[table.parent] ?? [];
    if (parentIds.length === 0) {
      data[table.key] = [];
      counts[table.key] = 0;
      continue;
    }
    const rows = await delegate.findMany({ where: { [table.fk]: { in: parentIds } } });
    const clean = rows.map((r: any) => stripRow(r, table.omit));
    data[table.key] = clean;
    counts[table.key] = clean.length;
  }

  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    exportedAt: new Date().toISOString(),
    workspace: { id: workspace.id, name: workspace.name, plan: workspace.plan },
    counts,
    totalRows,
    data,
  };
}
