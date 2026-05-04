import React, { createContext, useContext, useState, useRef } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';

export const VoiceBuilderContext = createContext<any>(null);

export function VoiceBuilderProvider({ children }: { children: React.ReactNode }) {
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

  const value = {
    isTestCallActive, setIsTestCallActive,
    isProvisioning, setIsProvisioning,
    callDuration, setCallDuration,
    retellClientRef,
    activeTab, setActiveTab,
    showVoicePicker, setShowVoicePicker,
    isSaving, setIsSaving,
    saveStatus, setSaveStatus,
    agentName, setAgentName,
    llmModel, setLlmModel,
    voiceProfile, setVoiceProfile,
    voiceId, setVoiceId,
    language, setLanguage,
    systemPrompt, setSystemPrompt,
    startSpeaker, setStartSpeaker,
    pauseBeforeSpeaking, setPauseBeforeSpeaking,
    welcomeMessage, setWelcomeMessage,
    ambientSound, setAmbientSound,
    ambientSoundVolume, setAmbientSoundVolume,
    responsiveness, setResponsiveness,
    enableDynamicResponsiveness, setEnableDynamicResponsiveness,
    interruptionSensitivity, setInterruptionSensitivity,
    enableSpeechNormalization, setEnableSpeechNormalization,
    reminderTriggerSec, setReminderTriggerSec,
    reminderMaxCount, setReminderMaxCount,
    denoisingMode, setDenoisingMode,
    sttMode, setSttMode,
    vocabSpecialization, setVocabSpecialization,
    boostedKeywords, setBoostedKeywords,
    enableVoicemailDetection, setEnableVoicemailDetection,
    voicemailResponse, setVoicemailResponse,
    voicemailMessage, setVoicemailMessage,
    enableIvrHangup, setEnableIvrHangup,
    allowUserDtmf, setAllowUserDtmf,
    dtmfTimeout, setDtmfTimeout,
    dtmfTerminationKey, setDtmfTerminationKey,
    dtmfDigitLimit, setDtmfDigitLimit,
    endCallAfterSilenceSec, setEndCallAfterSilenceSec,
    postCallAnalysisModel, setPostCallAnalysisModel,
    postCallFields, setPostCallFields,
    dataStorageSetting, setDataStorageSetting,
    dataRetention, setDataRetention,
    optInSignedUrl, setOptInSignedUrl,
    fallbackVoiceMode, setFallbackVoiceMode,
    webhookUrl, setWebhookUrl,
    webhookTimeoutSec, setWebhookTimeoutSec,
    functions, setFunctions,
  };

  return <VoiceBuilderContext.Provider value={value}>{children}</VoiceBuilderContext.Provider>;
}

export const useVoiceBuilder = () => useContext(VoiceBuilderContext);
