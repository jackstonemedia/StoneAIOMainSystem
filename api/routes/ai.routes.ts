/**
 * AI Routes — Stone AIO
 *
 * Unified Gemini-powered AI endpoints for the whole platform.
 * All calls proxy securely through the backend — API key never leaves the server.
 *
 * Routes:
 *   POST /api/ai/chat              — General copilot chat with full CRM tool execution
 *   POST /api/ai/email/generate    — Write a full campaign email from a prompt
 *   POST /api/ai/email/improve     — Improve subject line or body copy
 *   POST /api/ai/email/subject     — Generate subject line ideas
 *   POST /api/ai/contact/insights  — Summarise a contact & suggest next actions
 */

import { Router, Request, Response } from 'express';
import { getAIClient, DEFAULT_MODEL } from '../../packages/ai/client.js';
import { Type } from '@google/genai';
import { db } from '../../infrastructure/database/client.js';
import { executeTool, APPROVAL_REQUIRED_TOOLS, getActionLabel } from './ai-executor.js';

const router = Router();

// ── CRM Function Declarations for Gemini ──────────────────────────────────────

const CRM_TOOLS = [
  {
    name: 'get_crm_dashboard',
    description: 'Get CRM dashboard metrics including total contacts, revenue, deals count, and pipeline status.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'search_contacts',
    description: 'Search contacts in the CRM by name, email, phone, tag, or status.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        search: { type: Type.STRING, description: 'Search term for contact name, email, phone, or tag' },
        status: { type: Type.STRING, description: 'Filter by contact status (e.g. Lead, Customer, Prospect)' },
      },
    },
  },
  {
    name: 'get_contact_details',
    description: 'Get detailed information for a specific contact including notes and recent events.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        contactId: { type: Type.STRING, description: 'The contact ID' },
      },
      required: ['contactId'],
    },
  },
  {
    name: 'create_contact',
    description: 'Create a new contact in the CRM.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        firstName: { type: Type.STRING, description: 'First name of the contact' },
        lastName: { type: Type.STRING, description: 'Last name of the contact' },
        email: { type: Type.STRING, description: 'Email address' },
        phone: { type: Type.STRING, description: 'Phone number' },
        status: { type: Type.STRING, description: 'Status (e.g. Lead, Customer, Prospect)' },
        about: { type: Type.STRING, description: 'Notes or bio about the contact' },
      },
      required: ['firstName'],
    },
  },
  {
    name: 'update_contact',
    description: 'Update an existing contact in the CRM.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        contactId: { type: Type.STRING, description: 'The ID of the contact to update' },
        firstName: { type: Type.STRING, description: 'First name' },
        lastName: { type: Type.STRING, description: 'Last name' },
        email: { type: Type.STRING, description: 'Email address' },
        phone: { type: Type.STRING, description: 'Phone number' },
        status: { type: Type.STRING, description: 'Status' },
        about: { type: Type.STRING, description: 'About/Notes' },
      },
      required: ['contactId'],
    },
  },
  {
    name: 'add_contact_note',
    description: 'Add an internal note to a contact.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        contactId: { type: Type.STRING, description: 'The contact ID' },
        note: { type: Type.STRING, description: 'The note text to add' },
      },
      required: ['contactId', 'note'],
    },
  },
  {
    name: 'list_deals',
    description: 'List deals / opportunities in the CRM pipeline.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'create_deal',
    description: 'Create a new deal / opportunity in the pipeline.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Deal title' },
        amount: { type: Type.NUMBER, description: 'Deal value/amount in dollars' },
        contactId: { type: Type.STRING, description: 'Associated contact ID' },
        priority: { type: Type.STRING, description: 'Priority: low, medium, high' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks in the CRM.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'create_task',
    description: 'Create a new task in the CRM.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Task description / title' },
        contactId: { type: Type.STRING, description: 'Associated contact ID' },
        priority: { type: Type.STRING, description: 'Priority: low, medium, high' },
        dueDate: { type: Type.STRING, description: 'Due date ISO string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'send_email',
    description: 'Send an email message to a CRM contact.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        contactId: { type: Type.STRING, description: 'The contact ID' },
        subject: { type: Type.STRING, description: 'Email subject line' },
        body: { type: Type.STRING, description: 'Email body text' },
      },
      required: ['contactId', 'subject', 'body'],
    },
  },
  {
    name: 'send_sms',
    description: 'Send an SMS text message to a CRM contact.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        contactId: { type: Type.STRING, description: 'The contact ID' },
        message: { type: Type.STRING, description: 'SMS message text' },
      },
      required: ['contactId', 'message'],
    },
  },
  {
    name: 'list_campaigns',
    description: 'List email marketing campaigns.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'create_campaign',
    description: 'Create a new email marketing campaign.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Campaign name' },
        subject: { type: Type.STRING, description: 'Email subject line' },
        bodyHtml: { type: Type.STRING, description: 'Email HTML content' },
      },
      required: ['name', 'subject'],
    },
  },
];


// ── Helpers ──────────────────────────────────────────────────────────────────

function buildCleanContents(history: { role: string; content: string }[], currentMessage: string) {
  const cleanContents: any[] = [];

  for (const h of history || []) {
    if (!h.content?.trim()) continue;
    if (h.content.startsWith('Error:') || h.content.includes('404') || h.content.startsWith('*Executing CRM Action')) continue;

    const role = h.role === 'assistant' || h.role === 'model' ? 'model' : 'user';

    // Ensure strict user -> model -> user alternation
    const lastRole = cleanContents.length > 0 ? cleanContents[cleanContents.length - 1].role : null;
    if (role !== lastRole) {
      cleanContents.push({ role, parts: [{ text: h.content }] });
    }
  }

  // Ensure history ends before user's current message with a model turn if cleanContents ends with user
  if (cleanContents.length > 0 && cleanContents[cleanContents.length - 1].role === 'user') {
    cleanContents.pop();
  }

  cleanContents.push({ role: 'user', parts: [{ text: currentMessage }] });
  return cleanContents;
}

async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  const ai = getAIClient();
  const res = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(systemInstruction ? { config: { systemInstruction, temperature: 0.7 } } : { config: { temperature: 0.7 } }),
  });
  return res.text ?? '';
}

// ── POST /api/ai/chat — Copilot chat with CRM tool execution ─────────────────
router.post('/chat', async (req: Request, res: Response) => {
  const { message, route, history } = req.body as { message?: string; route?: string; history?: { role: string; content: string }[] };
  const workspaceId = (req as any).workspaceId || '';
  const userId = (req as any).userId || 'system';

  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  const ai = getAIClient();

  // SSE streaming headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const writeChunk = (text: string) => {
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
  };

  try {
    const contents = buildCleanContents(history || [], message);

    const systemInstruction =
      "You are Stone AI — the intelligent copilot and autonomous workspace manager for Stone AIO. " +
      (route ? `User is currently viewing page: ${route}. ` : '') +
      "You have direct live access to tools to manage contacts, deals, tasks, notes, messages (email/SMS), and email campaigns in the CRM. " +
      "When the user asks you to view, find, search, create, update, or send anything in the CRM, ALWAYS call your tools to execute the action. " +
      "Be helpful, dynamic, unique, and action-oriented. Format your responses with markdown, headers, and bulleted lists.";

    // Attempt tool execution pass with fallback
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
      console.warn('[AI Chat] Tool pass failed, falling back to direct stream:', toolErr.message);
    }

    const functionCalls = firstRes?.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      const toolResults: any[] = [];
      for (const call of functionCalls) {
        if (!call.name) continue;

        if (APPROVAL_REQUIRED_TOOLS.has(call.name)) {
          // Queue for human approval — do NOT execute yet
          const label = getActionLabel(call.name, call.args ?? {});
          const queued = await (db as any).aIAction.create({
            data: {
              workspaceId,
              toolName: call.name,
              args: call.args ?? {},
              label,
              status: 'pending',
              chatContext: message,
            },
          });
          writeChunk(`\n> ⏳ **Action queued for your approval:** *${label}*\n> Check the **AI Control Panel** in your Dashboard to approve or reject.\n\n`);
          res.write(`data: ${JSON.stringify({ action_proposal: queued })}\n\n`);
          toolResults.push({ name: call.name, result: { queued: true, actionId: queued.id, label } });
        } else {
          // Read-only / safe tools — execute immediately
          writeChunk(`*Executing: \`${call.name}\`...*\n\n`);
          try {
            const result = await executeTool(workspaceId, call.name, call.args, userId);
            toolResults.push({ name: call.name, result });
          } catch (err: any) {
            toolResults.push({ name: call.name, error: err.message });
          }
        }
      }

      // Add model's function calls and tool results to context
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
        parts: toolResults.map(tr => ({
          functionResponse: {
            name: tr.name,
            response: { output: tr.result || tr.error },
          },
        })),
      });

      // Stream final response summarizing tool actions
      const stream = await ai.models.generateContentStream({
        model: DEFAULT_MODEL,
        contents,
        config: { systemInstruction, temperature: 0.7 },
      });

      for await (const chunk of stream) {
        if (chunk.text) writeChunk(chunk.text);
      }
    } else {
      // Direct text streaming response
      const stream = await ai.models.generateContentStream({
        model: DEFAULT_MODEL,
        contents,
        config: { systemInstruction, temperature: 0.7 },
      });

      for await (const chunk of stream) {
        if (chunk.text) writeChunk(chunk.text);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('[AI Chat Error]', err);
    res.write(`data: ${JSON.stringify({ error: err.message || 'AI error' })}\n\n`);
    res.end();
  }
});

// ── POST /api/ai/email/generate — Write a full email from a prompt ────────────
router.post('/email/generate', async (req: Request, res: Response) => {
  const { prompt, campaignName, audienceDescription } = req.body as {
    prompt?: string;
    campaignName?: string;
    audienceDescription?: string;
  };

  if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' });

  try {
    const fullPrompt = [
      campaignName && `Campaign name: ${campaignName}`,
      audienceDescription && `Target audience: ${audienceDescription}`,
      `Task: ${prompt}`,
    ]
      .filter(Boolean)
      .join('\n');

    const text = await generateText(
      fullPrompt,
      'You are an expert email copywriter specializing in high-converting marketing emails. ' +
        'Write professional, engaging email body content in clean HTML format. ' +
        'Use personalization tokens like {{first_name}} where appropriate. ' +
        'Include a clear CTA. Return only the HTML body content — no subject line, no explanations.',
    );

    return res.json({ html: text });
  } catch (err: any) {
    console.error('[AI] email/generate error:', err);
    return res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// ── POST /api/ai/email/improve — Improve existing email copy ─────────────────
router.post('/email/improve', async (req: Request, res: Response) => {
  const { html, instruction } = req.body as { html?: string; instruction?: string };

  if (!html?.trim()) return res.status(400).json({ error: 'html is required' });

  try {
    const prompt = instruction
      ? `Instruction: ${instruction}\n\nOriginal email HTML:\n${html}`
      : `Improve this email to be more engaging, clear, and conversion-focused:\n${html}`;

    const text = await generateText(
      prompt,
      'You are an expert email copywriter. Improve the given email HTML. ' +
        'Return only the improved HTML body content — no explanations, no markdown fences.',
    );

    return res.json({ html: text });
  } catch (err: any) {
    console.error('[AI] email/improve error:', err);
    return res.status(500).json({ error: err.message || 'Improve failed' });
  }
});

// ── POST /api/ai/email/subject — Generate subject line ideas ─────────────────
router.post('/email/subject', async (req: Request, res: Response) => {
  const { html, campaignContext } = req.body as { html?: string; campaignContext?: string };

  try {
    const prompt = [
      campaignContext && `Campaign context: ${campaignContext}`,
      html && `Email body preview:\n${html.replace(/<[^>]+>/g, ' ').trim().slice(0, 500)}`,
      'Generate 5 compelling, high-open-rate email subject line options. ' +
        'Vary the style: curiosity, urgency, personalization, benefit-driven, question. ' +
        'Return a JSON array of strings only.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', temperature: 0.9 } as any,
    });

    const raw = (response.text ?? '').trim();
    try {
      const subjects = JSON.parse(raw);
      return res.json({ subjects: Array.isArray(subjects) ? subjects : subjects.subjects ?? [] });
    } catch {
      const lines = raw
        .replace(/```json|```/gi, '')
        .trim()
        .split('\n')
        .map((l: string) => l.replace(/^[-*"\d.]+\s*/, '').replace(/[",]$/, '').trim())
        .filter(Boolean);
      return res.json({ subjects: lines.slice(0, 5) });
    }
  } catch (err: any) {
    console.error('[AI] email/subject error:', err);
    return res.status(500).json({ error: err.message || 'Subject generation failed' });
  }
});

// ── POST /api/ai/contact/insights — Summarise contact & suggest actions ───────
router.post('/contact/insights', async (req: Request, res: Response) => {
  const { contact, activities } = req.body as { contact?: any; activities?: any[] };

  if (!contact) return res.status(400).json({ error: 'contact is required' });

  try {
    const context = [
      `Contact: ${contact.firstName || ''} ${contact.lastName || ''} (${contact.email || 'no email'})`,
      contact.phone && `Phone: ${contact.phone}`,
      contact.tags?.length && `Tags: ${contact.tags.join(', ')}`,
      contact.customFields && `Custom fields: ${JSON.stringify(contact.customFields)}`,
      contact.notes && `Notes: ${contact.notes}`,
      activities?.length &&
        `Recent activity:\n${activities
          .slice(0, 10)
          .map((a: any) => `- ${a.type}: ${a.description || ''} (${new Date(a.createdAt).toLocaleDateString()})`)
          .join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n');

    const text = await generateText(
      context,
      'You are a CRM assistant. Analyse the contact data and provide:\n' +
        '1. A brief 2-sentence summary of who this contact is and their engagement level\n' +
        '2. 3 specific next action recommendations (be concrete and actionable)\n' +
        '3. A one-line engagement score description (cold / warm / hot)\n\n' +
        'Format your response as JSON: { "summary": "...", "nextActions": ["...", "...", "..."], "engagementScore": "..." }',
    );

    try {
      const clean = text.replace(/```json|```/gi, '').trim();
      return res.json(JSON.parse(clean));
    } catch {
      return res.json({ summary: text, nextActions: [], engagementScore: 'Unknown' });
    }
  } catch (err: any) {
    console.error('[AI] contact/insights error:', err);
    return res.status(500).json({ error: err.message || 'Insights failed' });
  }
});

export default router;
