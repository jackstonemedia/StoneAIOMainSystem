/**
 * Business Profile + Writing Samples — Create with AI (Milestone 1, spec §4).
 *
 * The Business Profile is the ONLY thing the product remembers between campaigns.
 * One profile per workspace. All fields are typed text — no pick-lists or chips.
 * Required fields (spec §4): business name, business type, services, service
 * area, sender name, reply-to email, business address, AND at least one of
 * booking link / phone. Optional fields never block anything.
 *
 * Writing Samples refine voice only, never facts. A sample's style summary must
 * be approved (or edited) by the user before it is used for drafting (M3).
 * Editing a sample's content resets approval + summary (the old summary no
 * longer describes the text).
 */

import { db } from '../../../infrastructure/database/client.js';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export const MAX_SAMPLES = 10;
export const MAX_SAMPLE_CHARS = 10_000;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type ProfileInput = {
  businessName?: string;
  businessType?: string;
  services?: string;
  serviceArea?: string;
  senderName?: string;
  replyToEmail?: string;
  physicalAddress?: string;
  bookingLink?: string | null;
  phone?: string | null;
  customerType?: string | null;
  voiceDescription?: string | null;
  wordsToAvoid?: string | null;
  websiteUrl?: string | null;
  differentiators?: string | null;
  guaranteesProof?: string | null;
};

const REQUIRED_FIELDS: Array<{ key: keyof ProfileInput; label: string }> = [
  { key: 'businessName', label: 'Business name' },
  { key: 'businessType', label: 'Business type' },
  { key: 'services', label: 'Services or products' },
  { key: 'serviceArea', label: 'Service area' },
  { key: 'senderName', label: 'Sender name' },
  { key: 'replyToEmail', label: 'Reply-to email' },
  { key: 'physicalAddress', label: 'Business address' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanOrNull(value: unknown): string | null {
  const v = clean(value);
  return v ? v : null;
}

/** Returns a map of field -> message for every validation problem (empty = valid). */
export function validateProfile(input: ProfileInput): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const { key, label } of REQUIRED_FIELDS) {
    if (!clean(input[key])) errors[key as string] = `${label} is required.`;
  }
  const email = clean(input.replyToEmail);
  if (email && !EMAIL_RE.test(email)) errors.replyToEmail = 'Reply-to email must be a valid email address.';
  const bookingLink = clean(input.bookingLink);
  const phone = clean(input.phone);
  if (!bookingLink && !phone) {
    errors.bookingLink = 'Enter a booking or main action link, or a phone number (at least one is required).';
  }
  if (bookingLink) {
    try {
      const u = new URL(bookingLink);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        errors.bookingLink = 'Booking link must start with http:// or https://.';
      }
    } catch {
      errors.bookingLink = 'Booking link must be a valid URL.';
    }
  }
  const websiteUrl = clean(input.websiteUrl);
  if (websiteUrl) {
    try {
      const u = new URL(websiteUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        errors.websiteUrl = 'Website link must start with http:// or https://.';
      }
    } catch {
      errors.websiteUrl = 'Website link must be a valid URL.';
    }
  }
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.length > 5000) {
      errors[key] = 'This field is too long (max 5,000 characters).';
    }
  }
  return errors;
}

/** The list of required fields that are currently empty (for the confirm card). */
export function missingRequiredFields(profile: Record<string, unknown> | null): string[] {
  if (!profile) return REQUIRED_FIELDS.map((f) => f.label).concat(['Booking link or phone']);
  const missing: string[] = [];
  for (const { key, label } of REQUIRED_FIELDS) {
    if (!clean(profile[key as string])) missing.push(label);
  }
  if (!clean(profile.bookingLink) && !clean(profile.phone)) missing.push('Booking link or phone');
  return missing;
}

function toInput(profile: Record<string, unknown>): ProfileInput {
  return {
    businessName: clean(profile.businessName),
    businessType: clean(profile.businessType),
    services: clean(profile.services),
    serviceArea: clean(profile.serviceArea),
    senderName: clean(profile.senderName),
    replyToEmail: clean(profile.replyToEmail),
    physicalAddress: clean(profile.physicalAddress),
    bookingLink: cleanOrNull(profile.bookingLink),
    phone: cleanOrNull(profile.phone),
    customerType: cleanOrNull(profile.customerType),
    voiceDescription: cleanOrNull(profile.voiceDescription),
    wordsToAvoid: cleanOrNull(profile.wordsToAvoid),
    websiteUrl: cleanOrNull(profile.websiteUrl),
    differentiators: cleanOrNull(profile.differentiators),
    guaranteesProof: cleanOrNull(profile.guaranteesProof),
  };
}

export async function getProfile(workspaceId: string) {
  const profile = await db.businessProfile.findUnique({
    where: { workspaceId },
    include: { samples: { orderBy: { createdAt: 'desc' } } },
  });
  return profile;
}

export async function upsertProfile(workspaceId: string, input: ProfileInput) {
  const errors = validateProfile(input);
  if (Object.keys(errors).length > 0) {
    const err = new Error('Profile validation failed') as Error & { fields?: Record<string, string>; status?: number };
    err.fields = errors;
    err.status = 400;
    throw err;
  }
  const data = toInput(input as Record<string, unknown>);
  const profile = await db.businessProfile.upsert({
    where: { workspaceId },
    update: { ...data },
    create: { workspaceId, ...data },
  });
  return profile;
}

export async function deleteProfile(workspaceId: string) {
  await db.businessProfile.delete({ where: { workspaceId } }).catch(() => null);
}

// ── Writing Samples ──────────────────────────────────────────────────────────

export type StyleSummary = {
  typicalLength?: string;
  sentenceLength?: string;
  formality?: string;
  greeting?: string;
  signOff?: string;
  punctuation?: string;
  recurringPhrases?: string[];
  avoids?: string[];
};

/** Validates a parsed style summary object (unknown shape -> null when invalid). */
export function parseStyleSummary(raw: unknown): StyleSummary | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);
  return {
    typicalLength: str(o.typicalLength),
    sentenceLength: str(o.sentenceLength),
    formality: str(o.formality),
    greeting: str(o.greeting),
    signOff: str(o.signOff),
    punctuation: str(o.punctuation),
    recurringPhrases: arr(o.recurringPhrases),
    avoids: arr(o.avoids),
  };
}

/** Extracts plain text from an uploaded file buffer. Throws on bad type/parse. */
export async function extractUploadText(fileName: string, mimeType: string, buffer: Buffer): Promise<string> {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`File is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`);
  }
  const lower = fileName.toLowerCase();
  let text: string;
  if (lower.endsWith('.txt') || mimeType === 'text/plain') {
    text = buffer.toString('utf-8');
  } else if (lower.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value || '';
  } else if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      text = (result.text || '').replace(/^-- \d+ of \d+ --$/gm, '');
    } finally {
      await parser.destroy().catch(() => null);
    }
  } else {
    throw new Error('Unsupported file type. Upload .txt, .docx, or .pdf.');
  }
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw new Error('No readable text found in this file.');
  return text;
}

export async function addSample(
  workspaceId: string,
  input: { title: string; source: 'paste' | 'upload'; content?: string; fileName?: string; mimeType?: string; contentBase64?: string },
) {
  const profile = await db.businessProfile.findUnique({ where: { workspaceId } });
  if (!profile) throw Object.assign(new Error('Create a Business Profile first.'), { status: 400 });
  const count = await db.writingSample.count({ where: { profileId: profile.id } });
  if (count >= MAX_SAMPLES) {
    throw Object.assign(new Error(`Sample limit reached (${MAX_SAMPLES} samples). Delete one to add another.`), { status: 400 });
  }
  const title = clean(input.title) || 'Untitled sample';
  let content: string;
  if (input.source === 'upload') {
    if (!input.fileName || !input.contentBase64) throw Object.assign(new Error('Upload requires a file.'), { status: 400 });
    const buffer = Buffer.from(input.contentBase64, 'base64');
    content = await extractUploadText(input.fileName, input.mimeType || '', buffer);
  } else {
    content = clean(input.content);
    if (!content) throw Object.assign(new Error('Paste some text first.'), { status: 400 });
  }
  if (content.length > MAX_SAMPLE_CHARS) {
    throw Object.assign(
      new Error(`Sample is too long (${content.length.toLocaleString()} characters; max ${MAX_SAMPLE_CHARS.toLocaleString()}).`),
      { status: 400 },
    );
  }
  const sample = await db.writingSample.create({
    data: { profileId: profile.id, title: title.slice(0, 200), content, source: input.source, approved: false },
  });
  return sample;
}

export async function updateSample(
  workspaceId: string,
  sampleId: string,
  patch: { title?: string; content?: string; styleSummary?: unknown; approved?: boolean },
) {
  const profile = await db.businessProfile.findUnique({ where: { workspaceId } });
  if (!profile) throw Object.assign(new Error('No Business Profile found.'), { status: 404 });
  const sample = await db.writingSample.findFirst({ where: { id: sampleId, profileId: profile.id } });
  if (!sample) throw Object.assign(new Error('Sample not found.'), { status: 404 });
  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = clean(patch.title).slice(0, 200) || sample.title;
  if (patch.content !== undefined) {
    const content = clean(patch.content);
    if (!content) throw Object.assign(new Error('Sample text cannot be empty.'), { status: 400 });
    if (content.length > MAX_SAMPLE_CHARS) {
      throw Object.assign(new Error(`Sample is too long (max ${MAX_SAMPLE_CHARS.toLocaleString()} characters).`), { status: 400 });
    }
    // Content changed -> the old style summary no longer describes it.
    data.content = content;
    data.styleSummary = null;
    data.approved = false;
  } else {
    // Editing the summary itself (or approving) keeps the sample usable.
    if (patch.styleSummary !== undefined) {
      const parsed = parseStyleSummary(patch.styleSummary);
      if (!parsed) throw Object.assign(new Error('Style summary is not valid.'), { status: 400 });
      data.styleSummary = parsed;
    }
    if (patch.approved !== undefined) {
      if (patch.approved && !sample.styleSummary && data.styleSummary === undefined) {
        throw Object.assign(new Error('Generate or write a style summary before approving.'), { status: 400 });
      }
      data.approved = patch.approved;
    }
  }
  return db.writingSample.update({ where: { id: sampleId }, data });
}

export async function deleteSample(workspaceId: string, sampleId: string) {
  const profile = await db.businessProfile.findUnique({ where: { workspaceId } });
  if (!profile) throw Object.assign(new Error('No Business Profile found.'), { status: 404 });
  await db.writingSample.deleteMany({ where: { id: sampleId, profileId: profile.id } });
}

/** Generates a style summary for a sample via Gemini. Null client -> clear error. */
export async function generateStyleSummary(workspaceId: string, sampleId: string) {
  const profile = await db.businessProfile.findUnique({ where: { workspaceId } });
  if (!profile) throw Object.assign(new Error('No Business Profile found.'), { status: 404 });
  const sample = await db.writingSample.findFirst({ where: { id: sampleId, profileId: profile.id } });
  if (!sample) throw Object.assign(new Error('Sample not found.'), { status: 404 });
  const { tryGetAIClient, DEFAULT_MODEL } = await import('../../../packages/ai/client.js');
  const ai = tryGetAIClient();
  if (!ai) {
    throw Object.assign(
      new Error('AI is not configured on this server (GOOGLE_AI_API_KEY is missing). The sample is saved — try generating the summary again once AI is configured.'),
      { status: 503 },
    );
  }
  const prompt = [
    'You are analyzing a writing sample to describe its STYLE ONLY. Never copy facts, prices, dates, offers, or claims from it.',
    'Return ONLY a JSON object with these keys (all strings unless noted):',
    'typicalLength (e.g. "short, about 120 words"), sentenceLength, formality (e.g. "casual", "professional"),',
    'greeting (how emails open), signOff (how emails close), punctuation (exclamation points, emojis, etc.),',
    'recurringPhrases (array of short phrases), avoids (array: what the writer avoids).',
    'Sample text:',
    sample.content.slice(0, MAX_SAMPLE_CHARS),
  ].join('\n');
  const response = await ai.models.generateContent({ model: DEFAULT_MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  const text = (response.text || '').trim();
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
  const parsed = parseStyleSummary(jsonMatch ? safeJson(jsonMatch[1]) : null);
  if (!parsed) throw Object.assign(new Error('The AI summary could not be read. Try again.'), { status: 502 });
  // Saved UNAPPROVED — the user must approve or edit it before it is used.
  return db.writingSample.update({ where: { id: sampleId }, data: { styleSummary: parsed, approved: false } });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
