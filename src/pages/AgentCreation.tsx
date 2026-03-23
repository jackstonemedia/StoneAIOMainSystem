import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, Box, FileText, Globe, LayoutTemplate, MessageSquare, 
  Mic, PlusSquare, Search, Sparkles, Wand2, Zap, ArrowRight, ArrowLeft, Check
} from 'lucide-react';

export default function AgentCreation() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [environment, setEnvironment] = useState('');
  const [startingPoint, setStartingPoint] = useState('');
  const [agentName, setAgentName] = useState('');
  const [description, setDescription] = useState('');

  // Voice specific settings (shown if voice is selected)
  const [phoneNumber, setPhoneNumber] = useState('');

  const environments = [
    { 
      id: 'workflow', 
      name: 'Workflow Agent', 
      icon: GitMergeIcon, 
      desc: 'Visual automation canvas with scheduling, events, and 500+ integrations — like n8n and Zapier with built-in AI', 
      complexity: 'Simple → Expert', 
      plan: 'Starter+', 
      color: 'text-teal border-teal/30 bg-teal/5 hover:border-teal hover:bg-teal/10 hover:shadow-teal/20',
      bgGlow: 'group-hover:bg-teal/20'
    },
    { 
      id: 'voice', 
      name: 'Voice Agent', 
      icon: Mic, 
      desc: 'AI phone agent for inbound/outbound calls — powered by ElevenLabs with CRM integration', 
      complexity: 'Medium → Expert', 
      plan: 'Pro+', 
      color: 'text-light-purple border-light-purple/30 bg-light-purple/5 hover:border-light-purple hover:bg-light-purple/10 hover:shadow-light-purple/20',
      bgGlow: 'group-hover:bg-light-purple/20'
    },
    { 
      id: 'autonomous', 
      name: 'Autonomous Agent', 
      icon: Bot, 
      desc: 'Goal-driven AI worker that plans, creates workflows, and executes independent research', 
      complexity: 'Medium → Expert', 
      plan: 'Pro+', 
      color: 'text-purple border-purple/30 bg-purple/5 hover:border-purple hover:bg-purple/10 hover:shadow-purple/20',
      bgGlow: 'group-hover:bg-purple/20'
    },
    { 
      id: 'assistant', 
      name: 'AI Assistant', 
      icon: Sparkles, 
      desc: 'Your personal AI partner — works across your entire workspace answering questions and pulling data', 
      complexity: 'Simple → Advanced', 
      plan: 'Free', 
      color: 'text-primary border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 hover:shadow-primary/20',
      bgGlow: 'group-hover:bg-primary/20'
    },
  ];

  const startingPoints = [
    { id: 'ai', name: 'Generate with AI', icon: Wand2, desc: 'Describe in plain English, AI builds the full agent.' },
    { id: 'template', name: 'Start from template', icon: LayoutTemplate, desc: 'Choose from 200+ industry templates.' },
    { id: 'scratch', name: 'Blank canvas', icon: PlusSquare, desc: 'Start completely from scratch.' },
    { id: 'marketplace', name: 'Import', icon: Search, desc: 'Deploy an agent from the marketplace.' },
  ];

  const handleNext = () => {
    if (step === 1 && environment) setStep(2);
    else if (step === 2 && startingPoint) setStep(3);
    else if (step === 3 && agentName) {
      navigate(`/agents/new-agent-id/build?type=${environment}`);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else navigate('/agents');
  };

  // Helper for Workflow icon
  function GitMergeIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="18" r="3" />
        <circle cx="6" cy="6" r="3" />
        <path d="M6 21V9a9 9 0 0 0 9 9" />
      </svg>
    )
  }

  const steps = ['Environment', 'Starting Point', 'Configuration'];

  return (
    <div className="h-full bg-bg flex flex-col font-sans relative">
      
      {/* Top Progress Bar */}
      <header className="h-16 border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBack}
            className="p-2 hover:bg-surface-hover rounded-full transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 text-text-muted group-hover:text-text-main" />
          </button>
          <div className="font-semibold text-lg flex items-center gap-2">
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md text-sm">Step {step} of 3</span>
            {steps[step-1]}
          </div>
        </div>

        {/* Stepper Dots */}
        <div className="hidden md:flex items-center gap-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all ${
                step > i + 1 ? 'bg-primary text-white' :
                step === i + 1 ? 'border-2 border-primary text-primary' :
                'bg-surface border border-border text-text-muted'
              }`}>
                {step > i + 1 ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 h-0.5 rounded-full transition-colors ${
                  step > i + 1 ? 'bg-primary' : 'bg-border'
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="w-20" /> {/* Spacer for centering */}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-6 py-12 lg:px-12 pb-32">
        <div className="max-w-5xl mx-auto">
          
          {/* STEP 1: ENVIRONMENT */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold tracking-tight mb-4 text-gradient inline-block">Choose your architecture</h1>
                <p className="text-text-muted text-lg max-w-2xl mx-auto">Select the core foundation for your new AI agent. Each environment is purpose-built with its own specialized node set and UI.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {environments.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => setEnvironment(env.id)}
                    className={`group relative p-6 rounded-2xl border border-white/10 text-left transition-all duration-300 overflow-hidden flex flex-col h-full ${
                      environment === env.id 
                        ? env.color + ' shadow-xl scale-[1.02] ring-2 ring-primary/20 bg-surface/30 backdrop-blur-xl' 
                        : 'bg-surface/10 backdrop-blur-xl hover:border-primary/50 hover:bg-surface/30 hover:shadow-lg'
                    }`}
                  >
                    {/* Background glow orb */}
                    <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-0 transition-opacity duration-500 ${env.bgGlow} ${environment === env.id ? 'opacity-50' : ''}`} />
                    
                    <div className="relative z-10 flex justify-between items-start mb-6">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 shadow-sm ${environment === env.id ? 'bg-bg/50 border-current' : 'bg-surface border-border text-text-main group-hover:scale-110 transition-transform'}`}>
                        <env.icon className={`w-7 h-7 ${environment === env.id ? '' : 'text-text-muted group-hover:text-text-main transition-colors'}`} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-bg border border-border text-text-muted shadow-sm">
                        {env.plan}
                      </span>
                    </div>
                    
                    <div className="relative z-10">
                      <h3 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors">{env.name}</h3>
                      <p className="text-sm text-text-muted leading-relaxed mb-5 group-hover:text-text-main transition-colors">{env.desc}</p>
                      
                      <div className="mt-auto pt-5 border-t border-border/50">
                        <span className="text-sm font-medium text-text-muted flex items-center gap-2">
                          Complexity: <strong className="text-text-main">{env.complexity}</strong>
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: STARTING POINT */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
               <div className="text-center mb-12">
                 <h1 className="text-4xl font-bold tracking-tight mb-4 text-gradient inline-block">How would you like to begin?</h1>
                 <p className="text-text-muted text-lg max-w-2xl mx-auto">Build from scratch, or let Stone AIO give you a massive head start.</p>
               </div>
 
               <div className="grid lg:grid-cols-2 gap-6 w-full max-w-5xl mx-auto">
                 {startingPoints.map((sp, index) => (
                   <button
                     key={sp.id}
                     onClick={() => setStartingPoint(sp.id)}
                     className={`group relative p-6 rounded-2xl border border-white/10 text-left transition-all duration-300 overflow-hidden flex flex-col justify-between min-h-[160px] ${
                       startingPoint === sp.id 
                         ? 'border-primary/50 bg-primary/10 backdrop-blur-xl shadow-2xl scale-[1.02] ring-2 ring-primary/20' 
                         : 'bg-surface/10 backdrop-blur-xl hover:border-primary/50 hover:bg-surface/30 hover:shadow-xl'
                     }`}
                   >
                     {/* Dynamic glowing background based on index */}
                     <div className={`absolute -bottom-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-0 transition-all duration-700 ${
                       index === 0 ? 'bg-purple/20 group-hover:opacity-60' :
                       index === 1 ? 'bg-primary/20 group-hover:opacity-60' :
                       index === 2 ? 'bg-teal/20 group-hover:opacity-60' :
                       'bg-amber/20 group-hover:opacity-60'
                     }`} />
                     
                     <div className="relative z-10 flex flex-col gap-6">
                       <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-sm transition-all duration-300 ${
                         startingPoint === sp.id ? 'bg-primary border-primary text-white shadow-primary/30' : 'bg-surface border-border text-text-muted group-hover:-translate-y-2 group-hover:text-primary group-hover:border-primary/30'
                       }`}>
                         <sp.icon className="w-8 h-8" />
                       </div>
                       
                       <div>
                         <h3 className={`font-bold text-xl mb-2 tracking-tight transition-colors ${startingPoint === sp.id ? 'text-primary' : 'group-hover:text-primary'}`}>
                           {sp.name}
                         </h3>
                         <p className="text-sm text-text-muted leading-relaxed font-medium">
                           {sp.desc}
                         </p>
                       </div>
                     </div>
                   </button>
                 ))}
               </div>
            </div>
          )}

          {/* STEP 3: CONFIGURATION */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-2xl mx-auto">
              <div className="text-center mb-10">
                <h1 className="text-4xl font-bold tracking-tight mb-4 text-gradient inline-block">Final Details</h1>
                <p className="text-text-muted text-lg">Give your new {environments.find(e => e.id === environment)?.name.toLowerCase()} a name and primary objective.</p>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-8 shadow-xl">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Agent Name <span className="text-red">*</span></label>
                    <input 
                      type="text" 
                      autoFocus
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="e.g. Sales Follow-up Bot" 
                      className="w-full px-5 py-4 text-lg bg-bg border-2 border-border rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 flex items-center justify-between">
                      Objective <span className="text-text-muted text-xs font-normal">Optional</span>
                    </label>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="What is the primary goal of this agent?" 
                      className="w-full px-5 py-4 bg-bg border-2 border-border rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                    />
                  </div>

                  {environment === 'voice' && (
                    <div className="p-5 bg-light-purple/5 border border-light-purple/20 rounded-xl space-y-4">
                      <div className="flex items-center gap-2 text-light-purple font-semibold">
                        <Mic className="w-5 h-5" /> Initial Voice Setup
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Phone Number</label>
                        <select 
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border-2 border-border bg-bg focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all"
                        >
                          <option value="">Select a number or buy a new one...</option>
                          <option value="+1234567890">+1 (234) 567-8900 (US)</option>
                          <option value="buy">+ Buy new number</option>
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

      {/* Highly Transparent Liquid Frosted Glass Bottom Bar */}
      <footer className="absolute bottom-0 left-0 right-0 p-5 bg-bg/20 backdrop-blur-3xl border-t border-white/5 z-50 flex justify-between items-center px-10 slide-in-from-bottom-4 animate-in duration-500 shadow-[0_-30px_60px_rgba(0,0,0,0.15)]">
        <button
          onClick={handleBack}
          className="px-6 py-3 rounded-xl text-sm font-medium text-text-muted hover:text-text-main hover:bg-bg/50 transition-colors"
        >
          Cancel
        </button>
        
        <button
          onClick={handleNext}
          disabled={
            (step === 1 && !environment) || 
            (step === 2 && !startingPoint) || 
            (step === 3 && !agentName)
          }
          className="px-8 py-4 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(67,97,238,0.3)] hover:shadow-[0_0_30px_rgba(67,97,238,0.5)] flex items-center gap-3 group"
        >
          {step === 3 ? 'Generate Builder Environment' : 'Continue to Next Step'}
          {step < 3 && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          {step === 3 && <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
        </button>
      </footer>
    </div>
  );
}
