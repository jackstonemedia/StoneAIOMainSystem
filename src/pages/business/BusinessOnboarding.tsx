import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, X, Mail, Phone, AtSign, Building2, CircleDollarSign, AlignLeft, Tag, CalendarDays, BarChart, MessageSquare, Briefcase, Info } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Step = 1 | 2 | 3;

interface BusinessOnboardingProps {
  onComplete: () => void;
}

const columnOptions = [
  { id: 'email', label: 'Email', color: 'text-text-muted0 bg-primary/100/10 border-primary/30' },
  { id: 'accounts', label: 'Accounts', color: 'text-primary bg-rose-500/10 border-rose-500/30' },
  { id: 'deals', label: 'Deals', color: 'text-primary bg-rose-500/10 border-rose-500/30' },
  { id: 'phone', label: 'Phone', color: 'text-text-muted0 bg-primary/100/10 border-primary/30' },
  { id: 'type', label: 'Type', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'priority', label: 'Priority', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'title', label: 'Title', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'dealsValue', label: 'Deals value', color: 'text-primary bg-rose-500/10 border-rose-500/30' },
  { id: 'comments', label: 'Comments', color: 'text-text-muted0 bg-primary/100/10 border-primary/30' },
];

const integrationTools = [
  { id: 'gmail', label: 'Gmail', icon: Mail, color: 'text-red-500' },
  { id: 'outlook', label: 'Outlook', icon: Mail, color: 'text-text-muted' },
  { id: 'gcal', label: 'Google Calendar', icon: CalendarDays, color: 'text-text-muted' },
  { id: 'ocal', label: 'Outlook Calendar', icon: CalendarDays, color: 'text-text-muted' },
  { id: 'fb', label: 'Facebook Ads', icon: BarChart, color: 'text-text-muted' },
  { id: 'linkedin', label: 'LinkedIn', icon: Briefcase, color: 'text-text-muted' },
  { id: 'mailchimp', label: 'Mailchimp', icon: Mail, color: 'text-text-muted0' },
  { id: 'teams', label: 'Microsoft Teams', icon: MessageSquare, color: 'text-text-muted' },
  { id: 'hubspot', label: 'Hubspot', icon: CircleDollarSign, color: 'text-text-muted0' },
  { id: 'zoom', label: 'Zoom', icon: MessageSquare, color: 'text-text-muted' },
];

export default function BusinessOnboarding({ onComplete }: BusinessOnboardingProps) {
  const [step, setStep] = useState<Step>(1);
  const [contacts, setContacts] = useState(['Robert Thompson', 'Steven Scott', '']);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(['email', 'accounts', 'deals', 'phone']);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  const handleContactChange = (index: number, value: string) => {
    const newContacts = [...contacts];
    newContacts[index] = value;
    
    // Auto add new rows if the last one is being typed in
    if (index === newContacts.length - 1 && value.trim() !== '') {
      newContacts.push('');
    }
    setContacts(newContacts);
  };

  const toggleColumn = (id: string) => {
    setSelectedColumns(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleTool = (id: string) => {
    setSelectedTools(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-surface font-sans overflow-hidden">
      
      {/* Left Panel - Wizard */}
      <div className="w-[45%] min-w-[500px] h-full flex flex-col pt-12 pb-8 px-16 relative">
        
        {/* Logo Header */}
        <div className="flex items-center gap-2 mb-20 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md" style={{ background: 'var(--primary)' }}>
            <div className="w-3 h-3 bg-surface rounded-full"></div>
          </div>
          <span className="font-bold text-xl text-text-main tracking-tight">Stone CRM</span>
        </div>

        {/* Step 1: Contacts */}
        {step === 1 && (
          <div className="flex-1 animate-in slide-in-from-right-8 fade-in duration-500">
            <h1 className="text-3xl font-bold text-text-main mb-2">Next, add a few contacts</h1>
            <p className="text-sm text-text-main mb-8 flex items-center gap-1.5">
              <span className="bg-surface-hover px-1 py-0.5 rounded text-xs border border-border"><Info className="w-3 h-3 text-primary inline" /></span>
              Each row represents a single contact. You can add more information later.
            </p>
            
            <div className="space-y-3 max-w-sm">
              {contacts.map((contact, i) => (
                <input
                  key={i}
                  type="text"
                  value={contact}
                  onChange={(e) => handleContactChange(i, e.target.value)}
                  placeholder={i === 0 ? "e.g. Jane Doe" : ""}
                  className={`w-full h-11 px-4 border rounded shadow-sm text-sm focus:outline-none transition-colors ${
                     contact.trim() ? 'border-primary bg-surface' : 'border-border hover:border-border bg-surface-hover'
                  }`}
                  autoFocus={i === 0}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Columns */}
        {step === 2 && (
          <div className="flex-1 animate-in slide-in-from-right-8 fade-in duration-500">
            <h1 className="text-3xl font-bold text-text-main mb-2 leading-tight pr-12">Want to add some of these columns to your contacts board?</h1>
            <p className="text-sm text-text-main mb-8">
              See your CRM info at a glance with these essential columns. You can always add or remove columns later.
            </p>
            
            <div className="flex flex-wrap gap-3 max-w-lg">
              {columnOptions.map(col => {
                const isSelected = selectedColumns.includes(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 border rounded shadow-sm text-sm font-medium transition-all",
                      isSelected 
                        ? "border-primary bg-surface ring-1 ring-primary" 
                        : "border-border hover:border-border bg-surface"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded-sm border flex items-center justify-center font-bold text-[10px]", col.color)}>
                      {col.label.charAt(0)}
                    </div>
                    <span className="text-text-main">{col.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Integrations */}
        {step === 3 && (
          <div className="flex-1 animate-in slide-in-from-right-8 fade-in duration-500">
            <h1 className="text-3xl font-bold text-text-main mb-2">Do you use any of these tools?</h1>
            <p className="text-sm text-text-main mb-8 flex items-center gap-1.5">
              <span className="bg-surface-hover px-1 py-0.5 rounded text-xs border border-border"><Info className="w-3 h-3 text-primary inline" /></span>
              These are a few of our most popular tools — you can find others in the automation center.
            </p>
            
            <div className="flex flex-wrap gap-3 max-w-lg">
              {integrationTools.map(tool => {
                const isSelected = selectedTools.includes(tool.id);
                return (
                  <button
                    key={tool.id}
                    onClick={() => toggleTool(tool.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 border rounded shadow-sm text-sm font-medium transition-all group",
                      isSelected 
                        ? "border-primary bg-surface ring-1 ring-primary" 
                        : "border-border hover:border-border bg-surface"
                    )}
                  >
                    <tool.icon className={cn("w-4 h-4", tool.color)} />
                    <span className="text-text-main">{tool.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-6 border-t border-transparent mt-auto">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-surface border border-border text-text-main rounded shadow-sm hover:bg-surface-hover transition-colors font-medium text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : <div />}

          <button
            onClick={() => {
              if (step < 3) setStep((s) => (s + 1) as Step);
              else onComplete();
            }}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-primary text-white rounded shadow-md hover:bg-primary-hover transition-colors font-medium text-sm ml-auto"
          >
            {step === 3 ? 'Finish' : 'Next'}
            {step < 3 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Right Panel - Live Preview */}
      <div className="flex-1 bg-bg p-8 lg:p-12 pl-0 flex items-center justify-center relative overflow-hidden">
        
        {/* Decorative backdrop shapes */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-surface/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-teal-400/10 blur-3xl rounded-full pointer-events-none" />

        {/* Window Chrome */}
        <div className="w-full max-w-4xl h-full max-h-[800px] bg-surface rounded-xl shadow-2xl overflow-hidden flex flex-col border border-white/40 z-10 animate-in fade-in zoom-in-95 duration-700">
          
          {/* Top Bar */}
          <div className="h-10 bg-bg border-b border-border flex items-center px-4 justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-surface-hover" />
              <div className="w-3 h-3 rounded-full bg-surface-hover" />
              <div className="w-3 h-3 rounded-full bg-surface-hover" />
            </div>
            <button className="text-text-muted hover:text-text-main"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Mock Sidebar */}
            <div className="w-12 bg-bg border-r border-border flex flex-col items-center py-4">
               <ChevronRight className="w-4 h-4 text-text-muted" />
            </div>

            {/* Mock Main Content */}
            <div className="flex-1 p-8 bg-surface overflow-hidden">
               <h2 className="text-[32px] font-bold text-text-main tracking-tight mb-8">Contacts</h2>

               {/* Active Contacts Grid Mock (Top Part) */}
               <div className="mb-10">
                 <div className="flex items-center mb-2">
                   <div className="w-24 h-1 bg-emerald-600 rounded-full" />
                 </div>
                 
                 <div className="border border-border rounded-lg overflow-hidden shadow-sm">
                   {/* Headers - Fixed Columns */}
                   <div className="grid grid-cols-12 border-b border-border bg-surface-hover">
                     <div className="col-span-4 p-3 border-r border-border text-sm font-medium text-text-main text-center flex items-center">
                       <span className="w-1.5 h-6 bg-emerald-600 absolute left-[-1px] rounded-r-sm" />
                       <span className="w-full text-center">Name</span>
                     </div>
                     <div className="col-span-3 p-3 border-r border-border text-sm font-medium text-text-main text-center">Email</div>
                     <div className="col-span-2 p-3 border-r border-border text-sm font-medium text-text-main text-center">Accounts</div>
                     <div className="col-span-2 p-3 border-r border-border text-sm font-medium text-text-main text-center">Deals</div>
                     <div className="col-span-1 border-border text-sm text-text-muted flex items-center justify-center p-3 font-medium">+</div>
                   </div>

                   {/* Rows */}
                   {contacts.slice(0, 2).map((contact, i) => (
                      <div key={i} className="grid grid-cols-12 border-b border-border">
                        <div className="col-span-4 p-3 border-r border-border text-sm font-medium text-text-main flex items-center bg-surface relative">
                           <span className="w-1.5 h-full bg-green-500/10 absolute left-[-1px]" />
                           <span className="pl-2 truncate w-full">{contact || (i === 0 ? 'Robert Thompson' : 'Steven Scott')}</span>
                        </div>
                        <div className="col-span-3 p-3 border-r border-border text-xs text-primary truncate flex items-center justify-center bg-surface">
                           {contact ? `${contact.split(' ')[0].toLowerCase()}@example.com` : (i === 0 ? 'robert@amazon.com' : 'stevent@google.com')}
                        </div>
                        <div className="col-span-2 p-3 border-r border-border text-xs flex items-center justify-center bg-surface">
                           <div className="px-2 py-0.5 bg-primary/10 text-primary rounded truncate max-w-[80%] font-medium">
                             {i === 0 ? 'Amazon' : 'Google'}
                           </div>
                        </div>
                        <div className="col-span-2 p-3 border-r border-border text-xs flex items-center justify-center gap-1 bg-surface">
                          <div className="px-2 py-0.5 bg-primary/10 text-primary rounded font-medium truncate">Deal</div>
                        </div>
                        <div className="col-span-1 p-3 border-border flex items-center justify-center bg-surface">
                          <div className="w-4 h-3 bg-surface-hover rounded-sm" />
                        </div>
                      </div>
                   ))}
                   
                   {/* Add new mock row */}
                   <div className="grid grid-cols-12 bg-surface">
                     <div className="col-span-12 p-3 text-sm text-text-muted flex items-center relative h-[45px]">
                       <span className="w-1.5 h-full bg-green-500/10 absolute left-[-1px]" />
                       <span className="pl-2">+ Add Item</span>
                     </div>
                   </div>
                 </div>
               </div>

               {/* Mock Secondary Grid (Bottom Part - Showcasing Different Columns) */}
               <div className="mb-10">
                 <div className="flex items-center mb-2">
                   <div className="w-24 h-1 bg-rose-600 rounded-full" />
                 </div>
                 <div className="border border-border rounded-lg overflow-hidden shadow-sm">
                   {/* Headers - Different Essential Columns */}
                   <div className="grid grid-cols-12 border-b border-border bg-surface-hover">
                     <div className="col-span-4 p-3 border-r border-border text-sm font-medium text-text-main text-center flex items-center">
                       <span className="w-1.5 h-6 bg-rose-600 absolute left-[-1px] rounded-r-sm" />
                       <span className="w-full text-center">Name</span>
                     </div>
                     <div className="col-span-2 p-3 border-r border-border text-sm font-medium text-text-main text-center">Phone</div>
                     <div className="col-span-2 p-3 border-r border-border text-sm font-medium text-text-main text-center">Priority</div>
                     <div className="col-span-3 p-3 border-r border-border text-sm font-medium text-text-main text-center">Title</div>
                     <div className="col-span-1 border-border text-sm text-text-muted flex items-center justify-center p-3 font-medium">+</div>
                   </div>

                   {/* Rows - Empty setup */}
                   <div className="grid grid-cols-12 border-b border-border h-[45px]">
                     <div className="col-span-4 bg-surface relative border-r border-border"><span className="w-1.5 h-full bg-red-500/10 absolute left-[-1px]" /></div>
                     <div className="col-span-2 bg-surface border-r border-border"/>
                     <div className="col-span-2 bg-surface border-r border-border"/>
                     <div className="col-span-3 bg-surface border-r border-border"/>
                     <div className="col-span-1 bg-surface"/>
                   </div>

                   <div className="grid grid-cols-12 bg-surface">
                     <div className="col-span-12 p-3 text-sm text-text-muted flex items-center relative h-[45px]">
                       <span className="w-1.5 h-full bg-red-500/10 absolute left-[-1px]" />
                       <span className="pl-2">+ Add Item</span>
                     </div>
                   </div>
                 </div>
                 
                 <div className="w-64 h-3 bg-surface-hover rounded-full mt-4 mx-auto" />
               </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
