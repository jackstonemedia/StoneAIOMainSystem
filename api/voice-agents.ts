/**
 * Voice Agents API Router — thin HTTP controller layer.
 * All SDK logic is delegated to api/services/voice.service.ts.
 */
import { Router } from 'express';
import * as voiceService from './services/voice.service.js';

const router = Router();

// ── Web Calls ─────────────────────────────────────────────────────────────────

router.post('/web-call', async (req, res) => {
  try {
    const result = await voiceService.createWebCall(req.body);
    res.json(result);
  } catch (error: any) {
    console.error('[Retell] Error creating web call:', error.message);
    res.status(500).json({ error: error.message || 'Failed to create web call' });
  }
});

// ── Voice Library ─────────────────────────────────────────────────────────────

router.get('/voices', async (_req, res) => {
  try {
    const voices = await voiceService.listVoices();
    res.json(voices);
  } catch (error: any) {
    console.error('[Retell] Error listing voices:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/voices/search', async (req, res) => {
  try {
    const { search_query, voice_provider } = req.body;
    const results = await voiceService.searchVoices(search_query || '', voice_provider);
    res.json(results);
  } catch (error: any) {
    console.error('[Retell] Error searching voices:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/voices/add', async (req, res) => {
  try {
    const { provider_voice_id, voice_name, voice_provider, public_user_id } = req.body;
    const voice = await voiceService.addVoice({
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
