import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Cpu, Building2, Check, Sparkles } from 'lucide-react';
import { THEMES, type ThemeName } from '../lib/ThemeContext';

const BUSINESS_TYPES = [
  { id: 'agency', label: 'Agency', icon: '🎯', desc: 'Marketing, design, or consulting agency' },
  { id: 'ecommerce', label: 'E-Commerce', icon: '🛍️', desc: 'Selling products online' },
  { id: 'local', label: 'Local Business', icon: '🏪', desc: 'Service-based local business' },
  { id: 'coaching', label: 'Coaching / Consulting', icon: '🎓', desc: 'Teaching, training, or advising' },
  { id: 'realestate', label: 'Real Estate', icon: '🏠', desc: 'Buyers, sellers, and property management' },
  { id: 'saas', label: 'SaaS / Tech', icon: '💻', desc: 'Software product or tech startup' },
  { id: 'other', label: 'Other', icon: '✨', desc: 'Something else entirely' },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [primaryMode, setPrimaryMode] = useState<'creator' | 'business' | ''>('');
  const [selectedTheme, setSelectedTheme] = useState('dark');
  const [animating, setAnimating] = useState(false);
  const navigate = useNavigate();

  const totalSteps = 4;

  const goNext = () => {
    if (step >= totalSteps) {
      finish();
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setAnimating(false);
    }, 280);
  };

  const finish = () => {
    // Apply theme
    const root = document.documentElement;
    THEMES.forEach(t => root.classList.remove(`theme-${t.id}`));
    root.classList.add(`theme-${selectedTheme}`);
    if (selectedTheme !== 'light') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('stone-aio-theme', selectedTheme);

    // Save mode
    localStorage.setItem('stone-aio-mode', primaryMode || 'creator');

    navigate(primaryMode === 'business' ? '/business' : '/dashboard');
  };

  // Orb positions for ambient background
  const orbs = [
    { w: 700, h: 500, top: '-20%', left: '-10%', color: 'rgba(67,97,238,0.12)', blur: 120, delay: 0 },
    { w: 500, h: 500, top: '40%', right: '-15%', color: 'rgba(6,214,160,0.10)', blur: 140, delay: 1.5 },
    { w: 400, h: 400, bottom: '-10%', left: '30%', color: 'rgba(187,134,252,0.08)', blur: 100, delay: 0.8 },
  ];

  return (
    <div className="min-h-screen w-full bg-bg flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Ambient background orbs */}
      {orbs.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none animate-pulse-slow"
          style={{
            width: orb.w,
            height: orb.h,
            top: orb.top,
            left: (orb as any).left,
            right: (orb as any).right,
            bottom: (orb as any).bottom,
            background: orb.color,
            filter: `blur(${orb.blur}px)`,
            animationDelay: `${orb.delay}s`,
          }}
        />
      ))}

      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Step progress dots */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`transition-all duration-500 rounded-full ${
              i + 1 < step
                ? 'w-6 h-2 bg-primary'
                : i + 1 === step
                ? 'w-6 h-2 bg-primary shadow-[0_0_8px_rgba(67,97,238,0.6)]'
                : 'w-2 h-2 bg-border'
            }`} />
          </div>
        ))}
      </div>

      {/* Logo */}
      <div className="absolute top-6 left-8 flex items-center gap-2 z-10">
        <div className="stone-logo w-8 h-8 text-xs">S</div>
        <span className="text-sm font-semibold text-text-main hidden sm:block">Stone AIO</span>
      </div>

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-2xl transition-all duration-280 ${
          animating ? 'opacity-0 translate-y-4 scale-[0.98]' : 'opacity-100 translate-y-0 scale-100'
        }`}
      >

        {/* ─── STEP 1: Welcome & Business Name ─── */}
        {step === 1 && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              Welcome to Stone AIO
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4 text-gradient">
              What's your<br />business called?
            </h1>
            <p className="text-text-muted text-lg mb-12 max-w-md mx-auto">
              This helps us personalize your workspace and communications.
            </p>

            <div className="max-w-sm mx-auto space-y-4">
              <input
                type="text"
                autoFocus
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && businessName.trim() && goNext()}
                placeholder="e.g. Stone Media"
                className="w-full px-6 py-4 text-lg bg-surface/60 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-center font-bold backdrop-blur-xl placeholder-text-muted/40"
              />
              <button
                onClick={goNext}
                disabled={!businessName.trim()}
                className="w-full py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-primary to-teal disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-[0_8px_30px_rgba(67,97,238,0.35)] hover:shadow-[0_12px_40px_rgba(67,97,238,0.45)] flex items-center justify-center gap-2 group"
              >
                Let's go
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Business Type ─── */}
        {step === 2 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 text-gradient">
                What type of<br />business is {businessName || 'yours'}?
              </h1>
              <p className="text-text-muted text-lg">We'll tailor your experience to fit.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {BUSINESS_TYPES.map(bt => (
                <button
                  key={bt.id}
                  onClick={() => { setBusinessType(bt.id); goNext(); }}
                  className={`relative p-4 rounded-2xl border text-left transition-all duration-300 group overflow-hidden ${
                    businessType === bt.id
                      ? 'border-primary/60 bg-primary/10 shadow-[0_0_20px_rgba(67,97,238,0.2)]'
                      : 'border-border bg-surface/40 hover:border-primary/30 hover:bg-surface/70 hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)]'
                  }`}
                >
                  <div className="text-3xl mb-2">{bt.icon}</div>
                  <div className="font-bold text-sm mb-0.5">{bt.label}</div>
                  <div className="text-xs text-text-muted leading-snug">{bt.desc}</div>
                  {businessType === bt.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── STEP 3: Primary Focus / Mode ─── */}
        {step === 3 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 text-gradient">
                What's your<br />primary focus?
              </h1>
              <p className="text-text-muted text-lg max-w-sm mx-auto">
                You can always switch between both from the sidebar.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {/* Creator Studio card */}
              <button
                onClick={() => { setPrimaryMode('creator'); goNext(); }}
                className={`group relative p-8 rounded-3xl border text-left transition-all duration-400 overflow-hidden ${
                  primaryMode === 'creator'
                    ? 'border-primary/60 bg-primary/10 shadow-[0_0_40px_rgba(67,97,238,0.25)] scale-[1.02]'
                    : 'border-border/60 bg-surface/30 hover:border-primary/30 hover:shadow-[0_10px_40px_rgba(67,97,238,0.12)] hover:-translate-y-1'
                }`}
              >
                {/* Background glow */}
                <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/20 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-teal/10 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                    <Cpu className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-black mb-2 group-hover:text-primary transition-colors">Creator Studio</h3>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Build AI voice agents, automate workflows, deploy smart assistants, and run your entire AI workforce.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {['Voice Agents', 'Workflows', 'AI Assistant'].map(tag => (
                      <span key={tag} className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{tag}</span>
                    ))}
                  </div>
                </div>
              </button>

              {/* Business Hub card */}
              <button
                onClick={() => { setPrimaryMode('business'); goNext(); }}
                className={`group relative p-8 rounded-3xl border text-left transition-all duration-400 overflow-hidden ${
                  primaryMode === 'business'
                    ? 'border-amber/60 bg-amber/10 shadow-[0_0_40px_rgba(251,191,36,0.2)] scale-[1.02]'
                    : 'border-border/60 bg-surface/30 hover:border-amber/30 hover:shadow-[0_10px_40px_rgba(251,191,36,0.1)] hover:-translate-y-1'
                }`}
              >
                {/* Background glow */}
                <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber/15 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-light-purple/10 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-amber/15 border border-amber/25 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                    <Building2 className="w-7 h-7 text-amber" />
                  </div>
                  <h3 className="text-xl font-black mb-2 group-hover:text-amber transition-colors">Business Hub</h3>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Manage contacts, run campaigns, book appointments, track pipelines, and grow your business in one place.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {['CRM', 'Campaigns', 'Inbox', 'Calendar'].map(tag => (
                      <span key={tag} className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber/10 text-amber border border-amber/20">{tag}</span>
                    ))}
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Theme ─── */}
        {step === 4 && (
          <div>
            <div className="text-center mb-10">
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3 text-gradient">
                Make it yours
              </h1>
              <p className="text-text-muted text-lg">Pick a theme. You can change it anytime in Settings.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8 max-w-xl mx-auto">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTheme(t.id)}
                  className={`relative p-3 rounded-2xl border-2 transition-all duration-300 text-left ${
                    selectedTheme === t.id
                      ? 'border-primary ring-2 ring-primary/30 shadow-[0_0_20px_rgba(67,97,238,0.25)]'
                      : 'border-border hover:border-text-muted/30'
                  }`}
                >
                  {/* Theme preview */}
                  <div className="w-full h-16 rounded-xl overflow-hidden flex mb-3" style={{ background: t.preview.bg }}>
                    <div className="w-1/4 h-full" style={{ background: t.preview.surface }} />
                    <div className="flex-1 p-2.5">
                      <div className="h-1.5 rounded-full w-3/4 mb-1.5" style={{ background: t.preview.primary, opacity: 0.8 }} />
                      <div className="h-1 rounded-full w-1/2 mb-1" style={{ background: t.preview.accent, opacity: 0.5 }} />
                      <div className="h-1 rounded-full w-2/3" style={{ background: t.preview.primary, opacity: 0.25 }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold">{t.name}</span>
                  {selectedTheme === t.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(67,97,238,0.5)]">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={finish}
                className="px-10 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-primary to-teal hover:opacity-90 transition-all shadow-[0_10px_40px_rgba(67,97,238,0.4)] hover:shadow-[0_14px_50px_rgba(67,97,238,0.5)] inline-flex items-center gap-3 group text-base"
              >
                Enter {businessName ? businessName : 'Stone AIO'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-xs text-text-muted mt-3">You're all set. Welcome aboard 🎉</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
