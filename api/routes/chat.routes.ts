import { Router } from 'express';
import { Type } from '@google/genai';
import { db } from '../../infrastructure/database/client.js';
import { tryGetAIClient } from '../../packages/ai/client.js';

const router = Router();
const ai = tryGetAIClient();

router.get('/', async (req, res) => {
  try {
    const agents = await db.agent.findMany({
      where: { workspaceId: req.workspaceId, type: 'assistant' },
    });
    res.json(agents.map((a) => ({ id: a.id, title: a.name, updatedAt: a.updatedAt })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const messages = await db.agentMessage.findMany({
      where: { agentId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.post('/', async (req, res) => {
  try {
    const agent = await db.agent.create({
      data: { workspaceId: req.workspaceId, name: 'New Conversation', type: 'assistant', config: '{}' },
    });
    res.json({ id: agent.id, title: agent.name });
  } catch {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.post('/:id/messages', async (req, res) => {
  const { message } = req.body;
  const conversationId = req.params.id;

  if (!ai) {
    return res.status(500).json({ error: 'GOOGLE_AI_API_KEY is not configured on the server.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    await db.agentMessage.create({
      data: { agentId: conversationId, userId: req.userId || 'system', role: 'user', content: message },
    });

    const rawHistory = await db.agentMessage.findMany({
      where: { agentId: conversationId },
      orderBy: { createdAt: 'asc' },
    });

    const history: any[] = rawHistory.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }],
    }));
    history.forEach((h) => {
      if (h.role !== 'user' && h.role !== 'model') h.role = 'user';
    });

    const geminiTools: any[] = [{
      functionDeclarations: [
        {
          name: 'get_contacts',
          description: 'Search for CRM contacts by name or return all if no query is provided.',
          parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: 'Name to search for' } } },
        },
        {
          name: 'create_deal',
          description: 'Create a new deal in the CRM pipeline.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Name of the deal' },
              amount: { type: Type.NUMBER, description: 'Deal value' },
              companyName: { type: Type.STRING, description: 'Company name' },
            },
            required: ['title', 'amount'],
          },
        },
      ],
    }];

    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: history,
      config: {
        tools: geminiTools,
        systemInstruction: 'You are the Stone AIO Assistant. You have tools available to manage the CRM. When asked to create a deal or search contacts, you MUST use the provided tools instead of making up a response. Do not hallucinate or simulate actions. ALWAYS Call the tool.',
      },
    });

    let functionCalls: any[] = [];
    let fullResponseText = '';

    for await (const chunk of stream) {
      if (chunk.text) {
        fullResponseText += chunk.text;
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
      if (chunk.functionCalls) functionCalls.push(...chunk.functionCalls);
    }

    if (functionCalls.length > 0) {
      for (const call of functionCalls) {
        try {
          if (call.name === 'get_contacts') {
            const query = call.args?.query as string;
            const contacts = await db.contact.findMany({
              where: query ? { workspaceId: req.workspaceId, firstName: { contains: query } } : { workspaceId: req.workspaceId },
              take: 5,
            });
            const resultText = `\n\n*Executed tool: ${call.name}* - Found ${contacts.length} contacts.`;
            fullResponseText += resultText;
            res.write(`data: ${JSON.stringify({ text: resultText })}\n\n`);
          } else if (call.name === 'create_deal') {
            const title = call.args?.title as string;
            const amount = Number(call.args?.amount) || 0;
            await db.deal.create({ data: { workspaceId: req.workspaceId, title, amount, description: 'Created by AI Assistant' } });
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

    if (fullResponseText.trim()) {
      await db.agentMessage.create({
        data: { agentId: conversationId, userId: req.userId || 'system', role: 'assistant', content: fullResponseText },
      });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Chat AI stream error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Stream failed' })}\n\n`);
    res.end();
  }
});

export default router;
