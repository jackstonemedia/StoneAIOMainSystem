import { Router } from 'express';
import { db } from '../src/lib/db';
import { GoogleGenAI } from '@google/genai';

const router = Router();
console.log('📦 Loading Agents API Router...');
const apiKey = process.env.GOOGLE_AI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const MOCK_WORKSPACE_ID = 'workspace_123';

router.get('/ping', (req, res) => {
  console.log('🏓 Pong!');
  res.send('pong');
});

// 🚀 CRITICAL: GENERATOR ROUTE (Move to top to avoid shadowing)
router.post('/generate-carousel', async (req, res) => {
  console.log('🌟 [POST] /api/agents/generate-carousel | Topic:', req.body.topic);
  try {
    const { topic, description, designPrompt, autoResearch, platform, contentStyle, contentLength, slideCount } = req.body;
    
    if (!topic && !autoResearch) {
      return res.status(400).json({ error: 'Topic is required.' });
    }

    if (!ai) {
      console.error('❌ AI Key Missing');
      return res.status(500).json({ error: 'Google AI API key is not configured in environment variables.' });
    }

    const stepsCount = Math.max(1, slideCount - 2);

    const creativeSeed = Math.floor(Math.random() * 100000);
    const densityRule = contentLength === 'short'
      ? 'Body text: MAX 1 punchy sentence. No filler.'
      : contentLength === 'medium'
      ? 'Body text: 1-2 tight sentences, max 80-120 chars. Remove anything non-essential.'
      : 'Body text: 2-3 expert sentences, max 200 chars.';

    const BODY_TYPES = [
      "{ type: 'step', stepNum: string, title: string, body: string }",
      "{ type: 'statistic', title: string, body: string }",
      "{ type: 'quote', body: string, title?: string }",
      "{ type: 'listicle', title: string, items: string[] }",
      "{ type: 'comparison', leftTitle: string, leftBody: string, rightTitle: string, rightBody: string }"
    ];
    const selectedBodySchema = BODY_TYPES[creativeSeed % BODY_TYPES.length];

    let layoutRules = `
BODY SLIDES (Slides 2 through ${slideCount - 1}):
- Select ONE slide type (e.g. 'step', or 'statistic') and use THAT EXACT SAME TYPE for ALL middle slides. Do not mix types. This ensures visual consistency.
- One idea per slide. No cramming.
- Each slide must be more valuable than the previous.
- End every body slide with a transition that makes the next slide feel necessary.
- Include at least one slide that uses the researched stat or case study.
- Max 25 words of body copy per slide. Cut ruthlessly.
- Use "you" language.`;

    let outputInstructions = `
Available slide types (You MUST strictly use ONLY the 3 schemas provided below):
{ type: 'cover', title: string, body: string } // Slide 1 ONLY
${selectedBodySchema} // EXACT SCHEMA REQUIRED FOR ALL MIDDLE SLIDES
{ type: 'cta', title: string, body: string } // Last slide ONLY

First slide must be 'cover'. All middle slides must strictly use the exact middle schema provided above. Last slide must be 'cta'.`;

    if (designPrompt) {
      layoutRules = `
BODY SLIDES (Slides 2 through ${slideCount - 1}):
- Because a custom design prompt is active, YOU HAVE FULL CREATIVE FREEDOM over the slide layouts.
- You must use the 'freeform' layout when you want to inject Lucide graphics, customize text alignment, add bullet points, and highlight boxes.
- You can mix and match schemas ('step', 'quote', 'freeform', etc.) slide-by-slide to perfectly match the design prompt.
- One idea per slide. No cramming.
- Max 25 words of body copy per slide.
- Use "you" language.`;

      outputInstructions = `
Available slide types:
{ type: 'cover', title: string, body: string } // Slide 1 ONLY
${BODY_TYPES.join('\n')}
{ type: 'freeform', title?: string, body?: string, label?: string, bullets?: string[], lucideIcon?: string (e.g. 'Rocket', 'Zap', 'Target', 'Shield', 'AlertTriangle'), textAlign?: 'left' | 'center' | 'right', accentBox?: string } // DYNAMIC LAYOUT
{ type: 'cta', title: string, body: string } // Last slide ONLY

First slide must be 'cover'. Middle slides can use any schema above. Last slide must be 'cta'.`;
    }

    const prompt = `// Phase 1 — Randomization Engine
BEFORE writing any content, you must randomly select ONE option from each axis below.

HOOK FRAME: [Bold Claim / Uncomfortable Truth / Number Shock / Contrarian Take / Painful Mistake / Nobody Talks About This / Before-After / Stinging Question / Ranked List Tease / Story Open]
CONTENT FORMAT: [Step-by-step / Myth vs Reality / Ranked List / Before & After / Mistakes + Fixes / Case Study / Rules / Comparison / Only X Things Matter]
TONE MODIFIER: [Urgent / Calm Authority / Tough Love / Mentor / Peer-to-Peer / Realist / Insider / Storyteller] (Base voice: ${contentStyle})
BODY STYLE: [1 big idea / Short bullets / Bold statement + sub-copy / Mini-story arc / Stat → implication / Question → answer]
TOPIC ANGLE: [Beginner trap / Advanced move / Behind the scenes / Why most fail / Framework / What X taught me / Future of X / Steal this process]
CTA STYLE: [Save / Comment / Tag / Share / DM / Ask opinion / Follow / Try today]

SEED: ${creativeSeed} — Use this to ensure you pick a totally unique combination of the above compared to any previous generation.


// Phase 2 — Research Instruction
BEFORE writing the carousel, gather the following internally for topic: "${topic || 'Industry insights'}" (Angle: "${description || 'Expert knowledge'}")
1. One fresh statistic/data point that surprises.
2. One current trend or development (specific company or tool).
3. One common belief that is wrong/incomplete.
4. One counter-intuitive insight.
5. One concrete example or case study.


// Phase 3 — Generation Rules
Now write exactly ${slideCount} slides for ${platform}. DENSITY: ${densityRule}. Follow these rules without exception:

HOOK SLIDE (Cover - Slide 1):
- Headline: max 10 words. Must use the selected HOOK FRAME.
- No explanation, no brand, no fluff. Create the gap only.

${layoutRules}

FINAL SLIDE (CTA):
- Resolve the tension created in the hook.
- Single CTA using the selected CTA STYLE.
- Add a save-worthy summary line.

GLOBAL RULES:
- BANNED PHRASES: "In today's world", "fast-paced", "game-changing", "leverage", "synergy", "it's important to note", "as we all know", "seamlessly", "robust", "dynamic".
- Conversational only. No academic or corporate language.
- Slide headlines must work standalone for skimmers.
- Use the researched content — do not write generic assertions.
${designPrompt ? `\nUSER DESIGN INSTRUCTIONS (CRITICAL):\n${designPrompt}` : ''}


// OUTPUT INSTRUCTIONS
You must output ONLY a valid JSON array of slides. No markdown, no [RESEARCH BLOCK] text, just raw JSON.
${outputInstructions}
`;


    // Built-in Google Search grounding if autoResearch is toggled on!
    const tools = autoResearch ? [{ google_search: {} }] : undefined;

    console.log('🤖 Calling Gemini (gemini-2.5-flash)...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        tools: tools as any
      }
    });

    let text = response.text || '[]';
    
    // Safety check for markdown blocks or unexpected text wrapping
    if (text.includes('```')) {
      const match = text.match(/```(?:json)?([\s\S]*?)```/);
      if (match) text = match[1].trim();
    }

    try {
      const slides = JSON.parse(text);
      console.log('✅ Generation Success. Pages:', slides.length);
      return res.json({ slides });
    } catch (parseErr) {
      console.error('JSON Parse Error. Raw Text Content:', text);
      return res.status(500).json({ error: 'AI returned malformed JSON. Please try again.' });
    }
  } catch (error: any) {
    return res.status(500).json({ error: `Generation failed: ${error.message}` });
  }
});

// POST create new agent
router.post('/', async (req, res) => {
  try {
    const { name, type, role, status, config } = req.body;
    const agent = await db.agent.create({
      data: {
        name: name || 'Unnamed Agent',
        type: type || 'voice',
        status: status || 'draft',
        config: config ? JSON.stringify(config) : '{}',
        workspaceId: MOCK_WORKSPACE_ID
      }
    });
    res.json(agent);
  } catch (err) {
    console.error('Failed to create agent:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET all agents
router.get('/', async (req, res) => {
  try {
    const agents = await db.agent.findMany({
      where: { workspaceId: MOCK_WORKSPACE_ID }
    });
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET specific agent
router.get('/:id', async (req, res) => {
  try {
    const agent = await db.agent.findUnique({
      where: { id: req.params.id }
    });
    if (agent) res.json(agent);
    else res.status(404).json({ error: 'Agent not found' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT save workflow config
router.put('/:id/workflow', async (req, res) => {
  try {
    const agent = await db.agent.update({
      where: { id: req.params.id },
      data: { config: JSON.stringify(req.body) }
    });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save workflow' });
  }
});

// POST execute workflow (Test Run) - SSE Endpoint
router.post('/:id/run', async (req, res) => {
  const agentId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent || !agent.config) {
      sendEvent({ type: 'error', message: 'Agent or configuration not found' });
      return res.end();
    }

    const config = JSON.parse(agent.config as string);
    const { nodes = [], edges = [] } = config;

    // Create AgentRun record
    const run = await db.agentRun.create({
      data: {
        agentId,
        status: 'running',
        triggerData: JSON.stringify(req.body || {})
      }
    });

    // 1. Topological Sort
    const inDegree: Record<string, number> = {};
    const adjList: Record<string, string[]> = {};
    const nodeMap: Record<string, any> = {};

    nodes.forEach((n: any) => {
      inDegree[n.id] = 0;
      adjList[n.id] = [];
      nodeMap[n.id] = n;
    });

    edges.forEach((e: any) => {
      if (adjList[e.source]) adjList[e.source].push(e.target);
      if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    });

    const queue: string[] = [];
    nodes.forEach((n: any) => {
      if (inDegree[n.id] === 0) queue.push(n.id);
    });

    const executionOrder: string[] = [];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      executionOrder.push(currentId);
      adjList[currentId].forEach(neighbor => {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) queue.push(neighbor);
      });
    }

    if (executionOrder.length !== nodes.length) {
      sendEvent({ type: 'error', message: 'Cycle detected in workflow DAG. Cannot execute.' });
      return res.end();
    }

    // 2. Sequential Execution
    const context: Record<string, any> = {};

    for (const nodeId of executionOrder) {
      const node = nodeMap[nodeId];
      const nodeDefId = node.data?.nodeDefId || node.type;
      
      sendEvent({ 
        type: 'log', 
        nodeId, 
        status: 'running', 
        time: new Date().toLocaleTimeString(),
        message: `Executing [${node.data?.label || nodeDefId}]...` 
      });

      const stepStart = Date.now();
      let nodeOutput: any = null;
      let nodeError: string | null = null;
      let isSuccess = true;

      try {
        if (nodeDefId === 'trigger-webhook') {
          nodeOutput = { received: true, payload: req.body };
        } else if (nodeDefId === 'ai-llm' || nodeDefId === 'ai-extract') {
          await new Promise(resolve => setTimeout(resolve, 800));
          nodeOutput = { status: 'processed', aiOutput: 'Simulated LLM response' };
        } else if (nodeDefId === 'logic-delay') {
          await new Promise(resolve => setTimeout(resolve, 1500));
          nodeOutput = { delayed: true };
        } else {
          await new Promise(resolve => setTimeout(resolve, 500));
          nodeOutput = { status: 'success' };
        }
        context[nodeId] = nodeOutput;
      } catch (err: any) {
        isSuccess = false;
        nodeError = err.message || 'Node execution failed';
      }

      const duration = Date.now() - stepStart;
      await db.agentRunStep.create({
        data: {
          runId: run.id,
          nodeId,
          status: isSuccess ? 'success' : 'failed',
          output: nodeOutput ? JSON.stringify(nodeOutput) : null,
          error: nodeError,
          duration
        }
      });

      if (!isSuccess) {
        sendEvent({ 
          type: 'log', nodeId, status: 'error', 
          time: new Date().toLocaleTimeString(),
          message: `❌ Failed: ${nodeError}` 
        });
        await db.agentRun.update({
          where: { id: run.id },
          data: { status: 'failed', completedAt: new Date() }
        });
        return res.end();
      }

      sendEvent({ 
        type: 'log', nodeId, status: 'success', 
        time: new Date().toLocaleTimeString(),
        message: `✅ Completed [${node.data?.label || nodeDefId}] in ${duration}ms` 
      });
    }

    await db.agentRun.update({
      where: { id: run.id },
      data: { status: 'success', completedAt: new Date() }
    });
    sendEvent({ type: 'done' });
    res.end();
  } catch (error: any) {
    sendEvent({ type: 'error', message: error.message || 'Execution engine crashed' });
    res.end();
  }
});

export default router;
