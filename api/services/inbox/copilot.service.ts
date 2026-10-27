import { db } from '../../../infrastructure/database/client.js';
import { getAIClient, DEFAULT_MODEL, SUMMARY_MODEL } from '../../../packages/ai/client.js';

// Phase 0: real Gemini calls. getAIClient() throws when GOOGLE_AI_API_KEY is
// missing — that honest failure replaces the old hardcoded mock replies. No
// mock text is ever returned from this service.

function historyText(messages: { senderType: string; content: string }[]): string {
  return messages.map((m) => `${m.senderType}: ${m.content}`).join('\n');
}

async function generate(prompt: string, systemInstruction: string, model: string): Promise<string> {
  const ai = getAIClient();
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { systemInstruction, temperature: 0.7 },
  });
  return res.text ?? '';
}

async function loadConversation(conversationId: string, workspaceId: string, take?: number) {
  const conversation = await db.inboxConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        ...(take ? { take } : {}),
      },
      inboxContact: true,
    },
  });

  if (!conversation) throw new Error('Conversation not found');
  if (conversation.workspaceId !== workspaceId) throw new Error('Unauthorized');
  return conversation;
}

export class CopilotService {
  /**
   * Generates a draft reply for an agent based on the conversation history.
   */
  async generateDraftReply(conversationId: string, workspaceId: string): Promise<string> {
    const conversation = await loadConversation(conversationId, workspaceId, 20);
    const history = historyText(conversation.messages);
    return generate(
      `Draft a reply to the customer's last message based on this conversation history. Do not include placeholders like [Your Name]. Just the raw message.\n\n${history}`,
      'You are a helpful, professional customer support agent.',
      DEFAULT_MODEL,
    );
  }

  /**
   * Summarizes a long conversation thread into 2-3 sentences.
   */
  async summarizeConversation(conversationId: string, workspaceId: string): Promise<string> {
    const conversation = await loadConversation(conversationId, workspaceId);
    const history = historyText(conversation.messages);
    return generate(
      `Summarize this conversation thread into 2-3 sentences, covering only what actually happened in it.\n\n${history}`,
      'You are a helpful, professional customer support agent.',
      SUMMARY_MODEL,
    );
  }

  /**
   * Extracts action items from a conversation thread as a short list.
   */
  async extractActionItems(conversationId: string, workspaceId: string): Promise<string> {
    const conversation = await loadConversation(conversationId, workspaceId, 20);
    const history = historyText(conversation.messages);
    return generate(
      `Extract the concrete action items from this conversation thread as a short numbered list. Only list actions actually implied by the thread; if there are none, say so.\n\n${history}`,
      'You are a helpful, professional customer support agent.',
      DEFAULT_MODEL,
    );
  }
}

export const copilotService = new CopilotService();
