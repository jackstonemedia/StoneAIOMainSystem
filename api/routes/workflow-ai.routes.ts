import { Router, Request, Response } from 'express';
import { getAIClient, DEFAULT_MODEL } from '../../packages/ai/client.js';
import { WORKFLOW_SYSTEM_PROMPT } from '../../packages/ai/prompts/workflow-gen.v1.js';

const router = Router();

// ── POST /api/workflow-ai/chat — SSE streaming text (replaces frontend gemini.ts) ──
router.post('/chat', async (req: Request, res: Response) => {
  const { prompt, systemPrompt } = req.body as { prompt?: string; systemPrompt?: string };

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const ai = getAIClient();

  // SSE headers — client reads these as a stream of data: events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const stream = await ai.models.generateContentStream({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(systemPrompt ? { config: { systemInstruction: systemPrompt } } : {}),
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message || 'AI error' })}\n\n`);
    res.end();
  }
});

// ── POST /api/workflow-ai/generate-json — JSON generation (replaces frontend gemini.ts) ──
router.post('/generate-json', async (req: Request, res: Response) => {
  const { prompt, schema } = req.body as { prompt?: string; schema?: string };

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const ai = getAIClient();

  try {
    const fullPrompt = schema
      ? `${prompt}\n\nRespond with ONLY a valid JSON object/array. No markdown fences, no explanation.\nExpected shape: ${schema}`
      : prompt;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      config: { responseMimeType: 'application/json' } as any,
    });

    const raw = (response.text ?? '').trim();
    if (!raw) return res.status(500).json({ error: 'AI returned an empty response' });

    try {
      return res.json(JSON.parse(raw));
    } catch {
      const stripped = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      return res.json(JSON.parse(stripped));
    }
  } catch (err: any) {
    console.error('[generate-json]', err);
    return res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, existingWorkflow, apiKey } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const key = apiKey || process.env.GOOGLE_AI_API_KEY;
    if (!key) {
      return res.status(400).json({ error: 'API key required', message: 'Set GOOGLE_AI_API_KEY or pass apiKey in request.' });
    }

    const ai = getAIClient();

    let userMessage = prompt;
    if (existingWorkflow) {
      userMessage += `\n\nCurrent workflow to modify:\n\`\`\`json\n${JSON.stringify(existingWorkflow, null, 2)}\n\`\`\``;
    }

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      config: { systemInstruction: WORKFLOW_SYSTEM_PROMPT, temperature: 0.3, maxOutputTokens: 4096 },
    });

    const text = response.text || '';

    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      try {
        const parsed = JSON.parse(text);
        return res.json(parsed);
      } catch {
        return res.json({ explanation: text, nodes: [], edges: [] });
      }
    }

    const workflow = JSON.parse(jsonMatch[1]);
    return res.json(workflow);
  } catch (error: any) {
    console.error('Workflow AI error:', error);
    return res.status(500).json({ error: 'Generation failed', message: error.message || 'Unknown error' });
  }
});

export default router;
