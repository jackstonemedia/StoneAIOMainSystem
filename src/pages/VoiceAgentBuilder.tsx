import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { RetellWebClient } from 'retell-client-js-sdk';
import {
  ArrowLeft, Save, Bot, Volume2, Mic, Play, Phone, PhoneOff, Settings, Globe, Music,
  Code, Shield, ChevronDown, Headphones, BookOpen, Zap, BarChart3, Webhook, Puzzle,
  Plus, Pencil, Trash2, Brain, PhoneCall, Link as LinkIcon, MessageSquare
} from 'lucide-react';
import SliderField from '../components/voice/SliderField';
import ToggleField from '../components/voice/ToggleField';
import RadioGroup from '../components/voice/RadioGroup';
import TagsInput from '../components/voice/TagsInput';
import VoicePickerModal from '../components/voice/VoicePickerModal';

// ── Settings tab definitions ──
const SETTINGS_TABS = [
  { id: 'voice', label: 'Voice & Speech', icon: Volume2, color: 'text-teal' },
  { id: 'behavior', label: 'AI Behavior', icon: Brain, color: 'text-purple' },
  { id: 'transcription', label: 'Transcription', icon: Headphones, color: 'text-blue-400' },
  { id: 'call', label: 'Call Controls', icon: PhoneCall, color: 'text-green' },
  { id: 'analysis', label: 'Analytics', icon: BarChart3, color: 'text-amber' },
  { id: 'security', label: 'Security', icon: Shield, color: 'text-red' },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, color: 'text-pink-500' },
  { id: 'tools', label: 'Tools & MCPs', icon: Puzzle, color: 'text-light-purple' },
] as const;

export default function VoiceAgentBuilder() {
  // ── Call State ──
  const [isTestCallActive, setIsTestCallActive] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const retellClientRef = useRef<RetellWebClient | null>(null);

  // ── Navigation ──
  const [activeTab, setActiveTab] = useState('voice');
  const [showVoicePicker, setShowVoicePicker] = useState(false);

  // ── Save State ──
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // ── Core Settings ──
  const [agentName, setAgentName] = useState('Nova — Inbound Sales');
  const [llmModel, setLlmModel] = useState('gemini-2.5-flash');
  const [voiceProfile, setVoiceProfile] = useState('Hailey');
  const [voiceId, setVoiceId] = useState('11labs-Hailey');
  const [language, setLanguage] = useState('en-US');
  const [systemPrompt, setSystemPrompt] = useState(`Use down speak when speaking normally and ending sentences. Only use up speak when asking questions.

# ROLE & CORE DIRECTIVE

You are Nova, the 24/7 receptionist for Stone AIO. You are a real, professional human having a business conversation. Your goal is to sell Stone AIO's AI receptionist service by *demonstrating* excellence—you ARE the product. Let the experience sell itself; never pitch technical features.

Don't repeat the same value points when selling yourself, ask new questions that discover new pain points and introduce new value in return.

# VOCAL DELIVERY (CRITICAL)

- Voice: Calm, confident, warm, natural. Allow small imperfections (brief pauses, "um") to sound human. Never scripted, bubbly, or robotic.
- Volume: Maintain IDENTICAL volume from start to finish. Never get louder for emphasis or quieter during pauses.
- Tone: Use downspeak (falling tone) for statements, commands, and confirmations to show confidence. Use upspeak (rising tone) ONLY for questions.
- Pacing: Steady and continuous. Respond immediately (under 2s). Bridge thoughts naturally ("So," "And," "Actually"). NEVER interrupt the caller.

# CALL STRUCTURE & SCRIPTING

1. Opening (MANDATORY EXACT PHRASE):
2. Name Capture: Ask naturally within the first 60 seconds ("By the way, who am I speaking with?"). Use their name sparingly moving forward.
3. Discovery: Ask one conversational question at a time to uncover pain points (missed calls, after-hours overhead, lost leads). Connect problems to impact casually ("Most businesses are surprised how much that adds up"). Never sound pushy.
4. Live Demo: When requested:
  - Ask for their business name and what type of call to reenact.`);
  const [startSpeaker, setStartSpeaker] = useState('agent');
  const [pauseBeforeSpeaking, setPauseBeforeSpeaking] = useState(0);
  const [welcomeMessage, setWelcomeMessage] = useState("Hey There! I'm Nova! Stone AIO's businesses AI assistant! I can act as a receptionist for your business or answer any questions you have about our services!");

  // ── Voice & Speech ──
  const [ambientSound, setAmbientSound] = useState('none');
  const [ambientSoundVolume, setAmbientSoundVolume] = useState(1.0);
  const [responsiveness, setResponsiveness] = useState(1.0);
  const [enableDynamicResponsiveness, setEnableDynamicResponsiveness] = useState(false);
  const [interruptionSensitivity, setInterruptionSensitivity] = useState(0.81);
  const [enableSpeechNormalization, setEnableSpeechNormalization] = useState(false);
  const [reminderTriggerSec, setReminderTriggerSec] = useState(10);
  const [reminderMaxCount, setReminderMaxCount] = useState(1);

  // ── Transcription ──
  const [denoisingMode, setDenoisingMode] = useState('noise-cancellation');
  const [sttMode, setSttMode] = useState('fast');
  const [vocabSpecialization, setVocabSpecialization] = useState('general');
  const [boostedKeywords, setBoostedKeywords] = useState('');

  // ── Call Controls ──
  const [enableVoicemailDetection, setEnableVoicemailDetection] = useState(true);
  const [voicemailResponse, setVoicemailResponse] = useState('hangup');
  const [voicemailMessage, setVoicemailMessage] = useState('');
  const [enableIvrHangup, setEnableIvrHangup] = useState(false);
  const [allowUserDtmf, setAllowUserDtmf] = useState(true);
  const [dtmfTimeout, setDtmfTimeout] = useState(2.5);
  const [dtmfTerminationKey, setDtmfTerminationKey] = useState(false);
  const [dtmfDigitLimit, setDtmfDigitLimit] = useState(false);
  const [endCallAfterSilenceSec, setEndCallAfterSilenceSec] = useState(30);

  // ── Analytics ──
  const [postCallAnalysisModel, setPostCallAnalysisModel] = useState('gpt-4.1-mini');
  const [postCallFields, setPostCallFields] = useState([
    { name: 'Call Summary', type: 'string', enabled: true },
    { name: 'Call Successful', type: 'boolean', enabled: true },
    { name: 'User Sentiment', type: 'enum', enabled: true },
    { name: 'Name', type: 'string', enabled: true },
    { name: 'Business Name', type: 'string', enabled: true },
    { name: 'Phone Number', type: 'string', enabled: true },
    { name: 'Email', type: 'string', enabled: true },
  ]);

  // ── Security ──
  const [dataStorageSetting, setDataStorageSetting] = useState('everything');
  const [dataRetention, setDataRetention] = useState('forever');
  const [optInSignedUrl, setOptInSignedUrl] = useState(false);
  const [fallbackVoiceMode, setFallbackVoiceMode] = useState('automatic');

  // ── Webhooks ──
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookTimeoutSec, setWebhookTimeoutSec] = useState(5);

  // ── Tools/Functions ──
  const [functions, setFunctions] = useState([
    { name: 'send_lead', description: 'Sends qualified lead data to CRM' }
  ]);

  // ── WebRTC Lifecycle ──
  useEffect(() => {
    retellClientRef.current = new RetellWebClient();
    const client = retellClientRef.current;
    client.on('call_started', () => { setIsTestCallActive(true); setCallDuration(0); });
    client.on('call_ended', () => { setIsTestCallActive(false); });
    client.on('error', (error: any) => { console.error('Retell WebClient error:', error); setIsTestCallActive(false); });
    return () => { client.stopCall(); };
  }, []);

  useEffect(() => {
    if (!isTestCallActive) return;
    const interval = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isTestCallActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTestCall = async () => {
    if (isTestCallActive) { retellClientRef.current?.stopCall(); return; }
    setIsProvisioning(true);
    try {
      const res = await fetch('/api/voice-agents/web-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt, voiceId, llmModel, welcomeMessage,
          interruptionSensitivity, ambientSound, language, responsiveness,
          voiceSpeed: 1.0, startSpeaker, pauseBeforeSpeaking,
          enableSpeechNormalization, denoisingMode, sttMode, vocabSpecialization,
          boostedKeywords, enableVoicemailDetection, voicemailMessage,
          enableDynamicResponsiveness, allowUserDtmf, endCallAfterSilenceSec,
        })
      });
      const data = await res.json();
      if (data.accessToken) {
        retellClientRef.current?.startCall({ accessToken: data.accessToken }).catch(err => console.error("WebRTC SDK Error:", err));
      } else { alert(`Retell Error: ${data.error}`); }
    } catch (e) { console.error("Network error:", e); }
    finally { setIsProvisioning(false); }
  };

  const handleDeploy = async () => {
    setIsSaving(true); setSaveStatus('idle');
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentName, type: 'voice', status: 'active',
          config: JSON.stringify({
            llmModel, voiceId, voiceProfile, language, systemPrompt, welcomeMessage,
            startSpeaker, pauseBeforeSpeaking, ambientSound, ambientSoundVolume,
            responsiveness, enableDynamicResponsiveness, interruptionSensitivity,
            enableSpeechNormalization, reminderTriggerSec, reminderMaxCount,
            denoisingMode, sttMode, vocabSpecialization, boostedKeywords,
            enableVoicemailDetection, voicemailResponse, voicemailMessage,
            enableIvrHangup, allowUserDtmf, dtmfTimeout, dtmfTerminationKey,
            dtmfDigitLimit, endCallAfterSilenceSec, postCallAnalysisModel,
            postCallFields, dataStorageSetting, dataRetention, optInSignedUrl,
            fallbackVoiceMode, webhookUrl, webhookTimeoutSec, functions,
          })
        })
      });
      if (res.ok) { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 3000); }
    } catch (error) { console.error('Failed to save:', error); }
    finally { setIsSaving(false); }
  };

  // ── Settings Panel Content ──
  const renderSettingsContent = () => {
    switch (activeTab) {
      case 'voice': return (
        <div className="space-y-5 animate-fade-up">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">Background Sound</span>
              <Settings className="w-3.5 h-3.5 text-text-muted cursor-pointer hover:text-text-main" />
            </div>
            <select value={ambientSound} onChange={(e) => setAmbientSound(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="none">None</option>
              <option value="coffee-shop">Coffee Shop</option>
              <option value="convention-hall">Convention Hall</option>
              <option value="summer-outdoor">Summer Outdoor</option>
              <option value="mountain-outdoor">Mountain Outdoor</option>
              <option value="static-noise">Static Noise</option>
              <option value="call-center">Call Center</option>
            </select>
          </div>
          <SliderField label="Response Eagerness" description="How quickly the agent responds after the user finishes speaking."
            value={responsiveness} onChange={setResponsiveness} min={0} max={1} step={0.01} displayValue={responsiveness.toFixed(2)} />
          <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
            <input type="checkbox" checked={enableDynamicResponsiveness} onChange={(e) => setEnableDynamicResponsiveness(e.target.checked)} className="accent-primary w-3.5 h-3.5" />
            Dynamically adjust based on user input
          </label>
          <SliderField label="Interruption Sensitivity" description="How quickly the agent stops when user talks over it."
            value={interruptionSensitivity} onChange={setInterruptionSensitivity} min={0} max={1} step={0.01} displayValue={interruptionSensitivity.toFixed(2)} />
          <ToggleField label="Speech Normalization" checked={enableSpeechNormalization} onChange={setEnableSpeechNormalization}
            description="Converts numbers, currency, and dates into natural spoken forms." />
          <div>
            <span className="text-xs font-medium block mb-2">Reminder Frequency</span>
            <div className="flex items-center gap-2">
              <input type="number" value={reminderTriggerSec} onChange={(e) => setReminderTriggerSec(Number(e.target.value))}
                className="w-16 px-2 py-1.5 bg-bg border border-border rounded-lg text-xs focus:outline-none text-center" />
              <span className="text-xs text-text-muted">sec</span>
              <input type="number" value={reminderMaxCount} onChange={(e) => setReminderMaxCount(Number(e.target.value))}
                className="w-12 px-2 py-1.5 bg-bg border border-border rounded-lg text-xs focus:outline-none text-center" />
              <span className="text-xs text-text-muted">times</span>
            </div>
          </div>
          <div>
            <span className="text-xs font-medium block mb-2">Pronunciation Guide</span>
            <button className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-text-muted hover:text-text-main border border-dashed border-border rounded-lg hover:border-primary/50 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Word
            </button>
          </div>
        </div>
      );

      case 'behavior': return (
        <div className="space-y-5 animate-fade-up">
          <div>
            <span className="text-xs font-medium block mb-2">Knowledge Base</span>
            <p className="text-[10px] text-text-muted mb-2">Add documents to give your agent context.</p>
            <button className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-text-muted hover:text-text-main border border-dashed border-border rounded-lg hover:border-primary/50 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Upload Document
            </button>
            <button className="text-[10px] text-text-muted hover:text-text-main font-medium flex items-center gap-1 mt-2">
              <Settings className="w-3 h-3" /> Retrieval Settings
            </button>
          </div>
          <div className="border-t border-border pt-4">
            <span className="text-xs font-medium block mb-1">Who Speaks First</span>
            <select value={startSpeaker} onChange={(e) => setStartSpeaker(e.target.value)}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs focus:outline-none">
              <option value="agent">AI speaks first</option>
              <option value="user">User speaks first</option>
            </select>
          </div>
          <div>
            <span className="text-xs font-medium block mb-1">Greet Delay</span>
            <select value={pauseBeforeSpeaking} onChange={(e) => setPauseBeforeSpeaking(Number(e.target.value))}
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs focus:outline-none">
              <option value={0}>Immediate (0s)</option>
              <option value={1000}>1 second</option>
              <option value={2000}>2 seconds</option>
              <option value={3000}>3 seconds</option>
              <option value={5000}>5 seconds</option>
            </select>
          </div>
        </div>
      );

      case 'transcription': return (
        <div className="space-y-5 animate-fade-up">
          <RadioGroup label="Noise Filtering" description="Filter out unwanted background noise or speech."
            options={[
              { value: 'noise-cancellation', label: 'Remove noise' },
              { value: 'noise-and-background-speech-cancellation', label: 'Remove noise + background speech' },
              { value: 'no-denoise', label: 'No filtering' },
            ]} value={denoisingMode} onChange={setDenoisingMode} />
          <RadioGroup label="Transcription Speed" description="Balance between speed and accuracy."
            options={[
              { value: 'fast', label: 'Optimize for speed', badge: 'Recommended' },
              { value: 'accurate', label: 'Optimize for accuracy' },
              { value: 'custom', label: 'Custom' },
            ]} value={sttMode} onChange={setSttMode} />
          <RadioGroup label="Vocabulary" description="Choose the vocabulary set for transcription."
            options={[
              { value: 'general', label: 'General (all industries)' },
              { value: 'medical', label: 'Medical (healthcare terms)' },
            ]} value={vocabSpecialization} onChange={setVocabSpecialization} />
          <TagsInput label="Boosted Keywords" description="Keywords the model should prioritize during transcription."
            value={boostedKeywords} onChange={setBoostedKeywords} placeholder="Retell, Stone AIO, Walmart" />
        </div>
      );

      case 'call': return (
        <div className="space-y-5 animate-fade-up">
          <ToggleField label="Voicemail Detection" checked={enableVoicemailDetection} onChange={setEnableVoicemailDetection}
            description="Detect and respond to voicemail greetings.">
            <RadioGroup label="Response" options={[
              { value: 'hangup', label: 'Hang up' },
              { value: 'leave-message', label: 'Leave a message' },
            ]} value={voicemailResponse} onChange={setVoicemailResponse} />
            {voicemailResponse === 'leave-message' && (
              <textarea value={voicemailMessage} onChange={(e) => setVoicemailMessage(e.target.value)}
                rows={2} placeholder="Your voicemail message..."
                className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs focus:outline-none resize-y" />
            )}
          </ToggleField>
          <ToggleField label="IVR Hangup" checked={enableIvrHangup} onChange={setEnableIvrHangup}
            description="Hang up if an automated phone system is detected." />
          <ToggleField label="Keypad Input (DTMF)" checked={allowUserDtmf} onChange={setAllowUserDtmf}
            description="Listen for keypad presses during the call.">
            <SliderField label="Timeout" value={dtmfTimeout} onChange={setDtmfTimeout} min={0.5} max={10} step={0.5} displayValue={`${dtmfTimeout}s`} />
            <ToggleField label="Termination Key" checked={dtmfTerminationKey} onChange={setDtmfTerminationKey}
              description="Respond on a specific key press (#, *, 0)." />
            <ToggleField label="Digit Limit" checked={dtmfDigitLimit} onChange={setDtmfDigitLimit}
              description="Respond after N digits entered." />
          </ToggleField>
          <SliderField label="Silence Timeout" description="End the call if the user is silent this long."
            value={endCallAfterSilenceSec} onChange={setEndCallAfterSilenceSec} min={10} max={600} step={5} displayValue={`${endCallAfterSilenceSec}s`} />
        </div>
      );

      case 'analysis': return (
        <div className="space-y-5 animate-fade-up">
          <div>
            <span className="text-xs font-medium block mb-1">Post-Call Extraction</span>
            <p className="text-[10px] text-text-muted mb-3">Data points extracted automatically after each call.</p>
            <div className="space-y-1.5">
              {postCallFields.map((field, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-bg border border-border rounded-lg group">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green" />
                    <span className="text-xs font-medium">{field.name}</span>
                    <span className="text-[9px] text-text-muted bg-surface px-1.5 py-0.5 rounded">{field.type}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 hover:bg-surface-hover rounded"><Pencil className="w-3 h-3 text-text-muted" /></button>
                    <button className="p-1 hover:bg-surface-hover rounded" onClick={() => setPostCallFields(postCallFields.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3 h-3 text-text-muted" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
              <button className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium text-text-muted border border-dashed border-border rounded-lg hover:border-primary/50 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Field
              </button>
              <div className="flex items-center gap-1 bg-bg border border-border rounded-lg px-2 py-1">
                <Zap className="w-3 h-3 text-amber" />
                <select value={postCallAnalysisModel} onChange={(e) => setPostCallAnalysisModel(e.target.value)}
                  className="bg-transparent text-[10px] font-medium focus:outline-none appearance-none pr-3 cursor-pointer">
                  <option value="gpt-4.1-mini">GPT 4.1 Mini</option>
                  <option value="gpt-4.1">GPT 4.1</option>
                  <option value="claude-4.5-sonnet">Claude 4.5 Sonnet</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      );

      case 'security': return (
        <div className="space-y-5 animate-fade-up">
          <RadioGroup label="Data Storage" description="How Retell stores your call data."
            options={[
              { value: 'everything', label: 'Store everything' },
              { value: 'everything_except_pii', label: 'Exclude PII' },
              { value: 'basic_attributes_only', label: 'Basic attributes only' },
            ]} value={dataStorageSetting} onChange={setDataStorageSetting} />
          {dataStorageSetting === 'everything' && (
            <div className="ml-5">
              <label className="text-[10px] text-text-muted block mb-1">Retention Period</label>
              <select value={dataRetention} onChange={(e) => setDataRetention(e.target.value)}
                className="w-full px-2 py-1.5 bg-bg border border-border rounded-lg text-xs focus:outline-none">
                <option value="forever">Keep forever</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button className="p-3 bg-bg border border-border rounded-xl text-left hover:border-primary/30 transition-colors">
              <Shield className="w-4 h-4 text-red mb-1.5" />
              <span className="text-[11px] font-semibold block">PII Redaction</span>
              <span className="text-[9px] text-text-muted">Scrub sensitive data</span>
            </button>
            <button className="p-3 bg-bg border border-border rounded-xl text-left hover:border-primary/30 transition-colors">
              <Shield className="w-4 h-4 text-amber mb-1.5" />
              <span className="text-[11px] font-semibold block">Guardrails</span>
              <span className="text-[9px] text-text-muted">Content restrictions</span>
            </button>
          </div>
          <ToggleField label="Secure URLs" checked={optInSignedUrl} onChange={setOptInSignedUrl}
            description="Add 24-hour expiring signatures to all URLs." />
          <RadioGroup label="Fallback Voice" description="Backup if primary voice provider is down."
            options={[
              { value: 'automatic', label: 'Automatic' },
              { value: 'select', label: 'Choose specific voice' },
            ]} value={fallbackVoiceMode} onChange={(v) => setFallbackVoiceMode(v)} />
        </div>
      );

      case 'webhooks': return (
        <div className="space-y-5 animate-fade-up">
          <div>
            <span className="text-xs font-medium block mb-1">Webhook URL</span>
            <p className="text-[10px] text-text-muted mb-2">Receive real-time call events.</p>
            <div className="flex gap-2">
              <input type="text" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://api.yoursite.com/webhook"
                className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <button className="px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">Test</button>
            </div>
          </div>
          <SliderField label="Timeout" description="Max wait time for webhook response."
            value={webhookTimeoutSec} onChange={setWebhookTimeoutSec} min={1} max={30} step={1} displayValue={`${webhookTimeoutSec}s`} />
          <div>
            <span className="text-xs font-medium block mb-2">Event Types</span>
            <button className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium text-text-muted border border-border rounded-lg hover:border-primary/50 transition-colors">
              <Settings className="w-3.5 h-3.5" /> Configure Events
            </button>
          </div>
        </div>
      );

      case 'tools': return (
        <div className="space-y-5 animate-fade-up">
          <div>
            <span className="text-xs font-medium block mb-1">Functions</span>
            <p className="text-[10px] text-text-muted mb-3">Actions your agent can take during calls.</p>
            {functions.map((fn, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-bg border border-border rounded-lg mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold block">{fn.name}</span>
                    <span className="text-[9px] text-text-muted">{fn.description}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1 hover:bg-surface-hover rounded"><Pencil className="w-3 h-3 text-text-muted" /></button>
                  <button className="p-1 hover:bg-surface-hover rounded" onClick={() => setFunctions(functions.filter((_, j) => j !== i))}>
                    <Trash2 className="w-3 h-3 text-text-muted" />
                  </button>
                </div>
              </div>
            ))}
            <button className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-text-muted hover:text-text-main border border-dashed border-border rounded-lg hover:border-primary/50 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Function
            </button>
          </div>
          <div className="border-t border-border pt-4">
            <span className="text-xs font-medium block mb-1">MCPs</span>
            <p className="text-[10px] text-text-muted mb-3">Connect Model Context Protocols.</p>
            <button className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-text-muted hover:text-text-main border border-dashed border-border rounded-lg hover:border-primary/50 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add MCP
            </button>
          </div>
        </div>
      );

      default: return null;
    }
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
            <input type="text" value={agentName} onChange={(e) => setAgentName(e.target.value)}
              className="font-semibold text-sm bg-transparent border-none focus:outline-none hover:bg-surface-hover px-2 py-1 rounded w-64" />
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-teal bg-teal/10 border border-teal/20">Voice</span>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && (
            <span className="text-xs text-green flex items-center gap-1 animate-fade-up"><Save className="w-3 h-3" /> Published</span>
          )}
          <button onClick={handleDeploy} disabled={isSaving}
            className="bg-gradient-to-r from-primary to-primary-hover text-white px-5 py-1.5 rounded-lg text-xs font-bold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50">
            {isSaving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ══════ LEFT: SETTINGS PANEL ══════ */}
        <aside className="w-[420px] border-r border-border/50 bg-surface/40 backdrop-blur-xl flex shrink-0 overflow-hidden shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10">
          {/* Vertical Icon Nav */}
          <nav className="w-16 border-r border-border/50 bg-surface/60 flex flex-col items-center py-4 gap-2 shrink-0">
            {SETTINGS_TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}>
                {activeTab === tab.id && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <tab.icon className="w-4 h-4" />
                {/* Tooltip */}
                <span className="absolute left-12 px-2 py-1 bg-surface border border-border rounded-md text-[10px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-30 shadow-lg">
                  {tab.label}
                </span>
              </button>
            ))}
          </nav>

          {/* Settings Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-bold">{SETTINGS_TABS.find(t => t.id === activeTab)?.label}</h2>
            </div>
            <div className="p-4">
              {renderSettingsContent()}
            </div>
          </div>
        </aside>

        {/* ══════ RIGHT: PROMPT EDITOR ══════ */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Subtle glow background for the editor area */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
          
          {/* Config bar */}
          <div className="flex items-center gap-3 px-8 py-4 border-b border-border/50 bg-surface/30 backdrop-blur-md flex-wrap z-10 shadow-sm">
            <div className="flex items-center gap-2 bg-bg/60 backdrop-blur-md border border-border/50 rounded-xl px-3 py-2 shadow-sm hover:border-primary/30 transition-colors">
              <Zap className="w-3.5 h-3.5 text-amber" />
              <select value={llmModel} onChange={(e) => setLlmModel(e.target.value)}
                className="bg-transparent text-xs font-medium focus:outline-none appearance-none pr-4 cursor-pointer">
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-3.0-flash">Gemini 3.0 Flash</option>
                <option value="gpt-4.1">GPT-4.1</option>
                <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                <option value="gpt-5">GPT-5</option>
                <option value="gpt-5-mini">GPT-5 Mini</option>
                <option value="claude-4.5-sonnet">Claude 4.5 Sonnet</option>
                <option value="claude-4.6-sonnet">Claude 4.6 Sonnet</option>
                <option value="claude-4.5-haiku">Claude 4.5 Haiku</option>
              </select>
            </div>

            <button onClick={() => setShowVoicePicker(true)}
              className="flex items-center gap-1.5 bg-bg border border-border rounded-lg px-2.5 py-1.5 hover:border-primary/50 transition-colors">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" />
              <span className="text-xs font-medium">{voiceProfile}</span>
              <ChevronDown className="w-3 h-3 text-text-muted" />
            </button>

            <div className="flex items-center gap-1.5 bg-bg border border-border rounded-lg px-2.5 py-1.5">
              <Globe className="w-3.5 h-3.5 text-text-muted" />
              <select value={language} onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent text-xs font-medium focus:outline-none appearance-none pr-4 cursor-pointer">
                <option value="en-US">English</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Spanish</option>
                <option value="es-419">Spanish (LatAm)</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
                <option value="it-IT">Italian</option>
                <option value="pt-BR">Portuguese (BR)</option>
                <option value="ja-JP">Japanese</option>
                <option value="ko-KR">Korean</option>
                <option value="zh-CN">Chinese</option>
                <option value="hi-IN">Hindi</option>
                <option value="ar-SA">Arabic</option>
                <option value="multi">Multilingual</option>
              </select>
            </div>

            <span className="text-xs text-text-muted ml-auto font-mono bg-surface/50 px-2 py-1 rounded-md">{systemPrompt.length} chars</span>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-y-auto p-8 pb-32 z-10 w-full mb-20 relative">
            <div className="max-w-4xl mx-auto h-full flex flex-col gap-6 relative">
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest block mb-3 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" /> System Prompt
                </label>
                <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                  className="flex-1 w-full min-h-[500px] bg-surface/40 backdrop-blur-xl border border-border/60 rounded-2xl p-6 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-surface/60 resize-none font-mono shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-all"
                  placeholder="Enter your system prompt..." />
              </div>

              <div className="shrink-0 flex flex-col mt-4">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest block mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-teal" /> Welcome Message
                </label>
                <textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)}
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
            <div className={`w-2 h-2 rounded-full ${isTestCallActive ? 'bg-green pulse-dot' : 'bg-border'}`} />
            <span className="text-xs font-medium">{isTestCallActive ? 'Call Active' : 'Ready to test'}</span>
          </div>
          {isTestCallActive && (
            <span className="text-xs font-mono text-text-muted bg-bg px-2 py-0.5 rounded border border-border">{formatTime(callDuration)}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isTestCallActive ? (
            <button onClick={toggleTestCall}
              className="flex items-center gap-2 px-6 py-2 bg-red/10 text-red border border-red/20 rounded-xl text-sm font-bold hover:bg-red/20 transition-colors">
              <PhoneOff className="w-4 h-4" /> End Call
            </button>
          ) : (
            <button onClick={toggleTestCall} disabled={isProvisioning}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary to-teal text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 glow-primary">
              {isProvisioning ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Connecting...</>
              ) : (
                <><Mic className="w-4 h-4" /> Test Call</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Voice Picker Modal */}
      <VoicePickerModal isOpen={showVoicePicker} onClose={() => setShowVoicePicker(false)}
        selectedVoiceId={voiceId}
        onSelect={(id, name) => { setVoiceId(id); setVoiceProfile(name); setShowVoicePicker(false); }} />
    </div>
  );
}
