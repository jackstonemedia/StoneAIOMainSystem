/**
 * Voice Agents Service — wraps Retell SDK calls for voice agent management.
 * Keeps all Retell-specific logic in one place, away from route handlers.
 */
import Retell from 'retell-sdk';

// ── Singleton Retell client ───────────────────────────────────────────────────
// Initialised lazily so missing keys don't crash imports.

let _retell: Retell | null = null;

export function getRetellClient(): Retell {
  if (!_retell) {
    if (!process.env.RETELL_API_KEY) {
      throw new Error('RETELL_API_KEY is not configured in environment variables');
    }
    _retell = new Retell({ apiKey: process.env.RETELL_API_KEY });
  }
  return _retell;
}

// ── Voice maps ────────────────────────────────────────────────────────────────

const VOICE_MAP: Record<string, string> = {
  Rachel: 'retell-Sloane',
  'Rachel (American, Female)': 'retell-Sloane',
  Drew: 'retell-Merritt',
  'Drew (American, Male)': 'retell-Merritt',
  Mimik: 'retell-Maren',
  'Mimik (British, Female)': 'retell-Maren',
};

const MODEL_MAP: Record<string, string> = {
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-3.0-flash': 'gemini-3.0-flash',
  'gpt-4.1': 'gpt-4.1',
  'gpt-4.1-mini': 'gpt-4.1-mini',
  'gpt-5': 'gpt-5',
  'gpt-5-mini': 'gpt-5-mini',
  'claude-4.5-sonnet': 'claude-4.5-sonnet',
  'claude-4.6-sonnet': 'claude-4.6-sonnet',
  'claude-4.5-haiku': 'claude-4.5-haiku',
};

const AMBIENT_MAP: Record<string, string | null> = {
  none: null,
  'coffee-shop': 'coffee-shop',
  'convention-hall': 'convention-hall',
  'summer-outdoor': 'summer-outdoor',
  'mountain-outdoor': 'mountain-outdoor',
  'static-noise': 'static-noise',
  'call-center': 'call-center',
};

// ── Web Call ──────────────────────────────────────────────────────────────────

export interface WebCallParams {
  systemPrompt?: string;
  voiceId?: string;
  llmModel?: string;
  welcomeMessage?: string;
  interruptionSensitivity?: number;
  ambientSound?: string;
  language?: string;
  responsiveness?: number;
  voiceSpeed?: number;
  startSpeaker?: string;
  pauseBeforeSpeaking?: number;
  enableSpeechNormalization?: boolean;
  denoisingMode?: string;
  sttMode?: string;
  vocabSpecialization?: string;
  boostedKeywords?: string;
  enableVoicemailDetection?: boolean;
  voicemailMessage?: string;
  enableDynamicResponsiveness?: boolean;
  allowUserDtmf?: boolean;
  endCallAfterSilenceSec?: number;
  enableBackchannel?: boolean;
  backchanelFrequency?: number;
}

export async function createWebCall(params: WebCallParams) {
  const retell = getRetellClient();

  const llm = await retell.llm.create({
    general_prompt: params.systemPrompt ?? 'You are a helpful assistant.',
    begin_message: params.welcomeMessage ?? null,
    model: (MODEL_MAP[params.llmModel ?? ''] ?? 'gemini-2.5-flash') as any,
    start_speaker: params.startSpeaker === 'user' ? 'user' : 'agent',
  });

  const resolvedVoiceId = params.voiceId ?? VOICE_MAP['Rachel'] ?? 'retell-Sloane';
  const parsedKeywords = params.boostedKeywords
    ? params.boostedKeywords.split(',').map((k) => k.trim()).filter(Boolean)
    : null;

  const agentParams: any = {
    agent_name: 'Test Agent (Stone AIO)',
    response_engine: { llm_id: llm.llm_id, type: 'retell-llm' as const },
    voice_id: resolvedVoiceId,
    language: params.language ?? 'en-US',
    voice_speed: params.voiceSpeed ?? 1.0,
    interruption_sensitivity: params.interruptionSensitivity ?? 0.81,
    responsiveness: params.responsiveness ?? 1.0,
    enable_dynamic_responsiveness: params.enableDynamicResponsiveness ?? false,
    normalize_for_speech: params.enableSpeechNormalization ?? false,
    ambient_sound: AMBIENT_MAP[params.ambientSound ?? 'none'] ?? null,
    allow_user_dtmf: params.allowUserDtmf ?? true,
  };

  if (params.denoisingMode) agentParams.denoising_mode = params.denoisingMode;
  if (params.sttMode) agentParams.stt_mode = params.sttMode;
  if (params.vocabSpecialization) agentParams.vocab_specialization = params.vocabSpecialization;
  if (parsedKeywords?.length) agentParams.boosted_keywords = parsedKeywords;
  if (params.enableVoicemailDetection) agentParams.enable_voicemail_detection = true;
  if (params.voicemailMessage) agentParams.voicemail_message = params.voicemailMessage;
  if (params.pauseBeforeSpeaking && params.pauseBeforeSpeaking > 0) {
    agentParams.begin_message_delay_ms = params.pauseBeforeSpeaking;
  }
  if (params.endCallAfterSilenceSec) {
    agentParams.end_call_after_silence_ms = params.endCallAfterSilenceSec * 1000;
  }
  if (params.enableBackchannel) agentParams.enable_backchannel = true;
  if (params.backchanelFrequency) agentParams.backchannel_frequency = params.backchanelFrequency;

  const agent = await retell.agent.create(agentParams);
  const webCallResponse = await retell.call.createWebCall({ agent_id: agent.agent_id });

  return {
    accessToken: webCallResponse.access_token,
    callId: webCallResponse.call_id,
    agentId: agent.agent_id,
    llmId: llm.llm_id,
  };
}

// ── Voice Library ─────────────────────────────────────────────────────────────

export async function listVoices() {
  return getRetellClient().voice.list();
}

export async function searchVoices(searchQuery: string, voiceProvider?: 'elevenlabs' | 'cartesia' | 'minimax' | 'fish_audio') {
  return getRetellClient().voice.search({ search_query: searchQuery, voice_provider: voiceProvider });
}

export async function addVoice(params: {
  provider_voice_id: string;
  voice_name: string;
  voice_provider: string;
  public_user_id?: string;
}) {
  return getRetellClient().voice.addResource(params as any);
}
