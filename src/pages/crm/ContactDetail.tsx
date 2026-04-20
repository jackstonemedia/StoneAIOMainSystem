import React, { useState } from 'react';
import { 
  ChevronLeft, ChevronRight, User, Star, Plus, Phone, 
  Clock, CheckCircle2, Edit2, Calendar, Mail, DollarSign, 
  Share2, ChevronDown, Lock, Smile, Tag, FileText, Sparkles,
  ChevronUp, UserPlus
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ContactDetail() {
  const [activeTab, setActiveTab] = useState<'contact' | 'company'>('contact');
  const [commsTab, setCommsTab] = useState<'sms' | 'email' | 'internal' | 'whatsapp'>('sms');

  return (
    <div className="flex flex-col h-full w-full relative" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header section */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/business/crm/contacts" className="flex items-center text-[13px] font-semibold text-text-muted hover:text-text-main transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-accent-green/20">
              <Star className="w-3 h-3 text-accent-green fill-accent-green" />
            </div>
            <h1 className="text-[16px] font-bold text-text-main">John Smith</h1>
          </div>
          <div className="flex items-center gap-1 text-[12px] font-medium text-text-muted bg-surface-hover px-2 py-0.5 rounded-[4px]">
            1 of 2 selected <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Owner & Follower */}
          <div className="flex items-center gap-3 border-r border-border pr-6">
            <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-[4px] hover:bg-surface-hover transition-colors">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">JS</div>
              <span className="text-[13px] font-medium text-text-main">Jack Stone</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </button>
            <button className="w-8 h-8 rounded-full border border-dashed border-border flex items-center justify-center text-text-muted hover:border-primary hover:text-primary transition-colors tooltip-target">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-2">
            <div className="flex">
              <button className="flex items-center justify-center w-8 h-8 bg-accent-green text-white rounded-l-[4px] hover:bg-[#0e9f6e] transition-colors">
                <Phone className="w-4 h-4" />
              </button>
              <button className="flex items-center justify-center w-6 h-8 bg-[#0e9f6e] text-white rounded-r-[4px] border-l border-white/20 hover:bg-accent-green transition-colors">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {[
              { icon: Clock, color: 'text-[#f59e0b]' },
              { icon: CheckCircle2, color: 'text-text-muted hover:text-accent-green' },
              { icon: Edit2, color: 'text-text-muted hover:text-primary' },
              { icon: Calendar, color: 'text-text-muted hover:text-primary' },
              { icon: Mail, color: 'text-text-muted hover:text-primary' },
              { icon: DollarSign, color: 'text-text-muted hover:text-accent-green' },
              { icon: Share2, color: 'text-text-muted hover:text-primary' }
            ].map((btn, i) => (
              <button key={i} className={`w-8 h-8 rounded-[4px] flex items-center justify-center border border-border hover:bg-surface-hover transition-colors ${btn.color}`}>
                <btn.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 3-pane layout */}
      <div className="flex-1 overflow-hidden flex bg-surface">
        
        {/* Left Pane - Info */}
        <div className="w-[320px] flex flex-col border-r border-border shrink-0 bg-surface">
          <div className="px-4 pt-3 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActiveTab('contact')}
                className={`pb-3 text-[13px] font-semibold border-b-[3px] transition-colors ${activeTab === 'contact' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'}`}
              >
                Contact
              </button>
              <button 
                onClick={() => setActiveTab('company')}
                className={`pb-3 text-[13px] font-semibold border-b-[3px] transition-colors ${activeTab === 'company' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'}`}
              >
                Company
              </button>
            </div>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-end mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded-[4px] border-border text-primary focus:ring-primary/30" />
                <span className="text-[12px] font-medium text-text-muted">Hide empty fields</span>
              </label>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between bg-surface-hover px-3 py-2 rounded-t-[6px] border border-border border-b-0 cursor-pointer">
                <span className="text-[13px] font-bold text-text-main">Contact</span>
                <ChevronUp className="w-4 h-4 text-text-muted" />
              </div>
              <div className="border border-border rounded-b-[6px] p-4 flex flex-col gap-4">
                {[
                  { label: 'First Name', value: 'John' },
                  { label: 'Last Name', value: 'Smith' },
                  { label: 'Email', value: 'john.smith@example.com' },
                  { label: 'Phone', value: '+1 (555) 123-4567' },
                  { label: 'Date of Birth', value: '' },
                  { label: 'Contact Source', value: 'Manual Entry' },
                  { label: 'Contact Type', value: 'Customer' },
                  { label: 'Timezone', value: 'America/New_York' },
                ].map((field, i) => (
                  <div key={i} className="flex flex-col relative group">
                    <label className="text-[11px] font-semibold text-text-muted mb-1">{field.label}</label>
                    <input 
                      type="text" 
                      defaultValue={field.value} 
                      placeholder="—"
                      className="w-full bg-transparent border-b border-border text-[13px] text-text-main pb-1 focus:outline-none focus:border-primary transition-colors placeholder:text-text-muted/40"
                    />
                  </div>
                ))}
                
                <div className="pt-2 flex justify-end">
                  <button className="px-4 py-1.5 rounded-[4px] text-[13px] font-semibold text-white transition-colors" style={{ backgroundColor: 'var(--primary)' }}>Save</button>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between bg-surface-hover px-3 py-2 rounded-[6px] border border-border cursor-pointer">
                <span className="text-[13px] font-bold text-text-main">General Info</span>
                <ChevronDown className="w-4 h-4 text-text-muted" />
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center justify-between bg-surface-hover px-3 py-2 rounded-[6px] border border-border cursor-pointer">
                <span className="text-[13px] font-bold text-text-main">Additional Info</span>
                <ChevronDown className="w-4 h-4 text-text-muted" />
              </div>
            </div>

          </div>
        </div>

        {/* Middle Pane - Comms Center */}
        <div className="flex-1 flex flex-col min-w-[400px]">
          <div className="px-6 pt-3 flex items-center justify-between border-b border-border bg-surface shrink-0">
            <div className="flex items-center gap-6">
              {[
                { id: 'sms', label: 'SMS', icon: null },
                { id: 'email', label: 'Email', icon: null },
                { id: 'internal', label: 'Internal Comment', icon: Lock },
                { id: 'whatsapp', label: 'WhatsApp', icon: null }
              ].map(t => (
                <button 
                  key={t.id}
                  onClick={() => setCommsTab(t.id as any)}
                  className={`flex items-center gap-1.5 pb-3 text-[13px] font-semibold border-b-[3px] transition-colors ${commsTab === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'}`}
                >
                  {t.icon && <t.icon className="w-3.5 h-3.5" />}
                  {t.label}
                  {t.id === 'internal' && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-[4px]">Private</span>}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 flex flex-col p-6 bg-bg overflow-y-auto w-full">
            <div className="flex flex-col flex-1 bg-surface border border-border rounded-[8px] shadow-sm overflow-hidden flex-shrink-0">
              <div className="flex flex-col border-b border-border bg-surface-hover/30">
                <div className="flex items-center px-4 py-2.5 border-b border-border text-[13px]">
                  <span className="text-text-muted w-12 font-medium">From:</span>
                  <div className="flex items-center gap-2 flex-1 cursor-pointer hover:text-primary transition-colors">
                    <span className="font-semibold text-text-main">(Example) Jack Stone (+1 555-0000)</span>
                    <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                </div>
                <div className="flex items-center px-4 py-2.5 text-[13px]">
                  <span className="text-text-muted w-12 font-medium">To:</span>
                  <div className="flex items-center gap-2 flex-1 cursor-pointer hover:text-primary transition-colors">
                    <span className="font-semibold text-text-main">(+) John Smith (+1 555-1234)</span>
                    <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                </div>
              </div>
              
              <div className="flex-1 relative bg-surface flex flex-col max-h-[300px]">
                <textarea 
                  className="w-full h-full p-4 text-[14px] text-text-main placeholder:text-text-muted/50 resize-y outline-none bg-transparent styled-scrollbar flex-1 min-h-[120px]"
                  placeholder={`Type your ${commsTab} message here...`}
                />
                
                <div className="flex items-center justify-between p-3 border-t border-border bg-surface shrink-0">
                  <div className="flex items-center gap-2">
                    <button className="w-8 h-8 flex items-center justify-center rounded-[4px] text-text-muted hover:bg-surface-hover transition-colors font-bold text-[14px]">A</button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-[4px] text-text-muted hover:bg-surface-hover transition-colors"><Smile className="w-4 h-4" /></button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-[4px] text-text-muted hover:bg-surface-hover transition-colors"><Tag className="w-4 h-4" /></button>
                    <button className="w-8 h-8 flex items-center justify-center rounded-[4px] text-text-muted hover:bg-surface-hover transition-colors"><FileText className="w-4 h-4" /></button>
                    <div className="w-[1px] h-4 bg-border mx-1" />
                    <button className="w-8 h-8 flex items-center justify-center rounded-[4px] text-primary hover:bg-primary/10 transition-colors"><Sparkles className="w-4 h-4" /></button>
                  </div>
                  <div className="text-[12px] font-medium text-text-muted">
                    Segs: 0
                  </div>
                </div>
              </div>
              
              <div className="p-3 border-t border-border bg-surface-hover flex items-center justify-between shrink-0">
                <button className="px-4 py-1.5 rounded-[4px] text-[13px] font-semibold text-text-muted hover:text-text-main hover:bg-surface transition-colors">Clear</button>
                <div className="flex items-center">
                  <button className="px-6 py-1.5 rounded-l-[4px] text-[13px] font-semibold text-white transition-colors border-r border-white/20" style={{ backgroundColor: 'var(--primary)' }}>
                    Send
                  </button>
                  <button className="px-2 py-1.5 rounded-r-[4px] text-white transition-colors hover:bg-primary-hover flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-8 text-center text-text-muted">
              {/* Additional message feed would go here */}
            </div>
          </div>
        </div>

        {/* Right Pane - Activity */}
        <div className="w-[320px] flex flex-col border-l border-border shrink-0 bg-surface">
          <div className="p-4 border-b border-border flex items-center justify-between bg-surface-hover/30">
            <button className="flex items-center gap-2 text-[14px] font-bold text-text-main hover:text-primary transition-colors">
              Activity (EDT) <ChevronDown className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {[CheckCircle2, Clock, Calendar, FileText, Mail].map((Icon, i) => (
                <button key={i} className="w-7 h-7 flex items-center justify-center rounded-[4px] text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 flex flex-col p-4 bg-bg">
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-32 h-32 mb-6 opacity-80 relative">
                <div className="absolute inset-0 border-2 border-dashed border-border rounded-xl bg-surface-hover flex items-center justify-center">
                  <Clock className="w-10 h-10 text-border" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-surface rounded-full shadow-sm border border-border flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-text-muted" />
                </div>
              </div>
              <h3 className="text-[15px] font-bold text-text-main mb-2">No activities yet!</h3>
              <p className="text-[13px] text-text-muted max-w-[200px]">Send an email, make a call, or add a note to start the timeline.</p>
            </div>
            
            <div className="pt-4 text-center">
              <span className="text-[11px] font-medium text-text-muted">First attribution source: <span className="font-bold">CRM UI</span></span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
