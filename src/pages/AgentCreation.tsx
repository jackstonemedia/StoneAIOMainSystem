import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, LayoutTemplate, Mic, PlusSquare, Search, Sparkles, Wand2, Zap, ArrowRight, ArrowLeft, Check, Phone, Headphones
} from 'lucide-react';

export default function AgentCreation() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [environment, setEnvironment] = useState('');
  
  // Generic / Workflow starting points
  const [startingPoint, setStartingPoint] = useState('');
  
  // Voice starting points
  const [voiceTemplate, setVoiceTemplate] = useState('');
  
  // Final details
  const [agentName, setAgentName] = useState('');
  const [description, setDescription] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Animation trigger on step change
  const [animateStep, setAnimateStep] = useState(false);

  useEffect(() => {
    setAnimateStep(true);
    const timer = setTimeout(() => setAnimateStep(false), 500);
    return () => clearTimeout(timer);
  }, [step]);

  const environments = [
    { 
      id: 'voice', 
      name: 'Voice Agent', 
      icon: Mic, 
      desc: 'AI phone agent for inbound/outbound calls — powered by ElevenLabs with CRM integration', 
      complexity: 'Medium → Expert', 
      plan: 'Pro+', 
      color: 'text-light-purple',
      borderClass: 'border-light-purple/30 group-hover:border-light-purple group-hover:shadow-[0_0_30px_rgba(187,134,252,0.3)]',
      bgGlow: 'bg-light-purple/20'
    },
    { 
      id: 'workflow', 
      name: 'Workflow Agent', 
      icon: GitMergeIcon, 
      desc: 'Visual automation canvas with scheduling, events, and 500+ integrations — like n8n and Zapier with built-in AI', 
      complexity: 'Simple → Expert', 
      plan: 'Starter+', 
      color: 'text-teal',
      borderClass: 'border-teal/30 group-hover:border-teal group-hover:shadow-[0_0_30px_rgba(6,214,160,0.3)]',
      bgGlow: 'bg-teal/20'
    },
    { 
      id: 'autonomous', 
      name: 'Autonomous Agent', 
      icon: Bot, 
      desc: 'Goal-driven AI worker that plans, creates workflows, and executes independent research', 
      complexity: 'Medium → Expert', 
      plan: 'Pro+', 
      color: 'text-purple',
      borderClass: 'border-purple/30 group-hover:border-purple group-hover:shadow-[0_0_30px_rgba(157,78,221,0.3)]',
      bgGlow: 'bg-purple/20'
    },
    { 
      id: 'assistant', 
      name: 'AI Assistant', 
      icon: Sparkles, 
      desc: 'Your personal AI partner — works across your entire workspace answering questions and pulling data', 
      complexity: 'Simple → Advanced', 
      plan: 'Free', 
      color: 'text-primary',
      borderClass: 'border-primary/30 group-hover:border-primary group-hover:shadow-[0_0_30px_rgba(67,97,238,0.3)]',
      bgGlow: 'bg-primary/20'
    },
  ];

  const genericStartingPoints = [
    { id: 'ai', name: 'Generate with AI', icon: Wand2, desc: 'Describe in plain English, AI builds the full agent.', color: 'text-primary', glow: 'bg-primary' },
    { id: 'template', name: 'Start from template', icon: LayoutTemplate, desc: 'Choose from 200+ industry templates.', color: 'text-teal', glow: 'bg-teal' },
    { id: 'scratch', name: 'Blank canvas', icon: PlusSquare, desc: 'Start completely from scratch.', color: 'text-light-purple', glow: 'bg-light-purple' },
    { id: 'marketplace', name: 'Import', icon: Search, desc: 'Deploy an agent from the marketplace.', color: 'text-amber', glow: 'bg-amber' },
  ];

  const voiceTemplates = [
    { id: 'inbound_sales', name: 'Inbound Sales Receptionist', icon: Phone, desc: 'Pre-configured to qualify leads, answer FAQs, and book meetings.', color: 'text-light-purple', glow: 'bg-light-purple' },
    { id: 'outbound_leadgen', name: 'Outbound Lead Gen', icon: Zap, desc: 'Cold calling agent optimized for high conversion and overcoming objections.', color: 'text-amber', glow: 'bg-amber' },
    { id: 'customer_support', name: 'Customer Support Triage', icon: Headphones, desc: 'Handles order tracking, returns, and general tier-1 support queries.', color: 'text-teal', glow: 'bg-teal' },
    { id: 'custom_voice', name: 'Custom Voice Agent', icon: PlusSquare, desc: 'Start from a blank slate to build a completely unique voice workflow.', color: 'text-primary', glow: 'bg-primary' },
  ];

  const handleNext = () => {
    if (step === 1 && environment) setStep(2);
    else if (step === 2) {
      if (environment === 'voice' && voiceTemplate) setStep(3);
      else if (environment !== 'voice' && startingPoint) setStep(3);
    }
    else if (step === 3 && agentName) {
      navigate(`/agents/new-agent-id/build?type=${environment}`);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else navigate('/agents');
  };

  function GitMergeIcon(props: any) {
    return (
      <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 21V9a9 9 0 0 0 9 9" />
      </svg>
    );
  }

  const steps = ['Environment', 'Configuration', 'Final Details'];
  const isStep2Valid = environment === 'voice' ? !!voiceTemplate : !!startingPoint;

  return (
    <div className="h-screen w-full flex flex-col font-sans relative overflow-hidden bg-transparent">
      
      {/* ══════ AMBIENT BACKGROUND FROM VOICE AGENT ══════ */}
      {/* Dynamic ambient orbs that slowly pulse and move to give the page "life" */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow mix-blend-screen" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-light-purple/10 rounded-full blur-[150px] pointer-events-none animate-float mix-blend-screen delay-1000" />
      <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-teal/10 rounded-full blur-[100px] pointer-events-none animate-pulse-slow mix-blend-screen delay-700" />

      {/* ══════ TOP PROGRESS BAR ══════ */}
      <header className="h-16 border-b border-border/30 bg-surface/30 backdrop-blur-2xl sticky top-0 z-50 flex items-center justify-between px-6 lg:px-12 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-2 hover:bg-surface-hover rounded-full transition-colors group">
            <ArrowLeft className="w-5 h-5 text-text-muted group-hover:text-text-main group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="font-semibold text-lg flex items-center gap-3">
            <span className="bg-primary/20 text-primary px-3 py-1 rounded-lg text-xs font-bold border border-primary/30 shadow-[0_0_10px_rgba(67,97,238,0.2)]">Step {step} of 3</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">{steps[step-1]}</span>
          </div>
        </div>

        {/* Stepper Dots with Animated Connections */}
        <div className="hidden md:flex items-center gap-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3 group">
              <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-all duration-500 shadow-sm relative ${
                step > i + 1 ? 'bg-primary text-white shadow-[0_0_15px_rgba(67,97,238,0.5)] scale-110' :
                step === i + 1 ? 'border-2 border-primary text-primary bg-primary/10 shadow-[0_0_20px_rgba(67,97,238,0.3)] scale-110 ring-4 ring-primary/20' :
                'bg-surface/50 border border-border/50 text-text-muted'
              }`}>
                {step > i + 1 ? <Check className="w-5 h-5 animate-in zoom-in duration-300" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className="w-16 h-1 rounded-full bg-surface/50 relative overflow-hidden">
                   <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${
                     step > i + 1 ? 'w-full bg-primary shadow-[0_0_10px_rgba(67,97,238,0.8)]' : 'w-0 bg-primary'
                   }`} />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="w-20" />
      </header>

      {/* ══════ MAIN CONTENT AREA ══════ */}
      <main className="flex-1 overflow-y-auto px-6 py-12 lg:px-12 pb-40 relative z-10 scroll-smooth">
        <div className={`max-w-5xl mx-auto transition-all duration-500 transform ${animateStep ? 'opacity-0 translate-y-8 scale-[0.98]' : 'opacity-100 translate-y-0 scale-100'}`}>
          
          {/* STEP 1: ENVIRONMENT */}
          {step === 1 && (
            <div>
              <div className="text-center mb-16 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary/20 rounded-full blur-[50px]" />
                <h1 className="text-5xl font-black tracking-tight mb-5 text-gradient inline-block relative z-10">Choose your architecture</h1>
                <p className="text-text-muted text-xl max-w-2xl mx-auto font-medium relative z-10">Select the core foundation for your new AI agent. Each environment is purpose-built with its own specialized node set and UI.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-5 perspective-1000 max-w-4xl mx-auto">
                {environments.map((env, i) => (
                  <button
                    key={env.id}
                    onClick={() => setEnvironment(env.id)}
                    className={`group relative p-6 rounded-3xl border text-left transition-all duration-500 overflow-hidden flex flex-col h-full transform preserve-3d ${
                      environment === env.id 
                        ? env.borderClass + ' bg-surface/60 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] scale-[1.03] ring-1 ring-white/20 -translate-y-2' 
                        : 'border-white/5 bg-surface/30 backdrop-blur-xl hover:bg-surface/50 hover:shadow-[0_15px_40px_rgba(0,0,0,0.15)] hover:-translate-y-1'
                    }`}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    {/* Immersive Hover Glow */}
                    <div className={`absolute -inset-2 bg-gradient-to-br from-transparent via-transparent to-${env.color.split('-')[1]}/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl`} />
                    <div className={`absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] opacity-0 transition-opacity duration-700 ${env.bgGlow} ${environment === env.id ? 'opacity-60' : 'group-hover:opacity-40'}`} />
                    
                    <div className="relative z-10 flex justify-between items-start mb-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-xl transition-all duration-500 ${
                        environment === env.id 
                          ? `bg-bg/80 border-${env.color.split('-')[1]}/50 shadow-[0_0_20px_rgba(0,0,0,0.2)] scale-110` 
                          : 'bg-surface/50 border-white/10 text-text-main group-hover:scale-110 group-hover:bg-bg/50'
                      }`}>
                        <env.icon className={`w-7 h-7 ${environment === env.id ? env.color : 'text-text-muted group-hover:text-white transition-colors duration-300'}`} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-bg/50 backdrop-blur-md border border-white/10 text-text-muted shadow-inner">
                        {env.plan}
                      </span>
                    </div>
                    
                    <div className="relative z-10 flex-1 flex flex-col">
                      <h3 className={`font-black text-xl mb-2 transition-colors duration-300 ${environment === env.id ? env.color : 'group-hover:text-white'}`}>{env.name}</h3>
                      <p className="text-sm text-text-muted leading-relaxed mb-6 group-hover:text-text-main/90 transition-colors duration-300">{env.desc}</p>
                      
                      <div className="mt-auto pt-4 border-t border-white/10">
                        <span className="text-[11px] font-bold text-text-muted flex items-center gap-2 uppercase tracking-wider">
                          Complexity: <strong className={`px-3 py-1.5 rounded-lg border border-white/5 bg-black/20 ${environment === env.id ? env.color : 'text-white'}`}>{env.complexity}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Active State Selection Ring */}
                    {environment === env.id && (
                       <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50 block" style={{ color: `var(--color-${env.color.split('-')[1]})`}} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: UNIQUE CONFIGURATION */}
          {step === 2 && (
            <div>
               <div className="text-center mb-16 relative">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-teal/10 rounded-full blur-[60px]" />
                 <h1 className="text-5xl font-black tracking-tight mb-5 text-gradient inline-block relative z-10">
                   {environment === 'voice' ? 'Select a Voice Framework' : 'How would you like to begin?'}
                 </h1>
                 <p className="text-text-muted text-xl max-w-2xl mx-auto font-medium relative z-10">
                   {environment === 'voice' 
                     ? 'Start with a pre-configured architecture tuned for specific call types.' 
                     : 'Build from scratch, or let Stone AIO give you a massive head start.'}
                 </p>
               </div>
 
               <div className="grid lg:grid-cols-2 gap-5 w-full max-w-4xl mx-auto">
                 {(environment === 'voice' ? voiceTemplates : genericStartingPoints).map((sp, index) => {
                   const isSelected = environment === 'voice' ? voiceTemplate === sp.id : startingPoint === sp.id;
                   const onSelect = () => environment === 'voice' ? setVoiceTemplate(sp.id) : setStartingPoint(sp.id);
                   
                   return (
                     <button
                       key={sp.id}
                       onClick={onSelect}
                       className={`group relative p-6 rounded-3xl border text-left transition-all duration-500 overflow-hidden flex flex-col justify-between min-h-[160px] transform ${
                         isSelected 
                           ? `border-${sp.color.split('-')[1] || 'primary'}/50 bg-surface/60 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] scale-[1.03] ring-1 ring-white/20 -translate-y-2` 
                           : 'border-white/5 bg-surface/30 backdrop-blur-xl hover:bg-surface/50 hover:shadow-[0_15px_40px_rgba(0,0,0,0.15)] hover:-translate-y-1'
                       }`}
                     >
                       {/* High-impact abstract animated glow */}
                       <div className={`absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-[100px] opacity-0 transition-all duration-1000 ${sp.glow}/30 group-hover:opacity-60 ${isSelected ? 'opacity-80 scale-125' : ''}`} />
                       
                       <div className="relative z-10 flex flex-col gap-6 h-full">
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-xl transition-all duration-500 ${
                           isSelected 
                             ? `bg-bg/90 border-${sp.color.split('-')[1] || 'primary'}/50 scale-110 shadow-[0_0_20px_rgba(0,0,0,0.3)]` 
                             : 'bg-surface/50 border-white/10 text-text-muted group-hover:-translate-y-2 group-hover:bg-bg/50 group-hover:border-white/20 group-hover:shadow-[0_10px_20px_rgba(0,0,0,0.2)]'
                         }`}>
                           <sp.icon className={`w-7 h-7 ${isSelected ? sp.color : 'group-hover:text-white transition-colors duration-300'}`} />
                         </div>
                         
                         <div className="mt-auto">
                           <h3 className={`font-black text-xl mb-2 tracking-tight transition-colors duration-300 ${isSelected ? sp.color : 'group-hover:text-white'}`}>
                             {sp.name}
                           </h3>
                           <p className="text-sm text-text-muted leading-relaxed font-medium group-hover:text-text-main/90 transition-colors">
                             {sp.desc}
                           </p>
                         </div>
                       </div>
                     </button>
                   );
                 })}
               </div>
            </div>
          )}

          {/* STEP 3: FINAL DETAILS */}
          {step === 3 && (
            <div className="max-w-xl mx-auto">
              <div className="text-center mb-12 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-primary/20 rounded-full blur-[50px]" />
                <h1 className="text-4xl font-black tracking-tight mb-4 text-gradient inline-block relative z-10">Final Details</h1>
                <p className="text-text-muted text-lg font-medium relative z-10">Give your new {environments.find(e => e.id === environment)?.name.toLowerCase()} a name and primary objective.</p>
              </div>

              <div className="bg-surface/40 backdrop-blur-3xl border border-white/10 rounded-2xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.2)] relative overflow-hidden group hover:border-white/20 transition-colors duration-500">
                {/* Internal dynamic lighting */}
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/20 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/30 transition-colors duration-1000" />
                
                <div className="space-y-6 relative z-10">
                  <div className="transform transition-all duration-300 hover:translate-x-1">
                    <label className="block text-[11px] font-black tracking-widest text-text-muted uppercase mb-2">Agency Identifier <span className="text-red/80 ml-1">*</span></label>
                    <input 
                      type="text" 
                      autoFocus
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="e.g. Sales Follow-up AI" 
                      className="w-full px-5 py-4 text-lg bg-bg/60 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all font-bold backdrop-blur-xl shadow-inner placeholder-text-muted/50 hover:bg-bg/80 hover:border-white/20"
                    />
                  </div>

                  <div className="transform transition-all duration-300 hover:translate-x-1">
                    <label className="block text-[11px] font-black tracking-widest text-text-muted uppercase mb-2 flex items-center justify-between">
                      Primary Objective <span className="text-[9px] bg-black/30 px-2.5 py-1 rounded-full border border-white/5">Optional</span>
                    </label>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="What is the exact goal of this agent?" 
                      className="w-full px-5 py-4 bg-bg/60 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none backdrop-blur-xl shadow-inner text-sm font-medium placeholder-text-muted/50 hover:bg-bg/80 hover:border-white/20"
                    />
                  </div>

                  {environment === 'voice' && (
                    <div className="p-6 bg-light-purple/5 border border-light-purple/20 rounded-2xl space-y-4 relative overflow-hidden group/voice transform transition-all duration-500 hover:bg-light-purple/10 hover:border-light-purple/40 hover:shadow-[0_0_30px_rgba(187,134,252,0.15)]">
                      {/* Voice specific internal glow */}
                      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-light-purple/10 to-transparent opacity-50 pointer-events-none" />
                      
                      <div className="flex items-center gap-3 text-light-purple font-black tracking-widest text-xs uppercase relative z-10">
                        <div className="p-2 bg-light-purple/20 rounded-lg">
                          <Mic className="w-5 h-5" />
                        </div>
                        Inbound Configuration
                      </div>
                      <div className="relative z-10">
                        <label className="block text-sm font-bold mb-3 text-text-main">Assigned Phone Number</label>
                        <select 
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full px-5 py-4 rounded-2xl border border-light-purple/30 bg-bg/90 focus:outline-none focus:ring-2 focus:ring-light-purple/50 focus:border-light-purple/50 transition-all text-base font-bold backdrop-blur-xl text-white appearance-none cursor-pointer hover:border-light-purple/60 shadow-inner"
                        >
                          <option value="">Select a number or buy a new one...</option>
                          <option value="+1234567890">+1 (234) 567-8900 (US)</option>
                          <option value="buy">+ Buy new number via Twilio Integration</option>
                        </select>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ══════ ULTIMATE GLASS BOTTOM BAR ══════ */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-surface/20 backdrop-blur-3xl border-t border-white/10 z-50 flex justify-between items-center px-8 lg:px-16 shadow-[0_-20px_60px_rgba(0,0,0,0.3)]">
        <button
          onClick={handleBack}
          className="px-8 py-4 rounded-2xl text-base font-bold text-text-muted hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
        >
          Cancel
        </button>
        
        <button
          onClick={handleNext}
          disabled={
            (step === 1 && !environment) || 
            (step === 2 && !isStep2Valid) || 
            (step === 3 && !agentName)
          }
          className="px-10 py-4 rounded-2xl text-base font-black text-white bg-gradient-to-r from-primary to-teal hover:from-primary-hover hover:to-teal-hover transition-all duration-300 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shadow-[0_10px_30px_rgba(67,97,238,0.4)] hover:shadow-[0_15px_40px_rgba(6,214,160,0.5)] flex items-center gap-4 group scale-100 hover:scale-105 active:scale-95 border border-white/20"
        >
          {step === 3 ? 'Generate Builder Environment' : 'Continue to Next Step'}
          {step < 3 && <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />}
          {step === 3 && <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300 animate-pulse" />}
        </button>
      </footer>
    </div>
  );
}
