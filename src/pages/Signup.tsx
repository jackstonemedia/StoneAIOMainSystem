import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Github, CheckCircle2, Sparkles } from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/onboarding');
  };

  return (
    <div className="min-h-screen bg-bg flex font-sans">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 sm:p-12 xl:p-24">
        <div className="max-w-md w-full mx-auto">
          <div className="flex items-center gap-2.5 mb-12">
            <div className="stone-logo w-8 h-8 text-xs">S</div>
            <span className="font-semibold text-sm tracking-tight">Stone AIO</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-2">Create your account</h1>
          <p className="text-text-muted mb-8">Start building with AI for free. No credit card required.</p>

          <form onSubmit={handleSignup} className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">First Name</label>
                <input 
                  type="text" 
                  placeholder="Jane" 
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Last Name</label>
                <input 
                  type="text" 
                  placeholder="Doe" 
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all" 
                  required 
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input 
                type="email" 
                placeholder="you@company.com" 
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all" 
                required 
                minLength={8}
              />
            </div>

            <label className="flex items-start gap-3 mt-6 cursor-pointer group">
              <input type="checkbox" className="mt-1 w-4 h-4 rounded text-primary border-border focus:ring-primary/50" required />
              <span className="text-sm text-text-muted group-hover:text-text-main transition-colors">
                I agree to the <a href="#" className="font-medium text-primary hover:underline">Terms of Service</a> and <a href="#" className="font-medium text-primary hover:underline">Privacy Policy</a>.
              </span>
            </label>
            
            <button type="submit" className="w-full bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-2 mt-6">
              Create Account <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-bg px-3 text-text-muted uppercase tracking-wider font-medium">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg bg-surface hover:bg-surface-hover transition-colors text-sm font-medium">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg bg-surface hover:bg-surface-hover transition-colors text-sm font-medium">
              <Github className="w-4 h-4" />
              GitHub
            </button>
          </div>

          <p className="text-center text-sm text-text-muted mt-8">
            Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Log in</Link>
          </p>
        </div>
      </div>

      {/* Right Panel - Feature Highlights */}
      <div className="hidden lg:flex w-1/2 bg-surface border-l border-border p-12 xl:p-24 flex-col justify-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent-teal/5 pointer-events-none" />
        
        <div className="max-w-lg relative z-10">
          <div className="flex items-center gap-2 mb-8">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-bold">Everything you need, one platform</h2>
          </div>
          
          <div className="space-y-6 stagger-children">
            {[
              { title: 'Workflow Automation', desc: 'Build visual automations with AI at every step. Connect 500+ tools.' },
              { title: 'Voice AI Agents', desc: 'Deploy human-like phone agents powered by ElevenLabs voices.' },
              { title: 'Autonomous Workers', desc: 'Give a goal, get results. Self-planning AI that executes in your cloud.' },
              { title: 'Cloud Computer', desc: 'A secure environment where your AI team operates with full control.' },
            ].map((feature, i) => (
              <div key={i} className="flex gap-4">
                <div className="mt-1 shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-bg border border-border rounded-xl shadow-sm">
            <p className="text-sm italic text-text-muted mb-4">"Stone AIO has completely transformed how our team operates. We've automated 80% of our manual tasks in just two weeks."</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">SJ</div>
              <div>
                <div className="text-sm font-medium">Sarah Jenkins</div>
                <div className="text-xs text-text-muted">VP of Operations, TechFlow</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
