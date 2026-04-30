import { Router, Request, Response } from 'express';
import { getAIClient, DEFAULT_MODEL } from '../packages/ai/client.js';
import { WORKFLOW_SYSTEM_PROMPT } from '../packages/ai/prompts/workflow-gen.v1.js';

const router = Router();



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
    
    // Extract JSON from response
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      // Try parsing the entire response as JSON
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
    return res.status(500).json({ 
      error: 'Generation failed', 
      message: error.message || 'Unknown error' 
    });
  }
});

export default router;
