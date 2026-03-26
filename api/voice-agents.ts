import { Router } from 'express';
import Retell from 'retell-sdk';
import { db } from '../src/lib/db.js';

const router = Router();

// Initialize Retell SDK
// Fallback to a placeholder simply to allow the UI to render correctly without crashing
// if the user has not placed their key yet.
const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY || 'RETELL_KEY_MISSING',
});

// Map frontend voice names to Retell Voice IDs
// These are platform (native) voices which should be available without 11labs account
const VOICE_MAP: Record<string, string> = {
  'Rachel': 'retell-Sloane',
  'Rachel (American, Female)': 'retell-Sloane',
  'Drew': 'retell-Merritt',
  'Drew (American, Male)': 'retell-Merritt',
  'Mimik': 'retell-Maren',
  'Mimik (British, Female)': 'retell-Maren',
};

// Create a new WebRTC web call session and exchange auth tokens
router.post('/web-call', async (req, res) => {
  try {
    const {
      systemPrompt, voiceId, llmModel, welcomeMessage,
      interruptionSensitivity, ambientSound, language, responsiveness,
      voiceSpeed, startSpeaker, pauseBeforeSpeaking,
      enableSpeechNormalization, denoisingMode, sttMode, vocabSpecialization,
      boostedKeywords, enableVoicemailDetection, voicemailMessage,
      enableDynamicResponsiveness, allowUserDtmf, endCallAfterSilenceSec,
      enableBackchannel, backchanelFrequency,
    } = req.body;

    if (!process.env.RETELL_API_KEY) {
      throw new Error('RETELL_API_KEY is not configured in .env');
    }

    // Map frontend model display names to Retell SDK model enums
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

    // 1. Create a dynamic Retell LLM
    const llm = await retell.llm.create({
      general_prompt: systemPrompt || "You are a helpful assistant.",
      begin_message: welcomeMessage || null,
      model: (MODEL_MAP[llmModel] || 'gemini-2.5-flash') as any,
      start_speaker: startSpeaker === 'user' ? 'user' : 'agent',
    });

    // 2. Build ambient sound value
    const AMBIENT_MAP: Record<string, string | null> = {
      'none': null as any, 'coffee-shop': 'coffee-shop',
      'convention-hall': 'convention-hall', 'summer-outdoor': 'summer-outdoor',
      'mountain-outdoor': 'mountain-outdoor', 'static-noise': 'static-noise',
      'call-center': 'call-center',
    };

    // 3. Parse boosted keywords
    const parsedKeywords = boostedKeywords
      ? boostedKeywords.split(',').map((k: string) => k.trim()).filter(Boolean)
      : null;

    // 4. Create a dynamic Retell Agent with ALL parameters
    const resolvedVoiceId = voiceId || VOICE_MAP['Rachel'] || 'retell-Sloane';

    const agentParams: any = {
      agent_name: 'Test Agent (Stone AIO)',
      response_engine: { llm_id: llm.llm_id, type: 'retell-llm' as const },
      voice_id: resolvedVoiceId,
      language: language || 'en-US',
      voice_speed: voiceSpeed || 1.0,
      interruption_sensitivity: interruptionSensitivity ?? 0.81,
      responsiveness: responsiveness ?? 1.0,
      enable_dynamic_responsiveness: enableDynamicResponsiveness || false,
      normalize_for_speech: enableSpeechNormalization || false,
      ambient_sound: AMBIENT_MAP[ambientSound] ?? null,
      allow_user_dtmf: allowUserDtmf ?? true,
    };

    // Optional params — only include if provided
    if (denoisingMode) agentParams.denoising_mode = denoisingMode;
    if (sttMode) agentParams.stt_mode = sttMode;
    if (vocabSpecialization) agentParams.vocab_specialization = vocabSpecialization;
    if (parsedKeywords?.length) agentParams.boosted_keywords = parsedKeywords;
    if (enableVoicemailDetection) agentParams.enable_voicemail_detection = true;
    if (voicemailMessage) agentParams.voicemail_message = voicemailMessage;
    if (pauseBeforeSpeaking > 0) agentParams.begin_message_delay_ms = pauseBeforeSpeaking;
    if (endCallAfterSilenceSec) agentParams.end_call_after_silence_ms = endCallAfterSilenceSec * 1000;
    if (enableBackchannel) agentParams.enable_backchannel = true;
    if (backchanelFrequency) agentParams.backchannel_frequency = backchanelFrequency;

    const agent = await retell.agent.create(agentParams);

    // 5. Create the Web Call
    const webCallResponse = await retell.call.createWebCall({
      agent_id: agent.agent_id,
    });

    res.json({
      accessToken: webCallResponse.access_token,
      callId: webCallResponse.call_id,
      agentId: agent.agent_id,
      llmId: llm.llm_id,
    });
  } catch (error: any) {
    console.error('[Retell] Error creating web call:', error.message);
    res.status(500).json({ error: error.message || 'Failed to create web call' });
  }
});

// ── Voice Library Endpoints ──

// List all available voices
router.get('/voices', async (_req, res) => {
  try {
    const voices = await retell.voice.list();
    res.json(voices);
  } catch (error: any) {
    console.error('[Retell] Error listing voices:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Search community voices
router.post('/voices/search', async (req, res) => {
  try {
    const { search_query, voice_provider } = req.body;
    const results = await retell.voice.search({
      search_query: search_query || '',
      voice_provider,
    });
    res.json(results);
  } catch (error: any) {
    console.error('[Retell] Error searching voices:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Add a community voice to library
router.post('/voices/add', async (req, res) => {
  try {
    const { provider_voice_id, voice_name, voice_provider, public_user_id } = req.body;
    const voice = await retell.voice.addResource({
      provider_voice_id,
      voice_name,
      voice_provider,
      public_user_id,
    });
    res.json(voice);
  } catch (error: any) {
    console.error('[Retell] Error adding voice:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
