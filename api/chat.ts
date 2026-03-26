import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../src/lib/db';

const router = Router();

// Ensure API key is available
const apiKey = process.env.GOOGLE_AI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Mock user config (To be replaced by Clerk Auth via headers in production)
const MOCK_USER_ID = 'user_123';
const MOCK_WORKSPACE_ID = 'workspace_123';

/**
 * GET /api/conversations
 * List user's conversations (simulated conversation objects tied to agents)
 */
router.get('/', async (req, res) => {
  try {
    const agents = await db.agent.findMany({
      where: { workspaceId: MOCK_WORKSPACE_ID, type: 'assistant' }
    });
    res.json(agents.map(a => ({ id: a.id, title: a.name, updatedAt: a.updatedAt })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/conversations/:id
 * Get full message history for a conversation
 */
router.get('/:id', async (req, res) => {
  try {
    const messages = await db.agentMessage.findMany({
      where: { agentId: req.params.id },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation (agent)
 */
router.post('/', async (req, res) => {
  try {
    const agent = await db.agent.create({
      data: {
        workspaceId: MOCK_WORKSPACE_ID,
        name: 'New Conversation',
        type: 'assistant',
        config: {}
      }
    });
    res.json({ id: agent.id, title: agent.name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Send a message and stream the response via SSE
 */
router.post('/:id/messages', async (req, res) => {
  const { message } = req.body;
  const conversationId = req.params.id; // Corresponds to agent.id

  if (!ai) {
    return res.status(500).json({ error: 'GOOGLE_AI_API_KEY is not configured on the server.' });
  }

  // Setup Server-Sent Events (SSE) headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    // 1. Save user message to DB
    await db.agentMessage.create({
      data: {
        agentId: conversationId,
        userId: MOCK_USER_ID,
        role: 'user',
        content: message
      }
    });

    // 2. Fetch history
    const rawHistory = await db.agentMessage.findMany({
      where: { agentId: conversationId },
      orderBy: { createdAt: 'asc' }
    });

    const history: any[] = rawHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role, // GenAI uses 'model' instead of 'assistant' sometimes, or 'assistant'. Wait, it expects 'user' and 'model'
      parts: [{ text: msg.content }]
    }));

    // GenAI SDK strictly enforces roles 'user' and 'model'
    history.forEach(h => {
      if (h.role === 'assistant') h.role = 'model';
      // System messages unsupported in history array for Gemini 2.5, must be in config.
      if (h.role !== 'user' && h.role !== 'model') h.role = 'user'; 
    });

    // 4. Define Tools (Functions the AI can call)
    const geminiTools = [{
      functionDeclarations: [
        {
          name: 'get_contacts',
          description: 'Search for CRM contacts by name or return all if no query is provided.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              query: { type: Type.STRING, description: 'Name to search for' }
            }
          }
        },
        {
          name: 'create_deal',
          description: 'Create a new deal in the CRM pipeline.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Name of the deal' },
              amount: { type: Type.NUMBER, description: 'Deal value' },
              companyName: { type: Type.STRING, description: 'Company name' }
            },
            required: ['title', 'amount']
          }
        }
      ]
    }];

    // 5. Call Gemini Streaming API
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: history,
      config: {
        tools: geminiTools,
        systemInstruction: "You are the Stone AIO Assistant. You have tools available to manage the CRM. When asked to create a deal or search contacts, you MUST use the provided tools instead of making up a response. Do not hallucinate or simulate actions. ALWAYS Call the tool."
      }
    });

    // 6. Stream chunks to client and handle optional tool calls
    let functionCalls: any[] = [];
    let fullResponseText = "";
    
    for await (const chunk of stream) {
      if (chunk.text) {
        fullResponseText += chunk.text;
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
      if (chunk.functionCalls) {
        functionCalls.push(...chunk.functionCalls);
      }
    }

    // 7. Execute tools if the model requested them
    if (functionCalls.length > 0) {
      for (const call of functionCalls) {
        try {
          if (call.name === 'get_contacts') {
            const query = call.args?.query as string;
            const contacts = await db.contact.findMany({
              where: query ? { workspaceId: MOCK_WORKSPACE_ID, firstName: { contains: query, mode: 'insensitive' } } : { workspaceId: MOCK_WORKSPACE_ID },
              take: 5
            });
            const resultText = `\n\n*Executed tool: ${call.name}* - Found ${contacts.length} contacts.`;
            fullResponseText += resultText;
            res.write(`data: ${JSON.stringify({ text: resultText })}\n\n`);
          } else if (call.name === 'create_deal') {
            const title = call.args?.title as string;
            const amount = Number(call.args?.amount) || 0;
            
            await db.deal.create({
              data: {
                workspaceId: MOCK_WORKSPACE_ID,
                title,
                amount,
                stage: 'lead',
                description: 'Created by AI Assistant'
              }
            });

            const resultText = `\n\n*Executed tool: ${call.name} - Created deal: ${title} for $${amount}*`;
            fullResponseText += resultText;
            res.write(`data: ${JSON.stringify({ text: resultText })}\n\n`);
          }
        } catch (toolErr) {
          console.error('Tool execution failed:', toolErr);
          const errorText = `\n\n*Failed to execute tool ${call.name}*`;
          fullResponseText += errorText;
          res.write(`data: ${JSON.stringify({ text: errorText })}\n\n`);
        }
      }
    }

    // 8. Save assistant response to DB
    if (fullResponseText.trim()) {
      await db.agentMessage.create({
        data: {
          agentId: conversationId,
          userId: MOCK_USER_ID,
          role: 'assistant',
          content: fullResponseText
        }
      });
    }

    // 9. Signal end of stream
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error: any) {
    console.error('Chat AI stream error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Stream failed' })}\n\n`);
    res.end();
  }
});

export default router;
