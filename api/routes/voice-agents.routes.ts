/**
 * Voice Agents API Router — thin HTTP controller layer.
 * All SDK logic is delegated to api/services/voice.service.ts.
 */
import { Router } from 'express';
import * as voiceService from '../services/voice.service.js';
import { emitTrigger } from '../services/trigger-emitter.service.js';

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
    const voice = await voiceService.addVoice({ provider_voice_id, voice_name, voice_provider, public_user_id });
    res.json(voice);
  } catch (error: any) {
    console.error('[Retell] Error adding voice:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Webhooks ──────────────────────────────────────────────────────────────────

router.post('/webhook', async (req, res) => {
  try {
    const { event, call } = req.body;
    const workspaceId = call?.metadata?.workspaceId || req.workspaceId;

    if (event === 'call_started') {
      emitTrigger(workspaceId, 'agent.call_started', {
        callId: call?.call_id,
        agentId: call?.agent_id,
        contactPhone: call?.to_number,
        startedAt: new Date().toISOString(),
      }).catch(console.error);
    } else if (event === 'call_ended') {
      emitTrigger(workspaceId, 'agent.call_ended', {
        callId: call?.call_id,
        agentId: call?.agent_id,
        contactPhone: call?.to_number,
        duration: call?.duration_ms,
        transcript: call?.transcript,
        summary: call?.call_analysis?.call_summary,
        sentiment: call?.call_analysis?.user_sentiment,
        endedAt: new Date().toISOString(),
      }).catch(console.error);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Retell] Webhook error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
