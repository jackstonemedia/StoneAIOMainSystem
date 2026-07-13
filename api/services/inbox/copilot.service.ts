import { db } from '../../../infrastructure/database/client.js';

export class CopilotService {
  /**
   * Generates a draft reply for an agent based on the conversation history.
   */
  async generateDraftReply(conversationId: string, workspaceId: string): Promise<string> {
    // 1. Fetch conversation and history
    const conversation = await db.inboxConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20 // Get last 20 messages for context
        },
        inboxContact: true,
      }
    });

    if (!conversation) throw new Error('Conversation not found');
    if (conversation.workspaceId !== workspaceId) throw new Error('Unauthorized');

    // 2. Call the AI model
    // Note: In a real environment, you'd use your actual LLM wrapper here.
    // We'll mock the actual API call for now but structure it properly.
    
    /*
    const { text } = await generateText({
      model: openai('gpt-4-turbo'),
      system: `You are a helpful, professional customer support agent. 
               Draft a reply to the customer's last message based on the history. 
               Do not include placeholders like [Your Name]. Just the raw message.`,
      prompt: historyText,
    });
    return text;
    */

    // Mock response for the UI until API keys are provided
    return `Hi ${conversation.inboxContact?.name || 'there'},\n\nI understand you need help with this. Let me look into that for you right away.\n\nBest,\nSupport Team`;
  }

  /**
   * Summarizes a long conversation thread into 2-3 sentences.
   */
  async summarizeConversation(conversationId: string, workspaceId: string): Promise<string> {
    const conversation = await db.inboxConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      }
    });

    if (!conversation) throw new Error('Conversation not found');
    if (conversation.workspaceId !== workspaceId) throw new Error('Unauthorized');

    // Return a mock summary
    return "The customer reached out about a billing issue. The agent requested their account number to proceed with a refund.";
  }
}

export const copilotService = new CopilotService();
