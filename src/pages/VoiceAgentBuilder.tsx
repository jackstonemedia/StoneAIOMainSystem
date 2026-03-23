import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Save, Bot, Volume2, Mic, Play, Settings, Database, Code, Shield, Phone, PhoneOff, Sliders
} from 'lucide-react';

export default function VoiceAgentBuilder() {
  const [isTestCallActive, setIsTestCallActive] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<string | null>('knowledge');

  const toggleAccordion = (id: string) => {
    setActiveAccordion(prev => prev === id ? null : id);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-bg text-text-main font-sans overflow-hidden">
      {/* Topbar */}
      <header className="h-14 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Link to="/agents" className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-md transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="font-semibold">Inbound Sales Receptionist</span>
            <span className="px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wider text-light-purple bg-light-purple/10 border-light-purple/20">
              Voice
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted flex items-center gap-1">
            <Save className="w-3.5 h-3.5" /> Saved just now
          </span>
          <div className="h-6 w-px bg-border mx-1" />
          <button className="bg-primary text-white px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-primary-hover shadow-sm transition-all focus:ring-2 focus:ring-primary/50 focus:outline-none">
            Deploy Agent
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Core Configuration */}
        <main className="flex-1 overflow-y-auto p-8 lg:p-10 bg-bg">
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-2xl font-bold mb-2">Voice Agent Configuration</h1>
              <p className="text-text-muted">Define the underlying logic, persona, and voice properties of your interactive agent.</p>
            </div>

            {/* AI Model & Voice Row */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> Core Engine</h3>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">LLM Model</label>
                  <select className="w-full px-3 py-2.5 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow appearance-none">
                    <option>GPT-4o (Recommended)</option>
                    <option>Claude 3.5 Sonnet</option>
                    <option>Gemini 1.5 Pro</option>
                    <option>GPT-4 Turbo</option>
                  </select>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Volume2 className="w-4 h-4 text-light-purple" /> Voice Profile</h3>
                  <button className="text-xs text-light-purple hover:underline font-medium">Browse Library</button>
                </div>
                <div className="flex items-center gap-3">
                  <select className="flex-1 px-3 py-2.5 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow appearance-none">
                    <option>Rachel (American, Female, Conversational)</option>
                    <option>Drew (American, Male, News)</option>
                    <option>Mimik (British, Female, Professional)</option>
                  </select>
                  <button className="p-2.5 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors" title="Preview Voice">
                    <Play className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* System Prompt */}
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Bot className="w-4 h-4 text-amber" /> Identity & System Instructions
                </h3>
                <span className="text-xs font-medium text-text-muted bg-bg px-2 py-0.5 rounded border border-border">1,240 tokens</span>
              </div>
              <textarea 
                rows={10}
                className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none font-mono leading-relaxed"
                defaultValue="You are Emma, a friendly and professional inbound sales receptionist for Stone AIO.
Your goal is to answer questions about the software, qualify the lead, and book a demonstration if they are a good fit. 

Rules:
1. Always be energetic and polite.
2. Keep responses concise, under 2 sentences when possible, to keep the conversation flowing.
3. If they ask about pricing, mention it starts at $99/mo but depends on usage.
4. Try to gather their company size before offering a demo."
              />
            </div>

            {/* Conversation Flow */}
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Mic className="w-4 h-4 text-green" /> Conversation Flow
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-bg border border-border rounded-lg">
                  <div>
                    <h4 className="text-sm font-semibold mb-1">AI Speaks First</h4>
                    <p className="text-xs text-text-muted">Agent initiates the call with the welcome message.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Welcome Message</label>
                  <textarea 
                    rows={2}
                    className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    defaultValue="Hi, thanks for calling Stone AIO. This is Emma. How can I help you today?"
                  />
                  <p className="text-xs text-text-muted mt-2">This is exactly what the agent will say when the user connects.</p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar: Settings & Testing */}
        <aside className="w-[360px] border-l border-border bg-surface flex flex-col shrink-0 z-10">
          
          <div className="p-4 border-b border-border bg-bg/50">
            <h2 className="font-semibold text-sm">Advanced Options</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Accordion List */}
            <div className="divide-y divide-border">
              
              {/* Knowledge Base */}
              <div>
                <button 
                  onClick={() => toggleAccordion('knowledge')}
                  className="w-full flex items-center justify-between p-4 hover:bg-bg transition-colors focus:outline-none"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold"><Database className="w-4 h-4 text-blue-500" /> Knowledge Base</span>
                  {activeAccordion === 'knowledge' ? <div className="w-2 h-2 rounded-full bg-blue-500" /> : <div className="w-2 h-2 rounded-full bg-border" />}
                </button>
                {activeAccordion === 'knowledge' && (
                  <div className="p-4 pt-0 bg-surface text-sm">
                    <p className="text-xs text-text-muted mb-3">Upload documents to give your agent context.</p>
                    <div className="border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center bg-bg/50">
                      <Database className="w-6 h-6 text-text-muted mb-2" />
                      <span className="font-medium text-primary">Upload Document</span>
                      <span className="text-xs text-text-muted mt-1">PDF, TXT, or URL</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Functions/Tools */}
              <div>
                <button 
                  onClick={() => toggleAccordion('functions')}
                  className="w-full flex items-center justify-between p-4 hover:bg-bg transition-colors focus:outline-none"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold"><Code className="w-4 h-4 text-purple" /> Callable Functions</span>
                  {activeAccordion === 'functions' ? <div className="w-2 h-2 rounded-full bg-purple" /> : <div className="w-2 h-2 rounded-full bg-border" />}
                </button>
                {activeAccordion === 'functions' && (
                  <div className="p-4 pt-0 bg-surface text-sm space-y-3">
                    <p className="text-xs text-text-muted">Allow the agent to take actions during the call.</p>
                    <div className="flex items-center justify-between p-2.5 border border-border bg-bg rounded-lg">
                      <span className="font-medium">Book_Appointment</span>
                      <span className="text-[10px] uppercase font-bold text-green bg-green/10 px-2 py-0.5 rounded">Active</span>
                    </div>
                    <button className="w-full py-2 bg-purple/10 text-purple font-medium text-xs rounded-lg border border-purple/20 hover:bg-purple/20 transition-colors">
                      + Add Function
                    </button>
                  </div>
                )}
              </div>

              {/* Speech Setup */}
              <div>
                <button 
                  onClick={() => toggleAccordion('speech')}
                  className="w-full flex items-center justify-between p-4 hover:bg-bg transition-colors focus:outline-none"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold"><Sliders className="w-4 h-4 text-teal" /> Speech Synthesis</span>
                  {activeAccordion === 'speech' ? <div className="w-2 h-2 rounded-full bg-teal" /> : <div className="w-2 h-2 rounded-full bg-border" />}
                </button>
                {activeAccordion === 'speech' && (
                  <div className="p-4 pt-0 bg-surface text-sm space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span>Speaking Speed</span>
                        <span className="font-mono">1.0x</span>
                      </div>
                      <input type="range" min="0.5" max="2" step="0.1" defaultValue="1" className="w-full accent-teal" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span>Emotion / Stability</span>
                        <span className="font-mono">75%</span>
                      </div>
                      <input type="range" min="0" max="100" defaultValue="75" className="w-full accent-teal" />
                    </div>
                  </div>
                )}
              </div>

              {/* Security & Call Limits */}
              <div>
                <button 
                  onClick={() => toggleAccordion('security')}
                  className="w-full flex items-center justify-between p-4 hover:bg-bg transition-colors focus:outline-none"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold"><Shield className="w-4 h-4 text-red" /> Call Rules & Limits</span>
                  {activeAccordion === 'security' ? <div className="w-2 h-2 rounded-full bg-red" /> : <div className="w-2 h-2 rounded-full bg-border" />}
                </button>
                {activeAccordion === 'security' && (
                  <div className="p-4 pt-0 bg-surface text-sm space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-text-muted mb-1">Max Call Duration</label>
                      <select className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none">
                        <option>10 Minutes</option>
                        <option>30 Minutes</option>
                        <option>Unlimited</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-muted mb-1">User Silence Timeout</label>
                      <select className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none">
                        <option>15 Seconds</option>
                        <option>30 Seconds</option>
                        <option>60 Seconds</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Phone Numbers */}
              <div>
                <button 
                  onClick={() => toggleAccordion('numbers')}
                  className="w-full flex items-center justify-between p-4 hover:bg-bg transition-colors focus:outline-none"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold"><Phone className="w-4 h-4 text-orange-500" /> Phone Numbers</span>
                  {activeAccordion === 'numbers' ? <div className="w-2 h-2 rounded-full bg-orange-500" /> : <div className="w-2 h-2 rounded-full bg-border" />}
                </button>
                {activeAccordion === 'numbers' && (
                  <div className="p-4 pt-0 bg-surface text-sm space-y-3">
                    <p className="text-xs text-text-muted">Inbound numbers connected to this agent.</p>
                    <div className="flex items-center justify-between p-2.5 border border-border bg-bg rounded-lg">
                      <span className="font-mono text-xs">+1 (415) 555-0123</span>
                      <span className="text-[10px] uppercase font-bold text-green bg-green/10 px-2 py-0.5 rounded">Active</span>
                    </div>
                    <button className="w-full py-2 bg-bg border border-border text-text-main font-medium text-xs rounded-lg hover:bg-surface-hover transition-colors">
                      + Buy or Import Number
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Test Call Sticky Widget */}
          <div className="p-4 border-t border-border bg-bg/50">
            <div className={`border rounded-2xl p-4 transition-all duration-300 ${isTestCallActive ? 'bg-primary/5 border-primary shadow-[0_0_20px_rgba(67,97,238,0.15)]' : 'bg-surface border-border shadow-sm'}`}>
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                
                {isTestCallActive ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center relative">
                      <div className="w-full h-full rounded-full bg-primary/30 absolute animate-ping" />
                      <Mic className="w-8 h-8 text-primary relative z-10" />
                    </div>
                    <div>
                      <h4 className="font-bold text-primary">Call in Progress</h4>
                      <p className="text-xs text-text-muted mt-1 font-mono">00:04</p>
                    </div>
                    <button 
                      onClick={() => setIsTestCallActive(false)}
                      className="w-full py-2.5 bg-red text-white flex items-center justify-center gap-2 rounded-xl font-bold shadow-md hover:bg-red/90 transition-all"
                    >
                      <PhoneOff className="w-4 h-4" /> End Test Call
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-bg border border-border flex items-center justify-center shadow-inner">
                      <Phone className="w-7 h-7 text-text-main" />
                    </div>
                    <div>
                      <h4 className="font-bold">Test Your Agent</h4>
                      <p className="text-xs text-text-muted mt-1">Speak to your agent directly in the browser.</p>
                    </div>
                    <button 
                      onClick={() => setIsTestCallActive(true)}
                      className="w-full py-2.5 bg-primary text-white flex items-center justify-center gap-2 rounded-xl font-bold shadow-md hover:bg-primary-hover transition-all"
                    >
                      <Phone className="w-4 h-4" /> Start Web Call
                    </button>
                  </>
                )}

              </div>
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
}
