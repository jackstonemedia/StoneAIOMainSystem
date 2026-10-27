import { db } from '../../infrastructure/database/client.js';
import { getAIClient, DEFAULT_MODEL, SUMMARY_MODEL } from '../../packages/ai/client.js';

// Conversations-module copilot (Phase 0). This is a SEPARATE domain from the
// Inbox copilot: it reads Conversation/ConversationMessage rows, not
// InboxConversation rows. Real Gemini calls only — getAIClient() throws when
// GOOGLE_AI_API_KEY is missing, and that honest failure is surfaced, never
// replaced with canned text.

function historyText(messages: { sender: string; direction: string; body: string }[]): string {
  return messages.map((m) => `${m.direction} (${m.sender}): ${m.body}`).join('\n');
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

async function loadConversation(conversationId: string, workspaceId: string) {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 20,
      },
      contact: true,
    },
  });

  if (!conversation) throw new Error('Conversation not found');
  if (conversation.workspaceId !== workspaceId) throw new Error('Unauthorized');
  return conversation;
}

export class ConversationCopilotService {
  async generateDraftReply(conversationId: string, workspaceId: string): Promise<string> {
    const conversation = await loadConversation(conversationId, workspaceId);
    const history = historyText(conversation.messages);
    const name = conversation.contact
      ? `${conversation.contact.firstName ?? ''} ${conversation.contact.lastName ?? ''}`.trim()
      : 'there';
    return generate(
      `Draft a reply to ${name}'s last message based on this conversation history. Do not include placeholders like [Your Name]. Just the raw message.\n\n${history}`,
      'You are a helpful, professional customer support agent.',
      DEFAULT_MODEL,
    );
  }

  async summarizeConversation(conversationId: string, workspaceId: string): Promise<string> {
    const conversation = await loadConversation(conversationId, workspaceId);
    const history = historyText(conversation.messages);
    return generate(
      `Summarize this conversation thread into 2-3 sentences, covering only what actually happened in it.\n\n${history}`,
      'You are a helpful, professional customer support agent.',
      SUMMARY_MODEL,
    );
  }

  async extractActionItems(conversationId: string, workspaceId: string): Promise<string> {
    const conversation = await loadConversation(conversationId, workspaceId);
    const history = historyText(conversation.messages);
    return generate(
      `Extract the concrete action items from this conversation thread as a short numbered list. Only list actions actually implied by the thread; if there are none, say so.\n\n${history}`,
      'You are a helpful, professional customer support agent.',
      DEFAULT_MODEL,
    );
  }
}

export const conversationCopilotService = new ConversationCopilotService();
