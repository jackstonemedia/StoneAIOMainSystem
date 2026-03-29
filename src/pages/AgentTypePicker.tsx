import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, GitMerge, MessageSquare, ArrowRight } from 'lucide-react';

const AGENT_TYPES = [
  {
    id: 'voice',
    name: 'Voice Agent',
    emoji: '🎙️',
    tagline: 'Answer calls, qualify leads, book appointments 24/7',
    description: 'Deploy a hyper-realistic AI phone agent powered by ElevenLabs. Handles inbound & outbound calls, integrates with your CRM, and never misses a lead.',
    tags: ['Inbound Calls', 'Lead Qualification', 'Appointment Booking', 'CRM Sync'],
    colorHex: 'rgba(187,134,252,1)',
    glowHex: 'rgba(187,134,252,0.2)',
    route: '/agents/voice/new',
  },
  {
    id: 'workflow',
    name: 'Workflow Agent',
    emoji: '⚡',
    tagline: 'Automate any business process with a visual canvas',
    description: 'Visual drag-and-drop automation builder with 500+ integrations. Build complex multi-step flows with AI decision logic, scheduling, and webhooks.',
    tags: ['Visual Builder', '500+ Integrations', 'AI Logic', 'Scheduling'],
    colorHex: 'rgba(6,214,160,1)',
    glowHex: 'rgba(6,214,160,0.18)',
    route: '/agents/workflow/new',
  },
  {
    id: 'assistant',
    name: 'AI Assistant',
    emoji: '✨',
    tagline: 'Your personal AI that knows your entire workspace',
    description: 'A context-aware AI partner that answers questions, pulls CRM data, summarizes campaigns, helps write content, and navigates your entire workspace.',
    tags: ['Context-Aware', 'Workspace Access', 'Content Generation', 'Q&A'],
    colorHex: 'rgba(67,97,238,1)',
    glowHex: 'rgba(67,97,238,0.2)',
    route: '/assistant',
  },
];

export default function AgentTypePicker() {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-full flex flex-col relative overflow-hidden bg-transparent font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[500px] bg-teal/8 rounded-full blur-[120px] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />

      <header className="relative z-10 h-16 border-b border-border/30 bg-surface/20 backdrop-blur-2xl flex items-center px-6 lg:px-12 gap-4 shrink-0">
        <button onClick={() => navigate('/agents')} className="p-2 hover:bg-surface-hover rounded-full transition-colors group">
          <ArrowLeft className="w-5 h-5 text-text-muted group-hover:text-text-main group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div>
          <h2 className="font-bold text-sm text-text-main">Create a new agent</h2>
          <p className="text-[11px] text-text-muted">Pick the right type to get started</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-12 lg:px-16 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-4 text-gradient">
              What would you like to build?
            </h1>
            <p className="text-text-muted text-lg max-w-xl mx-auto font-medium">
              Each agent is purpose-built with its own builder and feature set. Click one to go straight in.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {AGENT_TYPES.map((agent, i) => (
              <button
                key={agent.id}
                onClick={() => navigate(agent.route)}
                className="group relative flex flex-col text-left p-7 rounded-3xl border border-white/8 bg-surface/30 backdrop-blur-xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: agent.glowHex }} />

                <div
                  className="absolute inset-0 rounded-3xl border opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ borderColor: agent.colorHex.replace('1)', '0.35)') }}
                />

                <div
                  className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110 border"
                  style={{ background: agent.glowHex, borderColor: agent.colorHex.replace('1)', '0.25)') }}
                >
                  <span className="text-3xl">{agent.emoji}</span>
                </div>

                <div className="relative z-10 mb-3">
                  <h3 className="text-2xl font-black mb-2">{agent.name}</h3>
                  <p className="text-sm font-semibold text-text-muted group-hover:text-text-main transition-colors leading-snug">
                    {agent.tagline}
                  </p>
                </div>

                <p className="relative z-10 text-xs text-text-muted leading-relaxed mb-5 flex-1">
                  {agent.description}
                </p>

                <div className="relative z-10 flex flex-wrap gap-1.5 mb-5">
                  {agent.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                      style={{ background: agent.glowHex, borderColor: agent.colorHex.replace('1)', '0.2)'), color: agent.colorHex }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="relative z-10 flex items-center gap-2 text-sm font-black group-hover:gap-3 transition-all duration-300" style={{ color: agent.colorHex }}>
                  Build Now <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
