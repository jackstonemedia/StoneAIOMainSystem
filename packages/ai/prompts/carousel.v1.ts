/**
 * Carousel Generation Prompt — v1
 * Extracted from api/agents.ts — single source of truth for this prompt.
 * To update: create carousel.v2.ts and update the import in CarouselChain.
 */

export interface CarouselPromptParams {
  topic: string;
  description?: string;
  designPrompt?: string;
  autoResearch?: boolean;
  platform: string;
  contentStyle: string;
  contentLength: 'short' | 'medium' | 'long';
  slideCount: number;
  creativeSeed: number;
}

const BODY_TYPES = [
  "{ type: 'step', stepNum: string, title: string, body: string }",
  "{ type: 'statistic', title: string, body: string }",
  "{ type: 'quote', body: string, title?: string }",
  "{ type: 'listicle', title: string, items: string[] }",
  "{ type: 'comparison', leftTitle: string, leftBody: string, rightTitle: string, rightBody: string }",
];

export function buildCarouselPrompt(params: CarouselPromptParams): string {
  const { topic, description, designPrompt, platform, contentStyle, contentLength, slideCount, creativeSeed } = params;

  const densityRule =
    contentLength === 'short'
      ? 'Body text: MAX 1 punchy sentence. No filler.'
      : contentLength === 'medium'
      ? 'Body text: 1-2 tight sentences, max 80-120 chars. Remove anything non-essential.'
      : 'Body text: 2-3 expert sentences, max 200 chars.';

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

  return `// Phase 1 — Randomization Engine
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
}
