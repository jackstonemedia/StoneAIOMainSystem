import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Bot, Volume2, Mic, PhoneOff, Globe,
  Shield, ChevronDown, Headphones, BarChart3, Webhook, Puzzle,
  Brain, PhoneCall
} from 'lucide-react';
import VoicePickerModal from '../components/voice/VoicePickerModal';
import VoiceSettingsPanel from '../components/voice/VoiceSettingsPanel';
import { VoiceBuilderProvider, useVoiceBuilder } from '../context/VoiceBuilderContext';
import { useToast } from '../components/ui/Toast';

const SETTINGS_TABS = [
  { id: 'voice', label: 'Voice & Speech', icon: Volume2, color: 'text-teal' },
  { id: 'behavior', label: 'AI Behavior', icon: Brain, color: 'text-purple' },
  { id: 'transcription', label: 'Transcription', icon: Headphones, color: 'text-text-muted' },
  { id: 'call', label: 'Call Controls', icon: PhoneCall, color: 'text-green' },
  { id: 'analysis', label: 'Analytics', icon: BarChart3, color: 'text-amber' },
  { id: 'security', label: 'Security', icon: Shield, color: 'text-red' },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, color: 'text-text-muted0' },
  { id: 'tools', label: 'Tools & MCPs', icon: Puzzle, color: 'text-light-purple' },
] as const;

function VoiceAgentBuilderInner() {
  const ctx = useVoiceBuilder();
  const { id: agentId } = useParams<{ id: string }>();
  const { toast } = useToast();
  // Keep a stable ref to the retell client so cleanup doesn't re-run on every render
  const retellRef = ctx.retellClientRef;

  // Load existing agent config when editing
  useEffect(() => {
    if (!agentId) return;
    fetch(`/api/agents/${agentId}`)
      .then(r => r.ok ? r.json() : null)
      .then((agent: any) => {
        if (!agent) return;
        if (agent.name) ctx.setAgentName(agent.name);
        const cfg = typeof agent.config === 'object' ? agent.config : {};
        if (cfg.llmModel)               ctx.setLlmModel(cfg.llmModel);
        if (cfg.voiceId)                ctx.setVoiceId(cfg.voiceId);
        if (cfg.voiceProfile)           ctx.setVoiceProfile(cfg.voiceProfile);
        if (cfg.language)               ctx.setLanguage(cfg.language);
        if (cfg.systemPrompt)           ctx.setSystemPrompt(cfg.systemPrompt);
        if (cfg.welcomeMessage)         ctx.setWelcomeMessage(cfg.welcomeMessage);
        if (cfg.startSpeaker)           ctx.setStartSpeaker(cfg.startSpeaker);
        if (cfg.ambientSound)           ctx.setAmbientSound(cfg.ambientSound);
        if (cfg.responsiveness != null) ctx.setResponsiveness(cfg.responsiveness);
        if (cfg.interruptionSensitivity != null) ctx.setInterruptionSensitivity(cfg.interruptionSensitivity);
        if (cfg.webhookUrl)             ctx.setWebhookUrl(cfg.webhookUrl);
      })
      .catch(() => {}); // silently ignore load errors
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    const client = retellRef.current;
    if (!client) return;
    client.on('call_started', () => { ctx.setIsTestCallActive(true); ctx.setCallDuration(0); });
    client.on('call_ended', () => { ctx.setIsTestCallActive(false); });
    client.on('error', (error: any) => { console.error('Retell error:', error); ctx.setIsTestCallActive(false); });
    // Only stop the call when the component actually unmounts
    return () => { retellRef.current?.stopCall(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retellRef]);

  useEffect(() => {
    if (!ctx.isTestCallActive) return;
    const interval = setInterval(() => ctx.setCallDuration((prev: number) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [ctx.isTestCallActive, ctx.setCallDuration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTestCall = async () => {
    if (ctx.isTestCallActive) { ctx.retellClientRef.current?.stopCall(); return; }
    ctx.setIsProvisioning(true);
    try {
      const res = await fetch('/api/voice-agents/web-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: ctx.systemPrompt, voiceId: ctx.voiceId, llmModel: ctx.llmModel, 
          welcomeMessage: ctx.welcomeMessage, interruptionSensitivity: ctx.interruptionSensitivity, 
          ambientSound: ctx.ambientSound, language: ctx.language, responsiveness: ctx.responsiveness,
          voiceSpeed: 1.0, startSpeaker: ctx.startSpeaker, pauseBeforeSpeaking: ctx.pauseBeforeSpeaking,
          enableSpeechNormalization: ctx.enableSpeechNormalization, denoisingMode: ctx.denoisingMode, 
          sttMode: ctx.sttMode, vocabSpecialization: ctx.vocabSpecialization,
          boostedKeywords: ctx.boostedKeywords, enableVoicemailDetection: ctx.enableVoicemailDetection, 
          voicemailMessage: ctx.voicemailMessage, enableDynamicResponsiveness: ctx.enableDynamicResponsiveness, 
          allowUserDtmf: ctx.allowUserDtmf, endCallAfterSilenceSec: ctx.endCallAfterSilenceSec,
        })
      });
      const data = await res.json();
      if (data.accessToken) {
        ctx.retellClientRef.current?.startCall({ accessToken: data.accessToken }).catch((err: any) => console.error("WebRTC SDK Error:", err));
      } else { alert(`Retell Error: ${data.error}`); }
    } catch (e) { console.error("Network error:", e); }
    finally { ctx.setIsProvisioning(false); }
  };

  const handleDeploy = async () => {
    ctx.setIsSaving(true); ctx.setSaveStatus('idle');
    try {
      const configPayload = JSON.stringify({
        llmModel: ctx.llmModel, voiceId: ctx.voiceId, voiceProfile: ctx.voiceProfile,
        language: ctx.language, systemPrompt: ctx.systemPrompt, welcomeMessage: ctx.welcomeMessage,
        startSpeaker: ctx.startSpeaker, pauseBeforeSpeaking: ctx.pauseBeforeSpeaking,
        ambientSound: ctx.ambientSound, ambientSoundVolume: ctx.ambientSoundVolume,
        responsiveness: ctx.responsiveness, enableDynamicResponsiveness: ctx.enableDynamicResponsiveness,
        interruptionSensitivity: ctx.interruptionSensitivity, enableSpeechNormalization: ctx.enableSpeechNormalization,
        reminderTriggerSec: ctx.reminderTriggerSec, reminderMaxCount: ctx.reminderMaxCount,
        denoisingMode: ctx.denoisingMode, sttMode: ctx.sttMode, vocabSpecialization: ctx.vocabSpecialization,
        boostedKeywords: ctx.boostedKeywords, enableVoicemailDetection: ctx.enableVoicemailDetection,
        voicemailResponse: ctx.voicemailResponse, voicemailMessage: ctx.voicemailMessage,
        enableIvrHangup: ctx.enableIvrHangup, allowUserDtmf: ctx.allowUserDtmf,
        dtmfTimeout: ctx.dtmfTimeout, dtmfTerminationKey: ctx.dtmfTerminationKey,
        dtmfDigitLimit: ctx.dtmfDigitLimit, endCallAfterSilenceSec: ctx.endCallAfterSilenceSec,
        postCallAnalysisModel: ctx.postCallAnalysisModel, postCallFields: ctx.postCallFields,
        dataStorageSetting: ctx.dataStorageSetting, dataRetention: ctx.dataRetention,
        optInSignedUrl: ctx.optInSignedUrl, fallbackVoiceMode: ctx.fallbackVoiceMode,
        webhookUrl: ctx.webhookUrl, webhookTimeoutSec: ctx.webhookTimeoutSec, functions: ctx.functions,
      });

      const method = agentId ? 'PUT' : 'POST';
      const url = agentId ? `/api/agents/${agentId}` : '/api/agents';
      const body = agentId
        ? JSON.stringify({ name: ctx.agentName, status: 'active', config: configPayload })
        : JSON.stringify({ name: ctx.agentName, type: 'voice', status: 'active', config: configPayload });

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body });
      if (res.ok) {
        ctx.setSaveStatus('saved');
        toast('success', agentId ? 'Voice agent updated' : 'Voice agent published!');
        setTimeout(() => ctx.setSaveStatus('idle'), 3000);
      } else {
        throw new Error('Server error');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      toast('error', 'Failed to publish voice agent');
    } finally { ctx.setIsSaving(false); }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-transparent text-text-main font-sans overflow-hidden">
      {/* ══════ TOPBAR ══════ */}
      <header className="h-14 border-b border-border/50 bg-surface/40 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/agents" className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-md transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-teal flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <input type="text" value={ctx.agentName} onChange={(e) => ctx.setAgentName(e.target.value)}
              className="font-semibold text-sm bg-transparent border-none focus:outline-none hover:bg-surface-hover px-2 py-1 rounded w-64" />
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-teal bg-teal/10 border border-teal/20">Voice</span>
        </div>
        <div className="flex items-center gap-3">
          {ctx.saveStatus === 'saved' && (
            <span className="text-xs text-green flex items-center gap-1 animate-fade-up"><Save className="w-3 h-3" /> Published</span>
          )}
          <button onClick={handleDeploy} disabled={ctx.isSaving}
            className="bg-gradient-to-r from-primary to-primary-hover text-white px-5 py-1.5 rounded-lg text-xs font-bold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50">
            {ctx.isSaving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ══════ LEFT: SETTINGS PANEL ══════ */}
        <aside className="w-[420px] border-r border-border/50 bg-surface/40 backdrop-blur-xl flex shrink-0 overflow-hidden shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10">
          <nav className="w-16 border-r border-border/50 bg-surface/60 flex flex-col items-center py-4 gap-2 shrink-0">
            {SETTINGS_TABS.map(tab => (
              <button key={tab.id} onClick={() => ctx.setActiveTab(tab.id)}
                title={tab.label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group ${
                  ctx.activeTab === tab.id
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}>
                {ctx.activeTab === tab.id && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <tab.icon className="w-4 h-4" />
                <span className="absolute left-12 px-2 py-1 bg-surface border border-border rounded-md text-[10px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-30 shadow-lg">
                  {tab.label}
                </span>
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-bold">{SETTINGS_TABS.find(t => t.id === ctx.activeTab)?.label}</h2>
            </div>
            <div className="p-4">
              <VoiceSettingsPanel />
            </div>
          </div>
        </aside>

        {/* ══════ RIGHT: PROMPT EDITOR ══════ */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="flex items-center gap-3 px-8 py-4 border-b border-border/50 bg-surface/30 backdrop-blur-md flex-wrap z-10 shadow-sm">
            <div className="flex items-center gap-2 bg-bg/60 backdrop-blur-md border border-border/50 rounded-xl px-3 py-2 shadow-sm hover:border-primary/30 transition-colors">
              <select value={ctx.llmModel} onChange={(e) => ctx.setLlmModel(e.target.value)}
                className="bg-transparent text-xs font-medium focus:outline-none appearance-none pr-4 cursor-pointer">
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-3.0-flash">Gemini 3.0 Flash</option>
                <option value="gpt-4.1">GPT-4.1</option>
                <option value="claude-4.5-sonnet">Claude 4.5 Sonnet</option>
              </select>
            </div>

            <button onClick={() => ctx.setShowVoicePicker(true)}
              className="flex items-center gap-1.5 bg-bg border border-border rounded-lg px-2.5 py-1.5 hover:border-primary/50 transition-colors">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
              <span className="text-xs font-medium">{ctx.voiceProfile}</span>
              <ChevronDown className="w-3 h-3 text-text-muted" />
            </button>

            <div className="flex items-center gap-1.5 bg-bg border border-border rounded-lg px-2.5 py-1.5">
              <Globe className="w-3.5 h-3.5 text-text-muted" />
              <select value={ctx.language} onChange={(e) => ctx.setLanguage(e.target.value)}
                className="bg-transparent text-xs font-medium focus:outline-none appearance-none pr-4 cursor-pointer">
                <option value="en-US">English</option>
                <option value="es-ES">Spanish</option>
              </select>
            </div>
            <span className="text-xs text-text-muted ml-auto font-mono bg-surface/50 px-2 py-1 rounded-md">{ctx.systemPrompt.length} chars</span>
          </div>

          <div className="flex-1 overflow-y-auto p-8 pb-32 z-10 w-full mb-20 relative">
            <div className="max-w-4xl mx-auto h-full flex flex-col gap-6 relative">
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest block mb-3 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" /> System Prompt
                </label>
                <textarea value={ctx.systemPrompt} onChange={(e) => ctx.setSystemPrompt(e.target.value)}
                  className="flex-1 w-full min-h-[500px] bg-surface/40 backdrop-blur-xl border border-border/60 rounded-2xl p-6 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-surface/60 resize-none font-mono shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-all"
                  placeholder="Enter your system prompt..." />
              </div>

              <div className="shrink-0 flex flex-col mt-4">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest block mb-3 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-teal" /> Welcome Message
                </label>
                <textarea value={ctx.welcomeMessage} onChange={(e) => ctx.setWelcomeMessage(e.target.value)}
                  rows={4}
                  className="w-full bg-surface/40 backdrop-blur-xl border border-border/60 rounded-2xl p-6 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-surface/60 resize-y shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-all" />
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ══════ BOTTOM: TEST CALL DOCK ══════ */}
      <div className="absolute bottom-0 left-0 right-0 h-20 border-t border-border/40 bg-surface/60 backdrop-blur-2xl flex items-center justify-between px-8 z-30 shadow-[0_-8px_32px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${ctx.isTestCallActive ? 'bg-green pulse-dot' : 'bg-border'}`} />
            <span className="text-xs font-medium">{ctx.isTestCallActive ? 'Call Active' : 'Ready to test'}</span>
          </div>
          {ctx.isTestCallActive && (
            <span className="text-xs font-mono text-text-muted bg-bg px-2 py-0.5 rounded border border-border">{formatTime(ctx.callDuration)}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {ctx.isTestCallActive ? (
            <button onClick={toggleTestCall}
              className="flex items-center gap-2 px-6 py-2 bg-red/10 text-red border border-red/20 rounded-xl text-sm font-bold hover:bg-red/20 transition-colors">
              <PhoneOff className="w-4 h-4" /> End Call
            </button>
          ) : (
            <button onClick={toggleTestCall} disabled={ctx.isProvisioning}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary to-teal text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 glow-primary">
              {ctx.isProvisioning ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Connecting...</>
              ) : (
                <><Mic className="w-4 h-4" /> Test Call</>
              )}
            </button>
          )}
        </div>
      </div>

      <VoicePickerModal isOpen={ctx.showVoicePicker} onClose={() => ctx.setShowVoicePicker(false)}
        selectedVoiceId={ctx.voiceId}
        onSelect={(id, name) => { ctx.setVoiceId(id); ctx.setVoiceProfile(name); ctx.setShowVoicePicker(false); }} />
    </div>
  );
}

export default function VoiceAgentBuilder() {
  return (
    <VoiceBuilderProvider>
      <VoiceAgentBuilderInner />
    </VoiceBuilderProvider>
  );
}
