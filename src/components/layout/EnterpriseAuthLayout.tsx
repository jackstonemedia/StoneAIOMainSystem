import React from 'react';
import { Sparkles, ShieldCheck, Zap, Activity } from 'lucide-react';

export default function EnterpriseAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex bg-[#0A0A0A] text-white font-sans selection:bg-primary/30">
      
      {/* ── Left Pane: Auth Form ── */}
      <div className="w-full lg:w-[45%] flex flex-col justify-between p-8 sm:p-12 border-r border-white/10 relative z-10 bg-[#0A0A0A]">
        
        {/* Header / Logo */}
        <div className="flex items-center gap-3 animate-fade-up">
          <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            S
          </div>
          <span className="font-semibold text-sm tracking-tight text-white/90">Stone AIO</span>
        </div>

        {/* Center Auth Container */}
        <div className="flex-1 flex items-center justify-center py-12 animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="w-full max-w-[400px]">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs font-medium text-white/40 flex items-center gap-4 animate-fade-up" style={{ animationDelay: '200ms' }}>
          <span>© 2026 Stone AI Platform</span>
          <a href="#" className="hover:text-white/80 transition-colors">Privacy</a>
          <a href="#" className="hover:text-white/80 transition-colors">Terms</a>
        </div>
      </div>

      {/* ── Right Pane: Enterprise Showcase ── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-[#050505]">
        
        {/* Subtle grid background */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
            backgroundSize: '48px 48px'
          }}
        />

        {/* Diagonal Light Beam */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 blur-[150px] rounded-full translate-x-1/3 -translate-y-1/3 opacity-50 pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 flex flex-col justify-center p-20 w-full max-w-3xl mx-auto h-full">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-white/70 mb-8 w-fit backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Multi-Tenant Platform
          </div>

          <h2 className="text-5xl font-bold tracking-tight mb-6 leading-[1.1] text-white">
            The intelligent operating <br/>
            <span className="text-white/50">system for your business.</span>
          </h2>

          <p className="text-lg text-white/60 mb-12 max-w-lg leading-relaxed">
            Secure, scalable, and fully integrated. Deploy autonomous agents, orchestrate complex workflows, and manage your CRM inside isolated, enterprise-grade workspaces.
          </p>

          {/* Feature List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-white/80" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1 text-white/90">Isolated Tenancy</h4>
                <p className="text-xs text-white/50 leading-relaxed">Dedicated database schemas and secure key management per workspace.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-white/80" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1 text-white/90">High Performance</h4>
                <p className="text-xs text-white/50 leading-relaxed">Optimized native workflow engine processing millions of tasks instantly.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-white/80" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1 text-white/90">Real-time Metrics</h4>
                <p className="text-xs text-white/50 leading-relaxed">Live dashboards tracking agent success rates and system health.</p>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
