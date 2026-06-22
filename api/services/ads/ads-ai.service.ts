/**
 * Ad AI Service — Gemini-powered copy generation, keyword suggestions,
 * and image generation via the existing Gemini integration pattern.
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { GenerateCopyInput, GenerateKeywordsInput } from '../../schemas/ads.schemas.js';

function getGenAI() {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY or GEMINI_API_KEY not set');
  return new GoogleGenerativeAI(apiKey);
}

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

// ─── Copy Generation ──────────────────────────────────────────────────────────

export interface GeneratedAdCopy {
  headlines: string[];
  descriptions: string[];
  primaryText?: string;
}

export async function generateAdCopy(input: GenerateCopyInput): Promise<GeneratedAdCopy[]> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', safetySettings });

  const isGoogle = input.adType === 'GOOGLE_SEARCH' || input.adType === 'GOOGLE_DISPLAY';
  const isFacebook = input.adType === 'FACEBOOK_FEED' || input.adType === 'FACEBOOK_LEAD';

  const prompt = isGoogle
    ? `You are an expert Google Ads copywriter. Generate ${input.numVariants} variants of ad copy for the following product/service:

"${input.description}"

For each variant, provide:
- 3 headlines (max 30 characters each, count carefully)
- 2 descriptions (max 90 characters each, count carefully)

Respond ONLY with valid JSON in this exact format:
[
  {
    "headlines": ["headline1", "headline2", "headline3"],
    "descriptions": ["description1", "description2"]
  }
]

Important: Count characters carefully. Headlines must be ≤30 chars. Descriptions must be ≤90 chars.`
    : `You are an expert Facebook Ads copywriter. Generate ${input.numVariants} variants of ad copy for the following product/service:

"${input.description}"

For each variant, provide:
- 1 headline (max 40 characters)
- 1 description (max 125 characters)  
- 1 primary text (the main ad body, max 125 characters, conversational tone)

Respond ONLY with valid JSON in this exact format:
[
  {
    "headlines": ["headline"],
    "descriptions": ["description"],
    "primaryText": "primary text copy"
  }
]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Extract JSON from response (model sometimes wraps in markdown)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON copy');
  return JSON.parse(jsonMatch[0]) as GeneratedAdCopy[];
}

// ─── Keyword Suggestions ──────────────────────────────────────────────────────

export interface KeywordSuggestion {
  text: string;
  matchType: 'BROAD' | 'PHRASE' | 'EXACT';
}

export async function suggestKeywords(input: GenerateKeywordsInput): Promise<KeywordSuggestion[]> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', safetySettings });

  const seedContext = input.seed?.length ? `\nSeed keywords to build on: ${input.seed.join(', ')}` : '';

  const prompt = `You are an expert Google Ads keyword researcher. Generate ${input.numKeywords} high-intent search keywords for:

"${input.description}"${seedContext}

Include a mix of:
- Broad match keywords (discovery)
- Phrase match keywords (more targeted)
- Exact match keywords (high intent, specific)

Respond ONLY with valid JSON in this exact format:
[
  { "text": "keyword phrase", "matchType": "BROAD" },
  { "text": "keyword phrase", "matchType": "PHRASE" },
  { "text": "keyword phrase", "matchType": "EXACT" }
]

Make keywords specific, actionable, and relevant to the business. Mix match types throughout.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('AI did not return valid keywords JSON');
  return JSON.parse(jsonMatch[0]) as KeywordSuggestion[];
}

// ─── Image Generation ─────────────────────────────────────────────────────────

export interface GeneratedImage {
  url: string; // base64 data URL or hosted URL
  mimeType: string;
}

export async function generateAdImage(description: string): Promise<GeneratedImage> {
  // Note: Imagen is available via Vertex AI. For now, we use a descriptive prompt approach.
  // If Imagen API is available, swap this implementation.
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('AI API key not set');

  // Try Imagen 3 via Generative Language API
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{
          prompt: `Professional advertising image for: ${description}. Clean, modern, high-quality, suitable for social media ads. No text overlays.`
        }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '1:1',
          safetyFilterLevel: 'block_some',
        }
      })
    }
  );

  if (!res.ok) {
    throw new Error(`Image generation failed: ${await res.text()}`);
  }

  const data = await res.json() as any;
  const imageData = data.predictions?.[0]?.bytesBase64Encoded;
  if (!imageData) throw new Error('No image returned from API');

  return {
    url: `data:image/png;base64,${imageData}`,
    mimeType: 'image/png',
  };
}
