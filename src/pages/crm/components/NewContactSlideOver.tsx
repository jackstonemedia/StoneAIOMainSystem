import React, { useState } from 'react';
import { X, ChevronDown, Plus, User, Building, Briefcase, Mail, Phone, Tag, Check, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

const defaultLifecycleStages = ['Lead', 'Prospect', 'Client'];
const defaultLeadStatuses = ['New', 'In Progress', 'Qualified'];
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

// ── Inside-Dropdown Custom Selector with Inline Add and Delete ──
function CustomSelectWithAdd({
  value,
  onChange,
  options,
  onOptionsChange,
  placeholder = 'Select option...',
  addPlaceholder = 'Add custom option...'
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  onOptionsChange: (opts: string[]) => void;
  placeholder?: string;
  addPlaceholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newInput, setNewInput] = useState('');

  const handleAdd = () => {
    const trimmed = newInput.trim();
    if (trimmed && !options.includes(trimmed)) {
      const updated = [...options, trimmed];
      onOptionsChange(updated);
      onChange(trimmed);
      setNewInput('');
    }
  };

  const handleDeleteOption = (e: React.MouseEvent, opt: string) => {
    e.stopPropagation();
    const updated = options.filter(o => o !== opt);
    onOptionsChange(updated);
    if (value === opt) {
      onChange(updated[0] || '');
    }
  };

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary flex items-center justify-between transition-colors text-left"
      >
        <span className={value ? 'font-semibold text-text-main' : 'text-text-muted'}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute left-0 right-0 top-[calc(100%+4px)] bg-surface border border-border shadow-2xl rounded-xl p-1.5 z-50 overflow-hidden space-y-1"
            >
              {/* Option List */}
              <div className="max-h-[160px] overflow-y-auto space-y-0.5">
                {options.map(opt => (
                  <div
                    key={opt}
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                    className={`group/opt flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] font-medium cursor-pointer transition-colors ${
                      value === opt
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-text-main hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {value === opt && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      <span className="truncate">{opt}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteOption(e, opt)}
                      className="opacity-0 group-hover/opt:opacity-100 p-1 hover:text-red-400 rounded transition-all text-text-muted"
                      title="Remove option"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {options.length === 0 && (
                  <div className="px-3 py-2 text-[12px] text-text-muted text-center">
                    No options. Add one below.
                  </div>
                )}
              </div>

              {/* Inside Dropdown Inline Add Input */}
              <div className="pt-1.5 border-t border-border flex items-center gap-1.5 px-1">
                <input
                  type="text"
                  placeholder={addPlaceholder}
                  value={newInput}
                  onChange={e => setNewInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  className="flex-1 px-2.5 py-1 bg-surface-hover border border-border rounded-md text-[12px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newInput.trim()}
                  className="px-2.5 py-1 bg-primary text-white text-[12px] font-bold rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  const [leadStatuses, setLeadStatuses] = useState(defaultLeadStatuses);
  const [customTags, setCustomTags] = useState<string[]>(defaultTags);

  // Phone Popover State
  const [showPhonePopover, setShowPhonePopover] = useState(false);
  const [tempPhoneCountry, setTempPhoneCountry] = useState('us');
  const [tempPhoneNumber, setTempPhoneNumber] = useState('+1 ');
  const [tempPhoneExt, setTempPhoneExt] = useState('');

  const handleAddTag = () => {
    const tag = newContactTagInput.trim().replace(/,/g, '');
    if (tag) {
      const currentTags = newContact.tags || [];
      if (!currentTags.includes(tag)) {
        setNewContact({ ...newContact, tags: [...currentTags, tag] });
      }
      if (!customTags.includes(tag)) {
        setCustomTags(prev => [...prev, tag]);
      }
      setNewContactTagInput('');
    }
  };

  const handleDeletePresetTag = (tagToDelete: string) => {
    setCustomTags(prev => prev.filter(t => t !== tagToDelete));
  };

  return (
    <SlideOverPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Add Contact"
      width="w-[500px]"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[6px] text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onSubmit}
            className="px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
          >
            {isPending ? 'Saving...' : 'Save Contact'}
          </button>
        </>
      }
    >
      <div className="space-y-6 pb-8 relative">
        {error && (
          <p className="text-red-500 text-[13px] font-medium bg-red-500/10 p-3 rounded-[6px] border border-red-500/20">
            {error}
          </p>
        )}

        {/* --- Primary Identity --- */}
        <div className="space-y-4">
          <FormRow label="Email Address" icon={Mail} required>
            <input
              type="email"
              value={newContact.email || ''}
              onChange={e => setNewContact({ ...newContact, email: e.target.value })}
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all"
              placeholder="jane@example.com"
            />
          </FormRow>

          <FormRow label="First Name" icon={User} required>
            <input
              type="text"
              value={newContact.firstName || ''}
              onChange={e => setNewContact({ ...newContact, firstName: e.target.value })}
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all"
              placeholder="Jane"
            />
          </FormRow>

          <FormRow label="Last Name" icon={User}>
            <input
              type="text"
              value={newContact.lastName || ''}
              onChange={e => setNewContact({ ...newContact, lastName: e.target.value })}
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all"
              placeholder="Doe"
            />
          </FormRow>
        </div>

        <div className="h-px bg-border" />

        {/* --- Business Context --- */}
        <div className="space-y-4">
          <h3 className="text-[14px] font-bold text-text-main">Business Context</h3>

          <FormRow label="Company Name" icon={Building}>
            <input
              type="text"
              value={newContact.businessName || ''}
              onChange={e => setNewContact({ ...newContact, businessName: e.target.value })}
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all"
              placeholder="Acme Corp"
            />
          </FormRow>

          <FormRow label="Job Title" icon={Briefcase}>
            <input
              type="text"
              value={newContact.title || ''}
              onChange={e => setNewContact({ ...newContact, title: e.target.value })}
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all"
              placeholder="Marketing Director"
            />
          </FormRow>

          <FormRow label="Phone number" icon={Phone}>
            <div className="relative">
              <input
                type="text"
                value={newContact.phone || ''}
                onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                onClick={() => {
                  if (!showPhonePopover) {
                    setTempPhoneNumber(newContact.phone || '+1 ');
                    setTempPhoneExt('');
                    setShowPhonePopover(true);
                  }
                }}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all"
                placeholder="+1 (555) 000-0000"
              />

              {showPhonePopover && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPhonePopover(false)} />
                  <div className="absolute left-0 bottom-[calc(100%+12px)] w-[360px] bg-surface border border-border shadow-2xl rounded-xl z-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-bold text-text-main">Phone Details</h4>
                      <button onClick={() => setShowPhonePopover(false)} className="text-text-muted hover:text-text-main">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        value={tempPhoneNumber}
                        onChange={e => setTempPhoneNumber(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full px-3 py-1.5 bg-surface-hover border border-border rounded-md text-[13px] text-text-main focus:outline-none focus:border-primary"
                      />
                      <input
                        type="text"
                        value={tempPhoneExt}
                        onChange={e => setTempPhoneExt(e.target.value)}
                        placeholder="Extension (optional)"
                        className="w-full px-3 py-1.5 bg-surface-hover border border-border rounded-md text-[13px] text-text-main focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowPhonePopover(false)}
                        className="px-3 py-1 text-[12px] font-semibold text-text-muted hover:text-text-main"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const finalPhone = tempPhoneExt ? `${tempPhoneNumber} ext ${tempPhoneExt}` : tempPhoneNumber;
                          setNewContact({ ...newContact, phone: finalPhone });
                          setShowPhonePopover(false);
                        }}
                        className="px-3.5 py-1 bg-primary text-white text-[12px] font-bold rounded-md shadow-sm"
                      >
                        Apply
                      </button>
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
            <div className="relative">
              <select
                value={newContact.ownerId || ''}
                onChange={e => setNewContact({ ...newContact, ownerId: e.target.value })}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all appearance-none cursor-pointer"
              >
                <option value="">— Unassigned —</option>
                {mockUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </FormRow>

          {/* ── Lifecycle Stage: Inside-Dropdown Selector with Add/Remove ── */}
          <FormRow label="Lifecycle Stage" icon={User}>
            <CustomSelectWithAdd
              value={newContact.lifecycleStage || ''}
              onChange={val => setNewContact({ ...newContact, lifecycleStage: val, status: val })}
              options={lifecycleStages}
              onOptionsChange={setLifecycleStages}
              placeholder="— Select Stage —"
              addPlaceholder="+ Add new stage..."
            />
          </FormRow>

          {/* ── Lead Status: Inside-Dropdown Selector with Add/Remove ── */}
          <FormRow label="Lead Status" icon={User}>
            <CustomSelectWithAdd
              value={newContact.leadStatus || ''}
              onChange={val => setNewContact({ ...newContact, leadStatus: val })}
              options={leadStatuses}
              onOptionsChange={setLeadStatuses}
              placeholder="— Select Status —"
              addPlaceholder="+ Add new status..."
            />
          </FormRow>
        </div>

        <div className="h-px bg-border" />

        {/* --- Tags & Extra --- */}
        <div className="space-y-4">
          <h3 className="text-[14px] font-bold text-text-main">Tags</h3>

          <div className="space-y-3">
            {/* Available Preset Tag Pills with Remove Button on Hover */}
            <div>
              <label className="text-[11px] font-semibold text-text-muted mb-1.5 block">
                Available Tags (Click to select, hover to remove)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {customTags.map(t => {
                  const isSelected = (newContact.tags || []).includes(t);
                  return (
                    <div
                      key={t}
                      className={`group/tag flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'border-border text-text-muted hover:text-primary hover:border-primary/40 hover:bg-primary/5 bg-surface'
                      }`}
                      onClick={() => {
                        const current = newContact.tags || [];
                        if (isSelected) {
                          setNewContact({ ...newContact, tags: current.filter((x: string) => x !== t) });
                        } else {
                          setNewContact({ ...newContact, tags: [...current, t] });
                        }
                      }}
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePresetTag(t);
                          if (isSelected) {
                            setNewContact({
                              ...newContact,
                              tags: (newContact.tags || []).filter((x: string) => x !== t)
                            });
                          }
                        }}
                        className={`p-0.5 rounded-full transition-opacity opacity-0 group-hover/tag:opacity-100 ${
                          isSelected ? 'hover:text-red-200 text-white/80' : 'hover:text-red-400 text-text-muted'
                        }`}
                        title="Delete from available tags"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Tag Creator Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type custom tag..."
                value={newContactTagInput}
                onChange={e => setNewContactTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!newContactTagInput.trim()}
                className="px-3.5 py-2 bg-primary text-white rounded-[6px] text-[12px] font-bold hover:opacity-90 disabled:opacity-40 transition-opacity shadow-sm"
              >
                Add Tag
              </button>
            </div>
          </div>
        </div>
      </div>
    </SlideOverPanel>
  );
}
