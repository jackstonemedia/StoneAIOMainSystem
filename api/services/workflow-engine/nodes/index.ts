'use strict';

import { nodeRegistry } from '../node-runner.js';

// ── Trigger nodes ──────────────────────────────────────────────────────────────
import { triggerWebhook } from './trigger-webhook.js';
import { triggerSchedule } from './trigger-schedule.js';
import { triggerCrmEvent } from './trigger-crm-event.js';

// ── CRM nodes ──────────────────────────────────────────────────────────────────
import { crmCreateContact } from './crm-create-contact.js';
import { crmUpdateContact } from './crm-update-contact.js';
import { crmCreateDeal } from './crm-create-deal.js';
import { crmCreateTask } from './crm-create-task.js';

// ── Communication nodes ────────────────────────────────────────────────────────
import { communicationSendEmail } from './communication-send-email.js';
import { communicationSendSms } from './communication-send-sms.js';

// ── Logic nodes ────────────────────────────────────────────────────────────────
import { logicIfElse } from './logic-if-else.js';
import { logicWait } from './logic-wait.js';
import { logicTransform } from './logic-transform.js';
import { logicLoop } from './logic-loop.js';

// ── AI nodes ───────────────────────────────────────────────────────────────────
import { aiLlm } from './ai-llm.js';

// ── Data/Integration nodes ─────────────────────────────────────────────────────
import { integrationHttpRequest } from './integration-http-request.js';
import { integrationParseJson } from './integration-parse-json.js';

/**
 * Register all workflow node implementations into the NodeRegistry singleton.
 * Call this once during server startup, before executing any workflows.
 */
export function registerAllNodes(): void {
  // Triggers
  nodeRegistry.register(triggerWebhook);
  nodeRegistry.register(triggerSchedule);
  nodeRegistry.register(triggerCrmEvent);

  // CRM Actions
  nodeRegistry.register(crmCreateContact);
  nodeRegistry.register(crmUpdateContact);
  nodeRegistry.register(crmCreateDeal);
  nodeRegistry.register(crmCreateTask);

  // Communication
  nodeRegistry.register(communicationSendEmail);
  nodeRegistry.register(communicationSendSms);

  // Logic
  nodeRegistry.register(logicIfElse);
  nodeRegistry.register(logicWait);
  nodeRegistry.register(logicTransform);
  nodeRegistry.register(logicLoop);

  // AI
  nodeRegistry.register(aiLlm);

  // Integration / Data
  nodeRegistry.register(integrationHttpRequest);
  nodeRegistry.register(integrationParseJson);
}

/**
 * Convenience getter — returns the populated registry.
 * Use `nodeRegistry.getAll()` or `nodeRegistry.getByCategory()` for introspection.
 */
export { nodeRegistry };
