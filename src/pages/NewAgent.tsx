import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Bot, Clock, ArrowRight, ArrowLeft, Mic, GitMerge } from 'lucide-react';

export default function NewAgent() {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<string | null>(null);
  const navigate = useNavigate();

  const types = [
    { id: 'reactive', name: 'Reactive Agent', icon: Zap, desc: 'Event-driven AI pipeline. Fires on webhooks or external events.', color: 'text-primary border-primary/20 bg-primary/5 hover:border-primary', badge: 'Free' },
    { id: 'workflow', name: 'Workflow Agent', icon: GitMerge, desc: 'Visual automation canvas. Connect 500+ tools with AI at every step.', color: 'text-teal border-teal/20 bg-teal/5 hover:border-teal', badge: 'Starter+' },
    { id: 'scheduled', name: 'Scheduled Agent', icon: Clock, desc: 'Time-based AI task. Runs on a cron or clock schedule.', color: 'text-amber border-amber/20 bg-amber/5 hover:border-amber', badge: 'Starter+' },
    { id: 'autonomous', name: 'Autonomous Agent', icon: Bot, desc: 'Always-on AI agent. Persistent, self-directed worker.', color: 'text-purple border-purple/20 bg-purple/5 hover:border-purple', badge: 'Pro+' },
    { id: 'voice', name: 'Voice Agent', icon: Mic, desc: 'AI phone agent. Handle inbound/outbound calls and campaigns.', color: 'text-light-purple border-light-purple/20 bg-light-purple/5 hover:border-light-purple', badge: 'Pro+' },
  ];

  const handleNext = () => {
    if (step === 1 && type) setStep(2);
    if (step === 2) setStep(3);
    if (step === 3) navigate(`/agents/new-agent-id/build?type=${type}`);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-bg border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-border flex items-center justify-between">
          <h1 className="text-xl font-semibold">Create New Agent</h1>
          <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
            <span className={step >= 1 ? 'text-primary' : ''}>1. Type</span>
            <span>&rarr;</span>
            <span className={step >= 2 ? 'text-primary' : ''}>2. Details</span>
            <span>&rarr;</span>
            <span className={step >= 3 ? 'text-primary' : ''}>3. Setup</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 min-h-[400px]">
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-lg font-medium mb-6 text-center">Choose a builder environment</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {types.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={`p-6 rounded-xl border-2 text-left transition-all relative overflow-hidden ${
                      type === t.id ? t.color : 'border-border bg-surface hover:border-text-muted'
                    }`}
                  >
                    <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-bg border border-border text-text-muted">
                      {t.badge}
                    </div>
                    <t.icon className={`w-8 h-8 mb-4 ${type === t.id ? t.color.split(' ')[0] : 'text-text-muted'}`} />
                    <h3 className="font-semibold mb-2">{t.name}</h3>
                    <p className="text-sm text-text-muted leading-relaxed">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-md mx-auto">
              <h2 className="text-lg font-medium mb-6 text-center">Name your agent</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Agent Name</label>
                  <input type="text" placeholder="e.g., Invoice Processor" className="w-full px-4 py-2.5 rounded-md border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow" autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Description (Optional)</label>
                  <textarea placeholder="What does this agent do?" rows={3} className="w-full px-4 py-2.5 rounded-md border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow resize-none" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-md mx-auto text-center">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <Bot className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-medium mb-2">Ready to build</h2>
              <p className="text-text-muted mb-8">Your agent is initialized. Let's head to the builder to configure its logic.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border bg-surface flex items-center justify-between">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/dashboard')}
            className="px-4 py-2 rounded-md text-sm font-medium text-text-muted hover:text-text-main transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> {step === 1 ? 'Cancel' : 'Back'}
          </button>
          
          <button
            onClick={handleNext}
            disabled={step === 1 && !type}
            className="bg-primary text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 3 ? 'Open Builder' : 'Next'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
