import React, { useState } from 'react';
import { X, ChevronDown, Plus, User, Building, Briefcase, Mail, Phone, Tag } from 'lucide-react';
import { SlideOverPanel } from '../../../components/ui/SlideOverPanel';
import { NotionEditor } from '../../../components/editor/NotionEditor';

interface NewContactSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  newContact: any;
  setNewContact: (contact: any) => void;
  newContactTagInput: string;
  setNewContactTagInput: (val: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  error?: string | null;
}

// Mocked Users for the CRM
const mockUsers = [
  { id: '1', name: 'John Doe (You)' }
];

const defaultLifecycleStages = ['Lead', 'Opportunity', 'Sales Qualified Lead', 'Marketing Qualified Lead', 'Client'];
const defaultLeadStatuses = ['New', 'Open', 'In Progress', 'Open Deal', 'Unqualified', 'Attempted to Contact', 'Connected'];
const defaultTags = ['VIP', 'Prospect', 'Hot Lead', 'Follow-up'];

// Render a standard form row with an icon
const FormRow = ({ label, icon: Icon, required, children }: any) => (
  <div className="space-y-1.5">
    <label className="text-[12px] font-semibold text-text-main flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-text-muted" />
      {label}
      {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

export function NewContactSlideOver({
  isOpen,
  onClose,
  newContact,
  setNewContact,
  newContactTagInput,
  setNewContactTagInput,
  onSubmit,
  isPending,
  error
}: NewContactSlideOverProps) {
  const [lifecycleStages, setLifecycleStages] = useState(defaultLifecycleStages);
  const [newLifecycleStage, setNewLifecycleStage] = useState('');
  const [showNewStageInput, setShowNewStageInput] = useState(false);

  // Phone Popover State
  const [showPhonePopover, setShowPhonePopover] = useState(false);
  const [tempPhoneCountry, setTempPhoneCountry] = useState('us');
  const [tempPhoneNumber, setTempPhoneNumber] = useState('+1 ');
  const [tempPhoneExt, setTempPhoneExt] = useState('');

  return (
    <SlideOverPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Add Contact"
      width="w-[500px]"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-[6px] text-[13px] font-semibold text-text-main border-0 hover:bg-surface-hover transition-colors ">
            Cancel
          </button>
          <button 
            disabled={isPending}
            onClick={onSubmit}
            className="px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 "
          >
            {isPending ? 'Saving...' : 'Save Contact'}
          </button>
        </>
      }
    >
      <div className="space-y-6 pb-8 relative">
        {error && <p className="text-red-500 text-[13px] font-medium bg-red-500/10 p-3 rounded-[6px] border border-red-500/20">{error}</p>}

        {/* --- Primary Identity (Always active) --- */}
        <div className="space-y-4">
          <FormRow label="Email Address" icon={Mail} required>
            <input 
              type="email" 
              value={newContact.email || ''} 
              onChange={e => setNewContact({...newContact, email: e.target.value})} 
              className="w-full px-3 py-2 bg-surface-hover border-0 rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all " 
              placeholder="jane@example.com" 
            />
          </FormRow>

          <FormRow label="First Name" icon={User} required>
            <input 
              type="text" 
              value={newContact.firstName || ''} 
              onChange={e => setNewContact({...newContact, firstName: e.target.value})} 
              className="w-full px-3 py-2 bg-surface-hover border-0 rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all " 
              placeholder="Jane" 
            />
          </FormRow>

          <FormRow label="Last Name" icon={User}>
            <input 
              type="text" 
              value={newContact.lastName || ''} 
              onChange={e => setNewContact({...newContact, lastName: e.target.value})} 
              className="w-full px-3 py-2 bg-surface-hover border-0 rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all " 
              placeholder="Doe" 
            />
          </FormRow>
        </div>

        <div className="space-y-6">
            
            <div className="h-px bg-border" />

            {/* --- Business Context --- */}
            <div className="space-y-4">
              <h3 className="text-[14px] font-bold text-text-main">Business Context</h3>

              <FormRow label="Company Name" icon={Building}>
                <input 
                  type="text" 
                  value={newContact.businessName || ''} 
                  onChange={e => setNewContact({...newContact, businessName: e.target.value})} 
                  className="w-full px-3 py-2 bg-surface-hover border-0 rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all " 
                  placeholder="Acme Corp" 
                />
              </FormRow>

              <FormRow label="Job Title" icon={Briefcase}>
                <input 
                  type="text" 
                  value={newContact.title || ''} 
                  onChange={e => setNewContact({...newContact, title: e.target.value})} 
                  className="w-full px-3 py-2 bg-surface-hover border-0 rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all " 
                  placeholder="Marketing Director" 
                />
              </FormRow>
              
              <FormRow label="Phone number" icon={Phone}>
                <div className="relative">
                  <input 
                    type="text" 
                    value={newContact.phone || ''} 
                    onChange={e => setNewContact({...newContact, phone: e.target.value})} 
                    onClick={() => {
                      if (!showPhonePopover) {
                        setTempPhoneNumber(newContact.phone || '+1 ');
                        setTempPhoneExt('');
                        setShowPhonePopover(true);
                      }
                    }}
                    className="w-full px-3 py-2 bg-surface-hover border-0 rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all " 
                    placeholder="" 
                  />

                  {/* Phone Edit Popover */}
                  {showPhonePopover && (
                    <>
                      {/* Invisible backdrop to close on click outside */}
                      <div className="fixed inset-0 z-40" onClick={() => setShowPhonePopover(false)} />
                      
                      <div className="absolute left-0 bottom-[calc(100%+12px)] w-[400px] bg-bg shadow-[0_8px_30px_rgb(0,0,0,0.4)] rounded-[10px] z-50 animate-in fade-in zoom-in-95 duration-100">
                        {/* Triangle Pointer */}
                        <div className="absolute -bottom-[6px] left-[40px] w-3 h-3 bg-bg transform rotate-45"></div>
                        
                        <div className="p-4 relative z-10 bg-bg rounded-[8px]">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[14px] font-bold text-text-main">Edit phone number</h4>
                            <button onClick={() => setShowPhonePopover(false)} className="text-text-muted hover:text-text-main transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex bg-surface rounded-[6px] overflow-hidden mb-1.5 focus-within:ring-2 focus-within:ring-primary/30 transition-all ">
                            <div className="relative flex items-center px-3 bg-surface-hover cursor-pointer hover:bg-surface-hover/80 transition-colors shrink-0">
                              <select 
                                className="absolute inset-0 opacity-0 cursor-pointer w-full border-0 ring-0 shadow-none"
                                value={tempPhoneCountry.toUpperCase()}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTempPhoneCountry(val.toLowerCase());
                                  const codeMap: Record<string, string> = { US: '+1', UK: '+44', CA: '+1', AU: '+61', DE: '+49', FR: '+33', IN: '+91' };
                                  const prefix = codeMap[val] || '+1';
                                  // replace existing prefix
                                  let newNum = tempPhoneNumber.replace(/^\+\d+\s*/, '');
                                  setTempPhoneNumber(`${prefix} ${newNum}`);
                                }}
                              >
                                <option value="US" className="text-black bg-white dark:text-white dark:bg-gray-800">US (+1)</option>
                                <option value="UK" className="text-black bg-white dark:text-white dark:bg-gray-800">UK (+44)</option>
                                <option value="CA" className="text-black bg-white dark:text-white dark:bg-gray-800">CA (+1)</option>
                                <option value="AU" className="text-black bg-white dark:text-white dark:bg-gray-800">AU (+61)</option>
                                <option value="DE" className="text-black bg-white dark:text-white dark:bg-gray-800">DE (+49)</option>
                                <option value="FR" className="text-black bg-white dark:text-white dark:bg-gray-800">FR (+33)</option>
                                <option value="IN" className="text-black bg-white dark:text-white dark:bg-gray-800">IN (+91)</option>
                              </select>
                              <span className="text-[13px] uppercase font-bold text-text-main">{tempPhoneCountry}</span>
                              <ChevronDown className="w-3.5 h-3.5 ml-1 text-text-muted pointer-events-none" />
                            </div>
                            <input 
                              type="text" 
                              autoFocus
                              className="flex-1 min-w-0 px-3 py-2.5 text-[14px] bg-transparent border-0 ring-0 shadow-none focus:ring-0 outline-none text-text-main font-medium" 
                              value={tempPhoneNumber} 
                              onChange={(e) => setTempPhoneNumber(e.target.value)} 
                            />
                            <div className="w-[1px] bg-border/40 my-2 shrink-0"></div>
                            <input 
                              type="text" 
                              className="w-[100px] shrink-0 px-3 py-2.5 text-[14px] bg-transparent border-0 ring-0 shadow-none focus:ring-0 outline-none text-text-main placeholder:text-text-muted font-medium" 
                              placeholder="Extension" 
                              value={tempPhoneExt} 
                              onChange={(e) => setTempPhoneExt(e.target.value)} 
                            />
                          </div>
                          <p className="text-[11px] font-medium text-text-muted mb-4">Select a country code and enter a phone number.</p>

                          <button className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1 mb-5">
                            Remove number formatting <span className="w-3.5 h-3.5 rounded-full border border-primary/50 flex items-center justify-center text-[9px]">i</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button 
                              className={`px-3.5 py-1.5 rounded-[4px] text-[13px] font-semibold transition-colors ${
                                tempPhoneNumber.trim().length > 3 
                                  ? 'bg-primary/10 text-primary hover:bg-primary/20' 
                                  : 'bg-surface-hover text-text-muted cursor-not-allowed'
                              }`}
                              onClick={() => {
                                if (tempPhoneNumber.trim().length > 3) {
                                  const finalNumber = tempPhoneExt ? `${tempPhoneNumber} ext ${tempPhoneExt}` : tempPhoneNumber;
                                  setNewContact({...newContact, phone: finalNumber});
                                  setShowPhonePopover(false);
                                }
                              }}
                            >
                              Apply
                            </button>
                            <button 
                              className="px-3.5 py-1.5 bg-surface-hover border-0 text-text-main text-[13px] rounded-[4px] font-medium hover:bg-surface-hover transition-colors " 
                              onClick={() => setShowPhonePopover(false)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </FormRow>
            </div>

            <div className="h-px bg-border" />

            {/* --- CRM Details --- */}
            <div className="space-y-4">
              <h3 className="text-[14px] font-bold text-text-main">CRM Details</h3>

              <FormRow label="Contact Owner" icon={User}>
                <div className="relative ">
                  <select 
                    value={newContact.ownerId || ''} 
                    onChange={e => setNewContact({...newContact, ownerId: e.target.value})} 
                    className="w-full px-3 py-2 bg-surface-hover border-0 rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">— Unassigned —</option>
                    {mockUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </FormRow>

              <FormRow label="Lifecycle Stage" icon={User}>
                <div className="space-y-2">
                  <div className="relative ">
                    <select 
                      value={newContact.lifecycleStage || ''} 
                      onChange={e => setNewContact({...newContact, lifecycleStage: e.target.value})} 
                      className="w-full px-3 py-2 bg-surface-hover border-0 rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">— Select Stage —</option>
                      {lifecycleStages.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                  
                  {showNewStageInput ? (
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text" 
                        value={newLifecycleStage}
                        onChange={(e) => setNewLifecycleStage(e.target.value)}
                        placeholder="New stage name"
                        className="flex-1 px-3 py-1.5 bg-surface-hover border-0 rounded-[4px] text-[12px] focus:border-primary focus:outline-none "
                      />
                      <button 
                        onClick={() => {
                          if (newLifecycleStage.trim() && !lifecycleStages.includes(newLifecycleStage.trim())) {
                            setLifecycleStages([...lifecycleStages, newLifecycleStage.trim()]);
                            setNewContact({...newContact, lifecycleStage: newLifecycleStage.trim()});
                          }
                          setNewLifecycleStage('');
                          setShowNewStageInput(false);
                        }}
                        className="px-3 py-1.5 bg-primary text-white rounded-[4px] text-[12px] font-medium"
                      >
                        Add
                      </button>
                      <button onClick={() => setShowNewStageInput(false)} className="px-2 py-1.5 text-text-muted hover:text-text-main">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowNewStageInput(true)}
                      className="text-[12px] font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add custom stage
                    </button>
                  )}
                </div>
              </FormRow>

              <FormRow label="Lead Status" icon={User}>
                <div className="relative ">
                  <select 
                    value={newContact.leadStatus || ''} 
                    onChange={e => setNewContact({...newContact, leadStatus: e.target.value})} 
                    className="w-full px-3 py-2 bg-surface-hover border-0 rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">— Select Status —</option>
                    {defaultLeadStatuses.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </FormRow>
            </div>

            <div className="h-px bg-border" />

            {/* --- Tags & Extra --- */}
            <div className="space-y-4">
              <h3 className="text-[14px] font-bold text-text-main">Tags</h3>
              
              <div className="space-y-3">
                <div className="relative ">
                  <select
                    value=""
                    onChange={e => {
                      const tag = e.target.value;
                      if (tag && !newContact.tags?.includes(tag)) {
                        setNewContact({...newContact, tags: [...(newContact.tags || []), tag]});
                      }
                    }}
                    className="w-full px-3 py-2 bg-surface-hover border-0 rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">— Add a Tag —</option>
                    {defaultTags.filter(t => !(newContact.tags || []).includes(t)).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-2.5 pointer-events-none" />
                </div>

                <div className="flex flex-wrap gap-2">
                  {(newContact.tags || []).map((tag: string, i: number) => (
                    <span key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-primary/10 border border-primary/20 text-primary text-[12px] font-medium ">
                      <Tag className="w-3 h-3" />
                      {tag}
                      <button onClick={() => setNewContact({...newContact, tags: newContact.tags.filter((_: any, j: number) => j !== i)})} className="ml-0.5 text-primary/60 hover:text-primary transition-colors"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Create new tag..."
                    value={newContactTagInput}
                    onChange={e => setNewContactTagInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',') && newContactTagInput.trim()) {
                        e.preventDefault();
                        const tag = newContactTagInput.trim().replace(/,/g, '');
                        if (tag && !(newContact.tags || []).includes(tag)) setNewContact({...newContact, tags: [...(newContact.tags || []), tag]});
                        setNewContactTagInput('');
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-surface-hover border-0 rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all  placeholder:text-text-muted/60"
                  />
                  <button 
                    onClick={() => {
                      if (newContactTagInput.trim()) {
                        const tag = newContactTagInput.trim().replace(/,/g, '');
                        if (tag && !(newContact.tags || []).includes(tag)) setNewContact({...newContact, tags: [...(newContact.tags || []), tag]});
                        setNewContactTagInput('');
                      }
                    }}
                    className="px-3 py-2 bg-surface-hover border-0 text-text-main rounded-[6px] text-[13px] font-medium hover:bg-surface-hover/80 transition-colors "
                  >
                    Add Tag
                  </button>
                </div>
              </div>
            </div>

            {/* --- Notes Section --- */}
            <div className="h-px bg-border" />
            <div className="space-y-4">
              <FormRow label="Initial Notes" icon={User}>
                <NotionEditor 
                  content={newContact.notes || ''} 
                  onChange={(html) => setNewContact({...newContact, notes: html})} 
                  placeholder="Type '/' for commands..." 
                  minHeight="min-h-[120px]" 
                />
              </FormRow>
            </div>

          </div>
        </div>
    </SlideOverPanel>
  );
}

