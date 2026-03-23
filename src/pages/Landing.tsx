import { Link } from 'react-router-dom';
import { Bot, Zap, Mic, ArrowRight, Play, Sparkles, GitMerge, MessageSquare, Server } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg text-text-main font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="stone-logo w-8 h-8 text-xs">S</div>
            <span className="font-semibold text-sm tracking-tight">Stone AIO</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-text-muted">
            <a href="#features" className="hover:text-text-main transition-colors">Features</a>
            <Link to="/marketplace" className="hover:text-text-main transition-colors">Marketplace</Link>
            <a href="#pricing" className="hover:text-text-main transition-colors">Pricing</a>
            <a href="#" className="hover:text-text-main transition-colors">Docs</a>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-text-muted hover:text-text-main transition-colors">
              Log In
            </Link>
            <Link to="/signup" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25 flex items-center gap-2">
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary mb-8 animate-fade-up">
          <Sparkles className="w-3.5 h-3.5" /> The all-in-one AI platform for creators & businesses
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6 animate-fade-up">
          Your AI Team,{' '}
          <span className="text-gradient">Always On</span>
        </h1>
        
        <p className="text-lg text-text-muted mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-up" style={{ animationDelay: '100ms' }}>
          Build workflow automations, deploy voice agents, launch autonomous AI workers, 
          and chat with your personal AI assistant — all from one powerful platform.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: '200ms' }}>
          <Link to="/signup" className="w-full sm:w-auto bg-primary text-white px-8 py-3.5 rounded-lg font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-2">
            Start Building Free
          </Link>
          <button className="w-full sm:w-auto bg-surface text-text-main border border-border px-8 py-3.5 rounded-lg font-medium hover:bg-surface-hover transition-colors flex items-center justify-center gap-2">
            <Play className="w-4 h-4" /> Watch Demo
          </button>
        </div>
        <p className="text-xs text-text-muted mt-4">Free forever plan · No credit card required</p>
      </section>

      {/* Social Proof */}
      <section className="border-y border-border bg-surface/50 py-8">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center stagger-children">
          <div>
            <div className="text-3xl font-bold mb-1">12k+</div>
            <div className="text-xs text-text-muted uppercase tracking-wider font-medium">Agents Deployed</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-1">4,500</div>
            <div className="text-xs text-text-muted uppercase tracking-wider font-medium">Users</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-1">2.4M</div>
            <div className="text-xs text-text-muted uppercase tracking-wider font-medium">Tasks Completed</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-1">99.9%</div>
            <div className="text-xs text-text-muted uppercase tracking-wider font-medium">Uptime</div>
          </div>
        </div>
      </section>

      {/* 4 Agent Types */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Four Powerful AI Agents</h2>
          <p className="text-3xl md:text-4xl font-bold">The right agent for every job</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 stagger-children">
          {/* Workflow Agent */}
          <div className="bg-surface border border-border rounded-2xl p-8 relative overflow-hidden group hover:border-teal/50 transition-all hover:shadow-lg">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal to-teal/50" />
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal/10 text-teal text-xs font-medium mb-6">
              <GitMerge className="w-3.5 h-3.5" /> Workflow Agent
            </div>
            <h3 className="text-xl font-semibold mb-3">Visual Automation Builder</h3>
            <p className="text-text-muted text-sm leading-relaxed">
              Build powerful automations with a drag-and-drop canvas. Connect 500+ apps, 
              add AI at every step, and trigger from events, schedules, or webhooks. 
              Like n8n and Zapier, but with AI native intelligence.
            </p>
          </div>

          {/* Voice Agent */}
          <div className="bg-surface border border-border rounded-2xl p-8 relative overflow-hidden group hover:border-light-purple/50 transition-all hover:shadow-lg">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-light-purple to-light-purple/50" />
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-light-purple/10 text-light-purple text-xs font-medium mb-6">
              <Mic className="w-3.5 h-3.5" /> Voice Agent
            </div>
            <h3 className="text-xl font-semibold mb-3">AI Phone Agents</h3>
            <p className="text-text-muted text-sm leading-relaxed">
              Deploy human-like AI phone agents for inbound and outbound calls. 
              Powered by ElevenLabs voices with real-time transcription, knowledge bases, 
              and CRM integration built in.
            </p>
          </div>

          {/* Autonomous Agent */}
          <div className="bg-surface border border-border rounded-2xl p-8 relative overflow-hidden group hover:border-purple/50 transition-all hover:shadow-lg">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple to-purple/50" />
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple/10 text-purple text-xs font-medium mb-6">
              <Bot className="w-3.5 h-3.5" /> Autonomous Agent
            </div>
            <h3 className="text-xl font-semibold mb-3">Goal-Driven AI Workers</h3>
            <p className="text-text-muted text-sm leading-relaxed">
              Give it a goal and watch it plan, research, create workflows, and execute. 
              Self-directing agents that work inside your Cloud Computer with safe, 
              granular access controls.
            </p>
          </div>

          {/* AI Assistant */}
          <div className="bg-surface border border-border rounded-2xl p-8 relative overflow-hidden group hover:border-primary/50 transition-all hover:shadow-lg">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
              <MessageSquare className="w-3.5 h-3.5" /> AI Assistant
            </div>
            <h3 className="text-xl font-semibold mb-3">Your Personal AI Partner</h3>
            <p className="text-text-muted text-sm leading-relaxed">
              A Claude-level AI assistant that works across your entire platform. 
              Manage projects Notion-style, customize its personality, and let it 
              control every tool in your workspace.
            </p>
          </div>
        </div>
      </section>

      {/* Cloud Computer Section */}
      <section className="py-24 px-6 bg-surface/50 border-y border-border">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary mb-6">
            <Server className="w-3.5 h-3.5" /> Cloud Computer
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Your AI's home base</h2>
          <p className="text-text-muted text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
            A secure cloud environment where your AI agents live and work. 
            Terminal access, file management, and full control — like having a virtual 
            office for your AI team.
          </p>
          <Link to="/signup" className="inline-flex bg-primary text-white px-8 py-3.5 rounded-lg font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25 items-center gap-2">
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
      
      {/* Footer CTA */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to build your AI team?</h2>
        <p className="text-text-muted mb-8 text-lg">Start building for free today. No credit card required.</p>
        <Link to="/signup" className="inline-flex bg-primary text-white px-8 py-3.5 rounded-lg font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25 items-center justify-center gap-2">
          Create Free Account
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-text-muted">
          <div className="flex items-center gap-2">
            <div className="stone-logo w-6 h-6 text-[8px]">S</div>
            <span className="font-medium">Stone AIO</span>
          </div>
          <p>© 2026 Stone AIO. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
