// Phase 2 (AI Agent) — agent service turn loop.
// Runs beside POST /api/ai/chat: same SSE contract, same tool pass shape,
// but every function call goes through the mode gate matrix (tools.ts)
// instead of the old route's static approval set. The route owns SSE
// framing; this module owns decisions. It throws on LLM/key failure and
// the route turns that into the honest error chunk (never a crash).
import { db } from '../../../infrastructure/database/client.js';
import { getAIClient, DEFAULT_MODEL } from '../../../packages/ai/client.js';
import { CRM_TOOLS, buildCleanContents } from '../../routes/ai.routes.js';
import { executeTool, getActionLabel } from '../../routes/ai-executor.js';
import { decideGate, getToolDef, verifyWriteReferences, type AgentMode } from './tools.js';
import {
  getAgentSettings,
  setAgentSettings,
  listGrantedToolNames,
  writeAudit,
  parseModeSwitch,
} from './modes.js';
import {
  getOrCreateConversation,
  appendMessage,
  getConversationHistory,
} from './conversations.js';
import {
  parseRememberCommand,
  parseCorrection,
  createMemory,
  listMemories,
  formatMemoriesForPrompt,
} from './memories.js';

export interface TurnCallbacks {
  onText: (text: string) => void;
  onProposal: (action: unknown) => void;
  onConversation?: (id: string) => void;
}

export interface TurnInput {
  workspaceId: string;
  userId: string;
  message: string;
  route?: string;
  history?: { role: string; content: string }[];
  conversationId?: string;
}

export interface TurnResult {
  conversationId: string | null;
  mode: AgentMode;
  agentName: string;
  queuedTools: string[];
  executedTools: string[];
  text: string;
}

const MODE_LINES: Record<AgentMode, string> = {
  approve:
    'You are in approve mode: state your plan in chat, then do exactly what the user approves and nothing more. Every mutating or outbound action waits for approval.',
  autonomy:
    'You are in autonomy mode: do your granted things on your own and always say clearly what you are doing on your own versus what is new. A new kind of thing needs approval once before it joins the granted set. Sending email/SMS, publishing, money, deletes, and bulk export ALWAYS need the user\'s exact approval first, even in autonomy mode.',
  'read-only':
    'You are in read-only mode: you can see everything and draft anything, but you must not change anything on your own. Every change is a proposal that needs the user\'s explicit approval.',
};

const SWITCH_CONFIRMATIONS: Record<AgentMode, string> = {
  approve:
    'Switched to approve mode. I\'ll tell you what I plan to do in chat and only do exactly what you approve.',
  autonomy:
    'Switched to autonomy mode. I\'ll do the things you\'ve granted me on my own and tell you clearly what I\'m doing versus what\'s new. Sends, posts, money, deletes, and exports still need your exact approval every time.',
  'read-only':
    'Switched to read-only mode. I can see everything and draft anything, but I won\'t change anything on my own — every change needs your explicit approval.',
};

export async function runAgentTurn(input: TurnInput, cb: TurnCallbacks): Promise<TurnResult> {
  const { workspaceId, userId, message } = input;

  // 1. Mode switch — handled before any LLM call, so it works with no key.
  const switched = parseModeSwitch(message);
  if (switched) {
    const settings = await setAgentSettings(db, workspaceId, { mode: switched });
    const text = SWITCH_CONFIRMATIONS[switched];
    let conversationId: string | null = null;
    if (input.conversationId) {
      const conv = await getOrCreateConversation(db, workspaceId, userId, input.conversationId);
      conversationId = conv.id;
      cb.onConversation?.(conv.id);
      await appendMessage(db, conv.id, 'user', message);
      await appendMessage(db, conv.id, 'model', text);
    }
    cb.onText(text);
    return { conversationId, mode: settings.mode, agentName: settings.name, queuedTools: [], executedTools: [], text };
  }

  // 1b. Remember command — terminal, no LLM call, works with no key.
  const remembered = parseRememberCommand(message);
  if (remembered) {
    const settings = await getAgentSettings(db, workspaceId);
    const saved = await createMemory(db, workspaceId, userId, 'fact', remembered);
    const text = `Remembered: ${saved.content}.`;
    let conversationId: string | null = null;
    if (input.conversationId) {
      const conv = await getOrCreateConversation(db, workspaceId, userId, input.conversationId);
      conversationId = conv.id;
      cb.onConversation?.(conv.id);
      await appendMessage(db, conv.id, 'user', message);
      await appendMessage(db, conv.id, 'model', text);
    }
    cb.onText(text);
    return { conversationId, mode: settings.mode, agentName: settings.name, queuedTools: [], executedTools: [], text };
  }

  // 2. Settings + grants for this turn.
  const settings = await getAgentSettings(db, workspaceId);
  const granted = await listGrantedToolNames(db, workspaceId);

  // 2b. Correction capture (Phase 3): record the distilled correction,
  // then continue the turn. Non-fatal — a memory failure never blocks
  // the answer.
  const correction = parseCorrection(message);
  if (correction) {
    try {
      await createMemory(db, workspaceId, userId, 'correction', correction);
    } catch (memErr: any) {
      console.error('[Agent] correction memory failed (non-fatal):', memErr.message);
    }
  }

  // 3. Conversation + history (persisted path) or stateless history (harness path).
  let conversationId: string | null = null;
  let history = input.history ?? [];
  if (input.conversationId) {
    const conv = await getOrCreateConversation(db, workspaceId, userId, input.conversationId);
    conversationId = conv.id;
    cb.onConversation?.(conv.id);
    history = await getConversationHistory(db, workspaceId, conv.id);
    await appendMessage(db, conv.id, 'user', message);
  }

  const contents = buildCleanContents(history, message);
  // 2c. Memory injection (Phase 3): corrections first, capped. Only the
  // count is logged, never memory content.
  const memories = await listMemories(db, workspaceId);
  console.info(`[Agent] Injected ${Math.min(memories.length, 50)} memories for workspace ${workspaceId}`);
  const memoryBlock = formatMemoriesForPrompt(memories);
  const systemInstruction =
    `You are ${settings.name} — the intelligent copilot and autonomous workspace manager for Stone AIO. ` +
    (input.route ? `User is currently viewing page: ${input.route}. ` : '') +
    'You have direct live access to tools to manage contacts, deals, tasks, notes, messages (email/SMS), and email campaigns in the CRM. ' +
    'When the user asks you to view, find, search, create, update, or send anything in the CRM, ALWAYS call your tools to execute the action. ' +
    'Be helpful, dynamic, unique, and action-oriented. Format your responses with markdown, headers, and bulleted lists. ' +
    MODE_LINES[settings.mode] +
    (memoryBlock ? `\n\n${memoryBlock}` : '');

  const ai = getAIClient();
  let fullText = '';
  const emit = (t: string) => {
    fullText += t;
    cb.onText(t);
  };
  const queuedTools: string[] = [];
  const executedTools: string[] = [];

  // 4. Tool pass (same fallback shape as the old route).
  let firstRes: any = null;
  try {
    firstRes = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: CRM_TOOLS as any }],
        temperature: 0.5,
      },
    });
  } catch (toolErr: any) {
    console.warn('[Agent] Tool pass failed, falling back to direct stream:', toolErr.message);
  }

  const functionCalls = firstRes?.functionCalls;
  if (functionCalls && functionCalls.length > 0) {
    const toolResults: any[] = [];
    for (const call of functionCalls) {
      if (!call.name) continue;
      const def = getToolDef(call.name);
      if (!def) {
        toolResults.push({ name: call.name, result: { error: `Unknown tool ${call.name}` } });
        continue;
      }
      const args = call.args ?? {};
      // Ownership first: a foreign reference never reaches the queue or execution.
      const refErr = await verifyWriteReferences(db, workspaceId, args);
      if (refErr) {
        toolResults.push({ name: call.name, result: { error: refErr } });
        continue;
      }
      const decision = decideGate(settings.mode, call.name, granted);
      if (decision === 'queue') {
        const label = getActionLabel(call.name, args);
        const queued = await (db as any).aIAction.create({
          data: {
            workspaceId,
            toolName: call.name,
            args,
            label,
            status: 'pending',
            chatContext: message,
          },
        });
        emit(
          `\n> ⏳ **Action queued for your approval:** *${label}*\n> Approve or reject it in the approvals section below, or in the **AI Control Panel** on your Dashboard.\n\n`,
        );
        cb.onProposal(queued);
        queuedTools.push(call.name);
        toolResults.push({ name: call.name, result: { queued: true, actionId: queued.id, label } });
      } else {
        emit(`*Executing: \`${call.name}\`...*\n\n`);
        try {
          const result = await executeTool(workspaceId, call.name, args, userId);
          await writeAudit(db, {
            workspaceId,
            userId,
            toolName: call.name,
            args,
            result,
            mode: settings.mode,
            granted: settings.mode === 'autonomy' && granted.has(call.name),
          });
          executedTools.push(call.name);
          toolResults.push({ name: call.name, result });
        } catch (err: any) {
          toolResults.push({ name: call.name, error: err.message });
        }
      }
    }

    const candidateContent = firstRes.candidates?.[0]?.content;
    if (candidateContent) {
      contents.push(candidateContent);
    } else {
      contents.push({
        role: 'model',
        parts: functionCalls.map((call: any) => ({ functionCall: call })),
      });
    }
    contents.push({
      role: 'user',
      parts: toolResults.map((tr) => ({
        functionResponse: {
          name: tr.name,
          response: { output: tr.result || tr.error },
        },
      })),
    });

    const stream = await ai.models.generateContentStream({
      model: DEFAULT_MODEL,
      contents,
      config: { systemInstruction, temperature: 0.7 },
    });
    for await (const chunk of stream) {
      if (chunk.text) emit(chunk.text);
    }
  } else {
    const stream = await ai.models.generateContentStream({
      model: DEFAULT_MODEL,
      contents,
      config: { systemInstruction, temperature: 0.7 },
    });
    for await (const chunk of stream) {
      if (chunk.text) emit(chunk.text);
    }
  }

  if (conversationId) {
    await appendMessage(db, conversationId, 'model', fullText);
  }
  return {
    conversationId,
    mode: settings.mode,
    agentName: settings.name,
    queuedTools,
    executedTools,
    text: fullText,
  };
}
