import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Bot, Zap, Box, Users, Palette, MessageSquare, Sun, Moon, Sparkles } from 'lucide-react';
import { THEMES, type ThemeName } from '../lib/ThemeContext';


export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState('dark');
  const navigate = useNavigate();

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
    else {
      // Apply theme before navigating
      const root = document.documentElement;
      THEMES.forEach(t => root.classList.remove(`theme-${t.id}`));
      root.classList.add(`theme-${selectedTheme}`);
      if (selectedTheme !== 'light') root.classList.add('dark');
      else root.classList.remove('dark');
      localStorage.setItem('stone-aio-theme', selectedTheme);
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-border w-full">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(step / 5) * 100}%` }} />
        </div>

        <div className="p-8 sm:p-12 min-h-[450px] flex flex-col justify-center">

          {/* Step 1: Role Selection */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-2xl font-bold mb-2 text-center">How will you use Stone AIO?</h1>
              <p className="text-text-muted text-center mb-8">This helps us personalize your experience.</p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { id: 'creator', title: 'I\'m a Creator', desc: 'Content, projects, and personal productivity.', icon: Sparkles },
                  { id: 'business', title: 'I\'m a Business Owner', desc: 'Sales, CRM, customer management, automation.', icon: Users },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setRole(r.id); handleNext(); }}
                    className={`p-6 rounded-xl border-2 text-left transition-all group ${
                      role === r.id ? 'border-primary bg-primary/5' : 'border-border bg-bg hover:border-primary/50 hover:bg-surface-hover'
                    }`}
                  >
                    <r.icon className="w-8 h-8 text-text-muted group-hover:text-primary mb-3 transition-colors" />
                    <h3 className="font-semibold mb-1">{r.title}</h3>
                    <p className="text-xs text-text-muted">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Theme Picker */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Palette className="w-5 h-5 text-primary" />
                <h1 className="text-2xl font-bold text-center">Pick your vibe</h1>
              </div>
              <p className="text-text-muted text-center mb-8">Choose a theme. You can always change it in Settings.</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTheme(t.id)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      selectedTheme === t.id ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-text-muted'
                    }`}
                  >
                    <div className="w-full h-14 rounded-lg overflow-hidden flex mb-2" style={{ background: t.preview.bg }}>
                      <div className="w-1/4 h-full" style={{ background: t.preview.surface }} />
                      <div className="flex-1 p-2">
                        <div className="h-1.5 rounded-full w-3/4 mb-1" style={{ background: t.preview.primary, opacity: 0.7 }} />
                        <div className="h-1 rounded-full w-1/2" style={{ background: t.preview.accent, opacity: 0.5 }} />
                      </div>
                    </div>
                    <span className="text-sm font-medium">{t.name}</span>
                  </button>
                ))}
              </div>

              <div className="text-center mt-6">
                <button onClick={handleNext} className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25 inline-flex items-center gap-2">
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Automation Goal */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-2xl font-bold mb-2 text-center">What do you want to automate?</h1>
              <p className="text-text-muted text-center mb-8">Select a goal to get started with recommendations.</p>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { title: 'Customer Support', desc: 'Auto-reply to tickets and triage issues.', icon: Bot },
                  { title: 'Data Extraction', desc: 'Pull structured data from emails or PDFs.', icon: Box },
                  { title: 'Sales Outreach', desc: 'Personalize and automate cold outreach.', icon: Zap },
                  { title: 'Custom Workflow', desc: 'Start from scratch with a blank canvas.', icon: CheckCircle2 },
                ].map((goal, i) => (
                  <button key={i} onClick={handleNext} className="p-6 rounded-xl border border-border bg-bg text-left hover:border-primary/50 hover:bg-surface-hover transition-all group">
                    <goal.icon className="w-6 h-6 text-text-muted group-hover:text-primary mb-3 transition-colors" />
                    <h3 className="font-medium mb-1">{goal.title}</h3>
                    <p className="text-xs text-text-muted">{goal.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Connect Tools */}
          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
              <h1 className="text-2xl font-bold mb-2">Connect your first tool</h1>
              <p className="text-text-muted mb-8">Stone AIO works best when connected to your existing stack.</p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                {['Gmail', 'Slack', 'Notion', 'Google Sheets', 'HubSpot', 'Stripe'].map((tool) => (
                  <button key={tool} className="p-4 rounded-xl border border-border bg-bg hover:border-primary/50 hover:bg-surface-hover transition-all flex flex-col items-center justify-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-surface border border-border" />
                    <span className="text-sm font-medium">{tool}</span>
                  </button>
                ))}
              </div>
              
              <button onClick={handleNext} className="text-sm font-medium text-text-muted hover:text-text-main transition-colors">
                Skip for now
              </button>
            </div>
          )}

          {/* Step 5: Meet Your AI */}
          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Meet your AI Assistant</h1>
              <p className="text-text-muted mb-4">Your personal AI partner is ready. It can help you build workflows, manage your CRM, deploy agents, and work across your entire Stone AIO workspace.</p>
              
              <div className="w-full max-w-md mx-auto bg-bg border border-border rounded-xl p-4 text-left mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="stone-logo w-7 h-7 text-[10px]">S</div>
                  <span className="text-sm font-medium">Stone AI</span>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">
                  "Hey Jack! 👋 Welcome to Stone AIO. I'm your AI assistant. I can help you set up your first workflow, configure voice agents, or just answer questions about the platform. What would you like to do first?"
                </p>
              </div>
              
              <button onClick={handleNext} className="bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25 inline-flex items-center gap-2">
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
