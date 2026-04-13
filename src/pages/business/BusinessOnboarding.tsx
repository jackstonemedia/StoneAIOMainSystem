import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, X, Mail, Phone, AtSign, Building2, CircleDollarSign, AlignLeft, Tag, CalendarDays, BarChart, MessageSquare, Briefcase } from 'lucide-react';
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
  { id: 'email', label: 'Email', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  { id: 'accounts', label: 'Accounts', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' },
  { id: 'deals', label: 'Deals', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' },
  { id: 'phone', label: 'Phone', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
  { id: 'type', label: 'Type', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'priority', label: 'Priority', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'title', label: 'Title', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'dealsValue', label: 'Deals value', color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' },
  { id: 'comments', label: 'Comments', color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
];

const integrationTools = [
  { id: 'gmail', label: 'Gmail', icon: Mail, color: 'text-red-500' },
  { id: 'outlook', label: 'Outlook', icon: Mail, color: 'text-blue-500' },
  { id: 'gcal', label: 'Google Calendar', icon: CalendarDays, color: 'text-blue-400' },
  { id: 'ocal', label: 'Outlook Calendar', icon: CalendarDays, color: 'text-blue-600' },
  { id: 'fb', label: 'Facebook Ads', icon: BarChart, color: 'text-blue-600' },
  { id: 'linkedin', label: 'LinkedIn', icon: Briefcase, color: 'text-blue-700' },
  { id: 'mailchimp', label: 'Mailchimp', icon: Mail, color: 'text-yellow-500' },
  { id: 'teams', label: 'Microsoft Teams', icon: MessageSquare, color: 'text-indigo-600' },
  { id: 'hubspot', label: 'Hubspot', icon: CircleDollarSign, color: 'text-orange-500' },
  { id: 'zoom', label: 'Zoom', icon: MessageSquare, color: 'text-blue-500' },
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
    <div className="fixed inset-0 z-50 flex bg-white font-sans overflow-hidden">
      
      {/* Left Panel - Wizard */}
      <div className="w-[45%] min-w-[500px] h-full flex flex-col pt-12 pb-8 px-16 relative">
        
        {/* Logo Header */}
        <div className="flex items-center gap-2 mb-20 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="w-8 h-8 bg-gradient-to-br from-[#00d2ff] to-[#3a7bd5] rounded-full flex items-center justify-center shadow-md">
            <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
          <span className="font-bold text-xl text-slate-800 tracking-tight">Stone CRM</span>
        </div>

        {/* Step 1: Contacts */}
        {step === 1 && (
          <div className="flex-1 animate-in slide-in-from-right-8 fade-in duration-500">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Next, add a few contacts</h1>
            <p className="text-sm text-slate-600 mb-8 flex items-center gap-1.5">
              <span className="bg-amber-100 px-1 py-0.5 rounded text-xs border border-amber-200">💡</span>
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
                     contact.trim() ? 'border-[#00829B] bg-white' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
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
            <h1 className="text-3xl font-bold text-slate-900 mb-2 leading-tight pr-12">Want to add some of these columns to your contacts board?</h1>
            <p className="text-sm text-slate-600 mb-8">
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
                        ? "border-[#00829B] bg-white ring-1 ring-[#00829B]" 
                        : "border-slate-300 hover:border-slate-400 bg-white"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded-sm border flex items-center justify-center font-bold text-[10px]", col.color)}>
                      {col.label.charAt(0)}
                    </div>
                    <span className="text-slate-700">{col.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Integrations */}
        {step === 3 && (
          <div className="flex-1 animate-in slide-in-from-right-8 fade-in duration-500">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Do you use any of these tools?</h1>
            <p className="text-sm text-slate-600 mb-8 flex items-center gap-1.5">
              <span className="bg-amber-100 px-1 py-0.5 rounded text-xs border border-amber-200">💡</span>
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
                        ? "border-[#00829B] bg-white ring-1 ring-[#00829B]" 
                        : "border-slate-300 hover:border-slate-400 bg-white"
                    )}
                  >
                    <tool.icon className={cn("w-4 h-4", tool.color)} />
                    <span className="text-slate-700">{tool.label}</span>
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
              className="flex items-center gap-1.5 px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded shadow-sm hover:bg-slate-50 transition-colors font-medium text-sm"
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
            className="flex items-center gap-1.5 px-6 py-2.5 bg-[#00829B] text-white rounded shadow-md hover:bg-[#007085] transition-colors font-medium text-sm ml-auto"
          >
            {step === 3 ? 'Finish' : 'Next'}
            {step < 3 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Right Panel - Live Preview */}
      <div className="flex-1 bg-[#d8f0f0] p-8 lg:p-12 pl-0 flex items-center justify-center relative overflow-hidden">
        
        {/* Decorative backdrop shapes */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-white/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-teal-400/10 blur-3xl rounded-full pointer-events-none" />

        {/* Window Chrome */}
        <div className="w-full max-w-4xl h-full max-h-[800px] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border border-white/40 z-10 animate-in fade-in zoom-in-95 duration-700">
          
          {/* Top Bar */}
          <div className="h-10 bg-[#f0f4f8] border-b border-slate-200 flex items-center px-4 justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-300" />
              <div className="w-3 h-3 rounded-full bg-slate-300" />
              <div className="w-3 h-3 rounded-full bg-slate-300" />
            </div>
            <button className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Mock Sidebar */}
            <div className="w-12 bg-[#f8fafc] border-r border-slate-200 flex flex-col items-center py-4">
               <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>

            {/* Mock Main Content */}
            <div className="flex-1 p-8 bg-white overflow-hidden">
               <h2 className="text-[32px] font-bold text-[#404b5c] tracking-tight mb-8">Contacts</h2>

               {/* Active Contacts Grid Mock (Top Part) */}
               <div className="mb-10">
                 <div className="flex items-center mb-2">
                   <div className="w-24 h-1 bg-emerald-600 rounded-full" />
                 </div>
                 
                 <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                   {/* Headers - Fixed Columns */}
                   <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50/50">
                     <div className="col-span-4 p-3 border-r border-slate-200 text-sm font-medium text-slate-600 text-center flex items-center">
                       <span className="w-1.5 h-6 bg-emerald-600 absolute left-[-1px] rounded-r-sm" />
                       <span className="w-full text-center">Name</span>
                     </div>
                     <div className="col-span-3 p-3 border-r border-slate-200 text-sm font-medium text-slate-600 text-center">Email</div>
                     <div className="col-span-2 p-3 border-r border-slate-200 text-sm font-medium text-slate-600 text-center">Accounts</div>
                     <div className="col-span-2 p-3 border-r border-slate-200 text-sm font-medium text-slate-600 text-center">Deals</div>
                     <div className="col-span-1 border-slate-200 text-sm text-slate-400 flex items-center justify-center p-3 font-medium">+</div>
                   </div>

                   {/* Rows */}
                   {contacts.slice(0, 2).map((contact, i) => (
                      <div key={i} className="grid grid-cols-12 border-b border-slate-200">
                        <div className="col-span-4 p-3 border-r border-slate-200 text-sm font-medium text-slate-800 flex items-center bg-white relative">
                           <span className="w-1.5 h-full bg-emerald-600/10 absolute left-[-1px]" />
                           <span className="pl-2 truncate w-full">{contact || (i === 0 ? 'Robert Thompson' : 'Steven Scott')}</span>
                        </div>
                        <div className="col-span-3 p-3 border-r border-slate-200 text-xs text-[#0073ea] truncate flex items-center justify-center bg-white">
                           {contact ? `${contact.split(' ')[0].toLowerCase()}@example.com` : (i === 0 ? 'robert@amazon.com' : 'stevent@google.com')}
                        </div>
                        <div className="col-span-2 p-3 border-r border-slate-200 text-xs flex items-center justify-center bg-white">
                           <div className="px-2 py-0.5 bg-[#dbeff0] text-[#00829B] rounded truncate max-w-[80%] font-medium">
                             {i === 0 ? 'Amazon' : 'Google'}
                           </div>
                        </div>
                        <div className="col-span-2 p-3 border-r border-slate-200 text-xs flex items-center justify-center gap-1 bg-white">
                          <div className="px-2 py-0.5 bg-[#dbeff0] text-[#00829B] rounded font-medium truncate">Deal</div>
                        </div>
                        <div className="col-span-1 p-3 border-slate-200 flex items-center justify-center bg-white">
                          <div className="w-4 h-3 bg-slate-200 rounded-sm" />
                        </div>
                      </div>
                   ))}
                   
                   {/* Add new mock row */}
                   <div className="grid grid-cols-12 bg-white">
                     <div className="col-span-12 p-3 text-sm text-slate-400 flex items-center relative h-[45px]">
                       <span className="w-1.5 h-full bg-emerald-600/10 absolute left-[-1px]" />
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
                 <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                   {/* Headers - Different Essential Columns */}
                   <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50/50">
                     <div className="col-span-4 p-3 border-r border-slate-200 text-sm font-medium text-slate-600 text-center flex items-center">
                       <span className="w-1.5 h-6 bg-rose-600 absolute left-[-1px] rounded-r-sm" />
                       <span className="w-full text-center">Name</span>
                     </div>
                     <div className="col-span-2 p-3 border-r border-slate-200 text-sm font-medium text-slate-600 text-center">Phone</div>
                     <div className="col-span-2 p-3 border-r border-slate-200 text-sm font-medium text-slate-600 text-center">Priority</div>
                     <div className="col-span-3 p-3 border-r border-slate-200 text-sm font-medium text-slate-600 text-center">Title</div>
                     <div className="col-span-1 border-slate-200 text-sm text-slate-400 flex items-center justify-center p-3 font-medium">+</div>
                   </div>

                   {/* Rows - Empty setup */}
                   <div className="grid grid-cols-12 border-b border-slate-200 h-[45px]">
                     <div className="col-span-4 bg-white relative border-r border-slate-200"><span className="w-1.5 h-full bg-rose-600/10 absolute left-[-1px]" /></div>
                     <div className="col-span-2 bg-white border-r border-slate-200"/>
                     <div className="col-span-2 bg-white border-r border-slate-200"/>
                     <div className="col-span-3 bg-white border-r border-slate-200"/>
                     <div className="col-span-1 bg-white"/>
                   </div>

                   <div className="grid grid-cols-12 bg-white">
                     <div className="col-span-12 p-3 text-sm text-slate-400 flex items-center relative h-[45px]">
                       <span className="w-1.5 h-full bg-rose-600/10 absolute left-[-1px]" />
                       <span className="pl-2">+ Add Item</span>
                     </div>
                   </div>
                 </div>
                 
                 <div className="w-64 h-3 bg-slate-200 rounded-full mt-4 mx-auto" />
               </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
