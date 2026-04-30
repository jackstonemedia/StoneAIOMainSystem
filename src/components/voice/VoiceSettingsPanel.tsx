import { useVoiceBuilder } from '../../context/VoiceBuilderContext';
import { Settings, Plus, Pencil, Trash2, Zap, Shield, Headphones, PhoneCall, BarChart3, Webhook, Puzzle } from 'lucide-react';
import SliderField from '../../components/voice/SliderField';
import ToggleField from '../../components/voice/ToggleField';
import RadioGroup from '../../components/voice/RadioGroup';
import TagsInput from '../../components/voice/TagsInput';

export default function VoiceSettingsPanel() {
  const ctx = useVoiceBuilder();

  switch (ctx.activeTab) {
    case 'voice': return (
      <div className="space-y-5 animate-fade-up">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Background Sound</span>
            <Settings className="w-3.5 h-3.5 text-text-muted cursor-pointer hover:text-text-main" />
          </div>
          <select value={ctx.ambientSound} onChange={(e) => ctx.setAmbientSound(e.target.value)}
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
          value={ctx.responsiveness} onChange={ctx.setResponsiveness} min={0} max={1} step={0.01} displayValue={ctx.responsiveness.toFixed(2)} />
        <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
          <input type="checkbox" checked={ctx.enableDynamicResponsiveness} onChange={(e) => ctx.setEnableDynamicResponsiveness(e.target.checked)} className="accent-primary w-3.5 h-3.5" />
          Dynamically adjust based on user input
        </label>
        <SliderField label="Interruption Sensitivity" description="How quickly the agent stops when user talks over it."
          value={ctx.interruptionSensitivity} onChange={ctx.setInterruptionSensitivity} min={0} max={1} step={0.01} displayValue={ctx.interruptionSensitivity.toFixed(2)} />
        <ToggleField label="Speech Normalization" checked={ctx.enableSpeechNormalization} onChange={ctx.setEnableSpeechNormalization}
          description="Converts numbers, currency, and dates into natural spoken forms." />
        <div>
          <span className="text-xs font-medium block mb-2">Reminder Frequency</span>
          <div className="flex items-center gap-2">
            <input type="number" value={ctx.reminderTriggerSec} onChange={(e) => ctx.setReminderTriggerSec(Number(e.target.value))}
              className="w-16 px-2 py-1.5 bg-bg border border-border rounded-lg text-xs focus:outline-none text-center" />
            <span className="text-xs text-text-muted">sec</span>
            <input type="number" value={ctx.reminderMaxCount} onChange={(e) => ctx.setReminderMaxCount(Number(e.target.value))}
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
          <select value={ctx.startSpeaker} onChange={(e) => ctx.setStartSpeaker(e.target.value)}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs focus:outline-none">
            <option value="agent">AI speaks first</option>
            <option value="user">User speaks first</option>
          </select>
        </div>
        <div>
          <span className="text-xs font-medium block mb-1">Greet Delay</span>
          <select value={ctx.pauseBeforeSpeaking} onChange={(e) => ctx.setPauseBeforeSpeaking(Number(e.target.value))}
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
          ]} value={ctx.denoisingMode} onChange={ctx.setDenoisingMode} />
        <RadioGroup label="Transcription Speed" description="Balance between speed and accuracy."
          options={[
            { value: 'fast', label: 'Optimize for speed', badge: 'Recommended' },
            { value: 'accurate', label: 'Optimize for accuracy' },
            { value: 'custom', label: 'Custom' },
          ]} value={ctx.sttMode} onChange={ctx.setSttMode} />
        <RadioGroup label="Vocabulary" description="Choose the vocabulary set for transcription."
          options={[
            { value: 'general', label: 'General (all industries)' },
            { value: 'medical', label: 'Medical (healthcare terms)' },
          ]} value={ctx.vocabSpecialization} onChange={ctx.setVocabSpecialization} />
        <TagsInput label="Boosted Keywords" description="Keywords the model should prioritize during transcription."
          value={ctx.boostedKeywords} onChange={ctx.setBoostedKeywords} placeholder="Retell, Stone AIO, Walmart" />
      </div>
    );

    case 'call': return (
      <div className="space-y-5 animate-fade-up">
        <ToggleField label="Voicemail Detection" checked={ctx.enableVoicemailDetection} onChange={ctx.setEnableVoicemailDetection}
          description="Detect and respond to voicemail greetings.">
          <RadioGroup label="Response" options={[
            { value: 'hangup', label: 'Hang up' },
            { value: 'leave-message', label: 'Leave a message' },
          ]} value={ctx.voicemailResponse} onChange={ctx.setVoicemailResponse} />
          {ctx.voicemailResponse === 'leave-message' && (
            <textarea value={ctx.voicemailMessage} onChange={(e) => ctx.setVoicemailMessage(e.target.value)}
              rows={2} placeholder="Your voicemail message..."
              className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-xs focus:outline-none resize-y" />
          )}
        </ToggleField>
        <ToggleField label="IVR Hangup" checked={ctx.enableIvrHangup} onChange={ctx.setEnableIvrHangup}
          description="Hang up if an automated phone system is detected." />
        <ToggleField label="Keypad Input (DTMF)" checked={ctx.allowUserDtmf} onChange={ctx.setAllowUserDtmf}
          description="Listen for keypad presses during the call.">
          <SliderField label="Timeout" value={ctx.dtmfTimeout} onChange={ctx.setDtmfTimeout} min={0.5} max={10} step={0.5} displayValue={`${ctx.dtmfTimeout}s`} />
          <ToggleField label="Termination Key" checked={ctx.dtmfTerminationKey} onChange={ctx.setDtmfTerminationKey}
            description="Respond on a specific key press (#, *, 0)." />
          <ToggleField label="Digit Limit" checked={ctx.dtmfDigitLimit} onChange={ctx.setDtmfDigitLimit}
            description="Respond after N digits entered." />
        </ToggleField>
        <SliderField label="Silence Timeout" description="End the call if the user is silent this long."
          value={ctx.endCallAfterSilenceSec} onChange={ctx.setEndCallAfterSilenceSec} min={10} max={600} step={5} displayValue={`${ctx.endCallAfterSilenceSec}s`} />
      </div>
    );

    case 'analysis': return (
      <div className="space-y-5 animate-fade-up">
        <div>
          <span className="text-xs font-medium block mb-1">Post-Call Extraction</span>
          <p className="text-[10px] text-text-muted mb-3">Data points extracted automatically after each call.</p>
          <div className="space-y-1.5">
            {ctx.postCallFields.map((field: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-bg border border-border rounded-lg group">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green" />
                  <span className="text-xs font-medium">{field.name}</span>
                  <span className="text-[9px] text-text-muted bg-surface px-1.5 py-0.5 rounded">{field.type}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1 hover:bg-surface-hover rounded"><Pencil className="w-3 h-3 text-text-muted" /></button>
                  <button className="p-1 hover:bg-surface-hover rounded" onClick={() => ctx.setPostCallFields(ctx.postCallFields.filter((_: any, j: number) => j !== i))}>
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
              <select value={ctx.postCallAnalysisModel} onChange={(e) => ctx.setPostCallAnalysisModel(e.target.value)}
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
          ]} value={ctx.dataStorageSetting} onChange={ctx.setDataStorageSetting} />
        {ctx.dataStorageSetting === 'everything' && (
          <div className="ml-5">
            <label className="text-[10px] text-text-muted block mb-1">Retention Period</label>
            <select value={ctx.dataRetention} onChange={(e) => ctx.setDataRetention(e.target.value)}
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
        <ToggleField label="Secure URLs" checked={ctx.optInSignedUrl} onChange={ctx.setOptInSignedUrl}
          description="Add 24-hour expiring signatures to all URLs." />
        <RadioGroup label="Fallback Voice" description="Backup if primary voice provider is down."
          options={[
            { value: 'automatic', label: 'Automatic' },
            { value: 'select', label: 'Choose specific voice' },
          ]} value={ctx.fallbackVoiceMode} onChange={(v: string) => ctx.setFallbackVoiceMode(v)} />
      </div>
    );

    case 'webhooks': return (
      <div className="space-y-5 animate-fade-up">
        <div>
          <span className="text-xs font-medium block mb-1">Webhook URL</span>
          <p className="text-[10px] text-text-muted mb-2">Receive real-time call events.</p>
          <div className="flex gap-2">
            <input type="text" value={ctx.webhookUrl} onChange={(e) => ctx.setWebhookUrl(e.target.value)}
              placeholder="https://api.yoursite.com/webhook"
              className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <button className="px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">Test</button>
          </div>
        </div>
        <SliderField label="Timeout" description="Max wait time for webhook response."
          value={ctx.webhookTimeoutSec} onChange={ctx.setWebhookTimeoutSec} min={1} max={30} step={1} displayValue={`${ctx.webhookTimeoutSec}s`} />
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
          {ctx.functions.map((fn: any, i: number) => (
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
                <button className="p-1 hover:bg-surface-hover rounded" onClick={() => ctx.setFunctions(ctx.functions.filter((_: any, j: number) => j !== i))}>
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
}
