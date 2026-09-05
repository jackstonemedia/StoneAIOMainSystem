import { useState } from 'react';
import { 
  ChevronLeft, Plus, Phone, 
  Clock, CheckCircle2, Edit2, Mail, 
  ChevronDown, Lock, Smile, FileText, Sparkles,
  RefreshCw, Send, CheckSquare, Folder, X, Calendar, Search, Tag
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ActivityTimeline from '../../components/crm/ActivityTimeline';
import ContactAppointmentsTab from '../../components/crm/ContactAppointmentsTab';
import ContactDocumentsTab from '../../components/crm/ContactDocumentsTab';
import ContactDealsTab from '../../components/crm/ContactDealsTab';
import { useToast } from '../../components/ui/Toast';
import { getTagColor } from '../../lib/tagColors';
import { apiFetch } from '../../lib/apiClient';
import { NotionEditor } from '../../components/editor/NotionEditor';
import * as Dialog from '@radix-ui/react-dialog';


export default function ContactDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('activity');
  const [commsTab, setCommsTab] = useState<'sms' | 'email' | 'internal' | 'whatsapp'>('internal');
  const [commsText, setCommsText] = useState('');
  
  const [hideEmptyFields, setHideEmptyFields] = useState(false);
  const [leftTab, setLeftTab] = useState<'contact' | 'company'>('contact');
  const [rightTab, setRightTab] = useState<'activity' | 'notes' | 'documents' | 'appointments' | 'deals' | 'money'>('documents');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#fef3c7');
  const [noteSearch, setNoteSearch] = useState('');
  const [noteSort, setNoteSort] = useState<'desc' | 'asc'>('desc');
  
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');

  const { data: workspaceTags = [] } = useQuery<string[]>({
    queryKey: ['workspace-tags'],
    queryFn: () => apiFetch('/api/crm/tags').then(r => r.ok ? r.json() : []),
  });
  
  const [showAdvancedIdentity, setShowAdvancedIdentity] = useState(false);
  const [showAdvancedMethods, setShowAdvancedMethods] = useState(false);
  const [showAdvancedCrm, setShowAdvancedCrm] = useState(false);

  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ['contacts'],
    queryFn: () => apiFetch('/api/crm/contacts').then(r => r.ok ? r.json().then(d => d.contacts || []) : [])
  });
  const contact = contacts.find((c: any) => c.id === id);

  const { data: events = [], isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: ['contact-events', id],
    queryFn: () => apiFetch(`/api/crm/contacts/${id}/events`).then(r => r.ok ? r.json() : [])
  });

  const addEvent = useMutation({
    mutationFn: async ({ type, content, metadata }: { type: string; content: string; metadata?: any }) => {
      const res = await apiFetch(`/api/crm/contacts/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type, 
          title: type === 'note' ? 'Left a Note' : 
                 type === 'internal_comment' ? 'Added Internal Comment' : 
                 type === 'email' ? `Emailed ${contact.email || 'Contact'}` :
                 type === 'sms' ? `Texted ${contact.phone || 'Contact'}` :
                 `Sent ${type.toUpperCase()}`, 
          content, 
          metadata 
        })
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-events', id] });
      setCommsText('');
      toast('success', 'Activity logged successfully');
    },
    onError: () => toast('error', 'Failed to log activity')
  });

  const handleSend = () => {
    if (!commsText.trim()) return;
    addEvent.mutate({ type: commsTab === 'internal' ? 'internal_comment' : commsTab, content: commsText });
  };

  const updateContact = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiFetch(`/api/crm/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: () => toast('error', 'Failed to update contact')
  });

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTagText.trim()) {
      const currentTags = contact.tags || [];
      if (!currentTags.includes(newTagText.trim())) {
        updateContact.mutate({ tagsJson: JSON.stringify([...currentTags, newTagText.trim()]) });
      }
      setNewTagText('');
      setIsAddingTag(false);
    } else if (e.key === 'Escape') {
      setNewTagText('');
      setIsAddingTag(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = contact.tags || [];
    updateContact.mutate({ tagsJson: JSON.stringify(currentTags.filter((t: string) => t !== tagToRemove)) });
  };

  const handleSaveContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    const patch = {
      firstName: (data.fullName as string)?.split(' ')[0] || '',
      lastName: (data.fullName as string)?.split(' ').slice(1).join(' ') || '',
      preferredName: data.preferredName,
      title: data.jobTitle,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth as string).toISOString() : null,
      email: data.email,
      phone: data.phone,
      location: data.address,
      socialProfilesJson: JSON.stringify({ website: data.website }),
      status: data.contactType,
      source: data.source,
      assignedUserId: data.contactOwner,
      businessName: data.businessName,
      leadScore: Number(data.leadScore) || 0,
    };
    
    updateContact.mutate(patch, {
      onSuccess: () => toast('success', 'Contact updated successfully')
    });
  };

  if (!contact) return (
    <div className="flex flex-col h-full w-full relative bg-bg">
      <div className="px-6 py-4 flex items-center justify-between border-b border-border bg-surface shrink-0 shadow-sm h-[65px]">
        <div className="flex items-center gap-4">
          <div className="skeleton h-4 w-12 rounded" />
          <div className="w-[1px] h-4 bg-border/80" />
          <div className="flex items-center gap-2.5">
            <div className="skeleton w-8 h-8 rounded-full" />
            <div className="space-y-1.5">
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[1,2,3,4].map(i => <div key={i} className="skeleton w-9 h-9 rounded-lg" />)}
        </div>
      </div>
      <div className="flex-1 overflow-hidden flex mx-8 mt-6 mb-6 gap-6">
        <div className="w-[340px] shrink-0 bg-surface/30 border border-border/50 rounded-[8px] p-6 space-y-6">
          {[1,2,3].map(s => (
            <div key={s} className="space-y-3">
              <div className="skeleton h-3 w-28 rounded" />
              {[1,2,3].map(f => <div key={f} className="skeleton h-8 w-full rounded" />)}
            </div>
          ))}
        </div>
        <div className="flex-1 bg-surface/30 border border-border/50 rounded-[8px] p-6 space-y-4">
          <div className="flex gap-6 border-b border-border/50 pb-4">
            {[1,2,3,4,5].map(t => <div key={t} className="skeleton h-4 w-16 rounded" />)}
          </div>
          <div className="skeleton h-32 w-full rounded-xl" />
          {[1,2,3].map(e => (
            <div key={e} className="flex gap-3 pt-2">
              <div className="skeleton w-8 h-8 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="skeleton h-3 w-48 rounded" />
                <div className="skeleton h-3 w-64 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const filteredEvents = events.filter((e: any) => {
    if (activeTab === 'notes' && e.type !== 'note') return false;
    if (e.type === 'internal_comment') return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full w-full relative bg-bg">
      {/* Fixed Action Buttons - Overlaying Global Banner */}
      <div className="fixed top-2.5 right-6 z-[60] flex items-center gap-2">
        {[
          { icon: Phone, color: 'text-black bg-white hover:opacity-90', title: 'Call Contact', action: () => { setActiveTab('activity'); setCommsTab('sms'); } },
          { icon: Mail, color: 'text-text-muted bg-surface hover:text-white hover:border-white border border-border', title: 'Send Email', action: () => { setActiveTab('activity'); setCommsTab('email'); } },
          { icon: Clock, color: 'text-text-muted bg-surface hover:text-amber-500 hover:border-amber-500 border border-border', title: 'Schedule Meeting', action: () => toast('info', 'Calendar Integration Required') },
          { icon: CheckCircle2, color: 'text-text-muted bg-surface hover:text-emerald-500 hover:border-emerald-500 border border-border', title: 'View Tasks', action: () => { setActiveTab('tasks'); } }
        ].map((btn, i) => (
          <button key={i} title={btn.title} onClick={btn.action} className={`w-9 h-9 rounded-[6px] flex items-center justify-center transition-all card-hover-lift shadow-sm backdrop-blur-md ${btn.color}`}>
            <btn.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      {/* Main Layout - Floating Frosted Glass Panel */}
      <div className="flex-1 overflow-hidden flex w-full p-6">
        <div 
          className="flex-1 flex w-full rounded-[16px] shadow-luxury ring-1 ring-white/5 backdrop-blur-xl border border-border/50 overflow-hidden"
          style={{ background: 'var(--glass-bg)' }}
        >
        
        {/* Column 1: Contact Form */}
        <div className="w-[340px] flex flex-col shrink-0 bg-transparent border-r border-border overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          <div className="flex items-center justify-between p-4 border-b border-border gap-2 shrink-0">
            <Link to="/crm/contacts" className="flex items-center text-[12px] font-semibold text-text-muted hover:text-white transition-colors">
              <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Back
            </Link>
            
            <div className="flex items-center gap-2.5 text-right">
              <div className="w-8 h-8 rounded-full bg-white text-zinc-950 font-bold flex items-center justify-center text-[12px] shadow-sm shrink-0 border border-white/20">
                {(contact.name || '').charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col items-start text-left">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-[13px] font-bold text-text-main tracking-tight leading-tight">{contact.name}</h1>
                  {((contact as any).totalEmailsReceived || 0) > 0 && (
                    <span
                      className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20"
                      title={`Contacted ${(contact as any).totalEmailsReceived} time${(contact as any).totalEmailsReceived !== 1 ? 's' : ''}`}
                    >
                      {(contact as any).totalEmailsReceived}x Emailed
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-text-muted">{contact.jobTitle ? `${contact.jobTitle} at ` : ''}{contact.businessName || 'No Company'}</span>
              </div>
            </div>
          </div>
          
          <div className="p-4 flex items-center gap-2 border-b border-border/50 cursor-pointer hover:bg-surface-hover/30 transition-colors" onClick={() => setHideEmptyFields(!hideEmptyFields)}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${hideEmptyFields ? 'bg-white border-white' : 'bg-transparent border-border'}`}>
              {hideEmptyFields && <CheckSquare className="w-3.5 h-3.5 text-black" />}
            </div>
            <span className="text-[12px] font-medium text-text-main">Hide empty fields</span>
          </div>

          <form onSubmit={handleSaveContact} className="flex-1 flex flex-col p-5 pb-20 space-y-6">
            
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-white mb-2">
                <span className="text-[14px] font-bold">Contact Details</span>
              </div>
              
              {[
                { label: 'First Name', name: 'firstName', value: contact.name ? contact.name.split(' ')[0] : '' },
                { label: 'Last Name', name: 'lastName', value: contact.name ? contact.name.split(' ').slice(1).join(' ') : '' },
                { label: 'Email', name: 'email', value: contact.email },
                { label: 'Phone', name: 'phone', value: contact.phone },
                { label: 'Date Of Birth', name: 'dateOfBirth', value: contact.dateOfBirth ? new Date(contact.dateOfBirth).toISOString().split('T')[0] : '' },
                { label: 'Contact Source', name: 'source', value: contact.source || '' },
                { label: 'Contact Type', name: 'contactType', value: contact.status || '' }
              ].filter(f => !hideEmptyFields || f.value).map((field, i) => (
                <div key={`contact-${i}`} className="flex flex-col relative group">
                  <label className="text-[12px] font-semibold text-text-muted mb-1.5">{field.label}</label>
                  <div className="relative flex items-center">
                    <input type={field.name === 'dateOfBirth' ? 'date' : 'text'} name={field.name} defaultValue={field.value} placeholder={field.label} className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-text-main py-2 px-3 focus:outline-none focus:border-white transition-all placeholder:text-text-muted/40" />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4 pt-5 border-t border-border/50 mt-6">
              <div className="flex items-center gap-2 text-white mb-2">
                <span className="text-[14px] font-bold">Advanced Details</span>
              </div>

              {[
                { label: 'Business Name', name: 'businessName', value: contact.businessName || '' },
                { label: 'Website', name: 'website', value: contact.socialProfilesJson ? (JSON.parse(contact.socialProfilesJson).website || '') : '' },
                { label: 'Location', name: 'address', value: contact.location || '' },
                { label: 'Job Title', name: 'jobTitle', value: contact.jobTitle || '' },
              ].filter(f => !hideEmptyFields || f.value).map((field, i) => (
                <div key={`advanced-${i}`} className="flex flex-col relative group">
                  <label className="text-[12px] font-semibold text-text-muted mb-1.5">{field.label}</label>
                  <div className="relative flex items-center">
                    <input type={field.name === 'dateOfBirth' ? 'date' : 'text'} name={field.name} defaultValue={field.value} placeholder={field.label} className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-text-main py-2 px-3 focus:outline-none focus:border-white transition-all placeholder:text-text-muted/40" />
                  </div>
                </div>
              ))}
            </div>

            {/* Tags & Labels Customization */}
            <div className="space-y-3 pt-5 border-t border-border/50 mt-6">
              <div className="flex items-center justify-between text-white">
                <span className="text-[13px] font-bold flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-violet-400" /> Tags &amp; Labels
                </span>
                {!isAddingTag && (
                  <button
                    type="button"
                    onClick={() => setIsAddingTag(true)}
                    className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1 bg-violet-950/40 px-2 py-0.5 rounded border border-violet-800/40 transition-all"
                  >
                    <Plus className="w-3 h-3" /> Add Tag
                  </button>
                )}
              </div>

              {/* Active Tags */}
              <div className="flex flex-wrap gap-1.5 min-h-[30px] items-center">
                {(contact.tags || []).length === 0 && !isAddingTag && (
                  <span className="text-[12px] text-text-muted/60 italic">No tags assigned</span>
                )}

                {(contact.tags || []).map((t: string) => (
                  <span key={t} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-violet-950/60 text-violet-200 border border-violet-700/50 px-2.5 py-0.5 rounded-full shadow-sm">
                    {t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-red-400 transition-colors ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add Tag Input & Selector */}
              {isAddingTag && (
                <div className="space-y-2 pt-1">
                  <div className="relative flex items-center gap-2">
                    <input
                      type="text"
                      value={newTagText}
                      onChange={e => setNewTagText(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder="Type tag &amp; press Enter..."
                      autoFocus
                      className="flex-1 bg-surface border border-violet-500 rounded-[6px] text-[12px] font-medium text-text-main py-1.5 px-3 focus:outline-none placeholder:text-text-muted/40"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newTagText.trim()) {
                          const currentTags = contact.tags || [];
                          if (!currentTags.includes(newTagText.trim())) {
                            updateContact.mutate({ tagsJson: JSON.stringify([...currentTags, newTagText.trim()]) });
                          }
                          setNewTagText('');
                        }
                        setIsAddingTag(false);
                      }}
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded text-[11px] font-semibold transition-all"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setNewTagText(''); setIsAddingTag(false); }}
                      className="p-1 text-text-muted hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Preset Quick Tags */}
                  {workspaceTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      <span className="text-[10px] text-text-muted/70 w-full mb-0.5">Existing tags:</span>
                      {workspaceTags
                        .filter((t: string) => !(contact.tags || []).includes(t))
                        .slice(0, 10)
                        .map((t: string) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              const currentTags = contact.tags || [];
                              updateContact.mutate({ tagsJson: JSON.stringify([...currentTags, t]) });
                              setIsAddingTag(false);
                            }}
                            className="text-[11px] bg-surface-hover hover:bg-violet-900/40 text-text-muted hover:text-violet-300 px-2 py-0.5 rounded border border-border transition-all"
                          >
                            + {t}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DND / Compliance Flags */}
            <div className="space-y-3 pt-5 border-t border-border/50 mt-6">
              <div className="flex items-center gap-2 text-white mb-2">
                <Lock className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[13px] font-bold">Do Not Disturb</span>
              </div>

              {[
                {
                  key: 'smsOptOut',
                  label: 'SMS Opted Out',
                  description: 'Will not receive SMS messages (TCPA)',
                  value: !!(contact as any).smsOptOut,
                },
                {
                  key: 'emailUnsubscribed',
                  label: 'Email Unsubscribed',
                  description: 'Will not receive emails (CAN-SPAM)',
                  value: !!(contact as any).emailUnsubscribed,
                },
              ].map(flag => (
                <div key={flag.key} className="flex items-center justify-between gap-2">
                  <div>
                    <p className={`text-[12px] font-semibold ${flag.value ? 'text-red-400' : 'text-text-muted'}`}>{flag.label}</p>
                    <p className="text-[10px] text-text-muted/70">{flag.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateContact.mutate({ [flag.key]: !flag.value })}
                    className={`relative w-10 h-5 rounded-full transition-all shrink-0 ${flag.value ? 'bg-red-500' : 'bg-border'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${flag.value ? 'left-5' : 'left-0.5'}`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </form>
        </div>


        {/* Column 2: Messaging / Center Area */}
        <div className="flex-1 flex flex-col bg-[#1B1D22] border-r border-border relative min-w-[400px]">
          
          {/* Empty Space / Conversation Canvas */}
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-6">
             {activeTab === 'deals' && id ? <ContactDealsTab contactId={id} /> : (
               <div className="flex flex-col gap-4">
                 {events.filter((e: any) => ['email', 'sms', 'internal_comment'].includes(e.type)).slice().reverse().map((msg: any) => {
                   const isOutbound = true;
                   return (
                     <div key={msg.id} className={`flex flex-col max-w-[85%] mb-2 ${isOutbound ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                       <div className={`flex items-center gap-2 mb-1.5 ${isOutbound ? 'flex-row-reverse' : ''}`}>
                         <span className={`text-[12px] font-bold ${msg.type === 'internal_comment' ? 'text-sky-400' : 'text-text-main'}`}>{msg.title}</span>
                         <span className="text-[11px] text-text-muted/60">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                       </div>
                       {msg.type === 'internal_comment' ? (
                         <div className="text-[13px] text-sky-400">
                           <div className={`prose prose-sm [&_*]:!text-sky-400 ${isOutbound ? 'text-right' : 'text-left'}`} dangerouslySetInnerHTML={{ __html: msg.content }} />
                         </div>
                       ) : (
                         <div className={`p-4 rounded-[8px] bg-surface/40 border border-border/40 text-[13px] text-text-main shadow-sm ${isOutbound ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                           <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: msg.content }} />
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
             )}
          </div>

          {/* Composer Anchored at Bottom */}
          <div className="border-t border-border bg-transparent flex flex-col shrink-0">
            <div className="flex items-center border-b border-border px-5 pt-3 gap-6">
              {[
                { id: 'sms', label: 'SMS' },
                { id: 'email', label: 'Email' },
                { id: 'internal', label: 'Internal Comment' }
              ].map(t => (
                <button 
                  key={t.id}
                  onClick={() => setCommsTab(t.id as any)}
                  className={`flex items-center gap-1.5 pb-3 text-[13px] font-bold transition-colors border-b-[2px] -mb-[1px] ${commsTab === t.id ? 'text-white border-primary' : 'text-text-muted hover:text-text-main border-transparent'}`}
                >
                  {t.label}
                </button>
              ))}
              <div className="flex-1 flex justify-end pb-3 items-center gap-3">
                 {commsTab === 'sms' && (
                   <span className="text-[12px] text-text-muted font-medium mr-1">Segs: {Math.max(1, Math.ceil(commsText.replace(/<[^>]*>?/gm, '').length / 160))}</span>
                 )}
                 <button onClick={() => setCommsText('')} className="px-4 py-1.5 border-none rounded-[6px] text-[12px] font-bold text-white transition-opacity bg-primary hover:bg-primary-hover shadow-sm">
                   Clear
                 </button>
                 <button 
                   onClick={handleSend}
                   disabled={addEvent.isPending || !commsText.trim()}
                   className="px-4 py-1.5 rounded-[6px] text-[12px] font-bold text-white transition-opacity bg-primary hover:bg-primary-hover disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                 >
                   {addEvent.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Send'}
                   <ChevronDown className="w-3.5 h-3.5 ml-0.5 border-l border-white/20 pl-1" />
                 </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-transparent flex flex-col gap-3">
              {commsTab === 'email' && (
                <div className="flex items-center gap-3 border-b border-border/50 pb-2">
                  <span className="text-[13px] text-text-muted font-bold shrink-0">Subject:</span>
                  <input type="text" placeholder="Enter subject line" className="flex-1 bg-transparent border-none text-[13px] font-medium text-text-main focus:outline-none placeholder:text-text-muted/50" />
                </div>
              )}
              <div className="w-full">
                <NotionEditor 
                  content={commsText}
                  onChange={(html) => setCommsText(html)}
                  minHeight="min-h-[100px]"
                  placeholder={commsTab === 'internal' ? "Start typing to log a note..." : commsTab === 'email' ? "Start typing an email..." : "Type a message..."}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Area: Panel + Navigation Bar */}
        <div className="flex h-full shrink-0 border-l border-border bg-surface">
          {/* Collapsible Panel Content */}
          {isRightPanelOpen && (
            <div className="w-[360px] flex flex-col shrink-0 bg-transparent overflow-hidden border-r border-border/50">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-surface shrink-0">
                <span className="text-[14px] font-bold text-text-main capitalize">
                  {rightTab === 'notes' && isCreatingNote ? 'Add note' : rightTab}
                </span>
                <div className="flex items-center gap-3">
                  {(!isCreatingNote || rightTab !== 'notes') && rightTab !== 'activity' && (
                    <button 
                      onClick={() => {
                        if (rightTab === 'notes') setIsCreatingNote(true);
                        // Handled within their respective components for others
                      }}
                      className="flex items-center gap-1 text-[12px] font-semibold text-text-muted hover:text-text-main transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  )}
                  <button onClick={() => setIsRightPanelOpen(false)} className="text-text-muted hover:text-text-main transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-transparent">
                <div className="p-6 flex flex-col h-full">
                  {rightTab === 'activity' && (
                  <>
                    {eventsLoading ? (
                      <div className="space-y-4">
                        {[1,2,3].map(i => (
                          <div key={i} className="flex gap-3">
                            <div className="skeleton w-8 h-8 rounded-full shrink-0" />
                            <div className="space-y-2 flex-1 pt-1">
                              <div className="skeleton h-3 rounded" style={{ width: `${40 + i * 15}%` }} />
                              <div className="skeleton h-3 w-3/4 rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : filteredEvents.length === 0 ? (
                      <div className="text-center py-12 mt-8">
                        <div className="w-48 h-32 mx-auto mb-6 relative">
                           <div className="absolute inset-0 bg-[url('https://cdn-icons-png.flaticon.com/512/7486/7486747.png')] bg-contain bg-center bg-no-repeat opacity-40 invert dark:invert-0 filter drop-shadow-md"></div>
                        </div>
                        <h4 className="text-[16px] font-bold text-text-main mb-2">No activities yet!</h4>
                        <p className="text-[13px] text-text-muted max-w-[280px] mx-auto leading-relaxed">
                          Page visits, form submissions, appointments, calls, and more will appear here. Engage now to start tracking!
                        </p>
                      </div>
                    ) : (
                      <ActivityTimeline 
                        activities={filteredEvents.map((e: any) => ({
                          id: e.id,
                          type: e.type,
                          title: e.title,
                          description: e.content,
                          timestamp: e.createdAt,
                          relatedName: e.metadata?.type ? String(e.metadata.type).charAt(0).toUpperCase() + String(e.metadata.type).slice(1) : undefined
                        }))} 
                        compact={false}
                      />
                    )}
                  </>
                )}

                {rightTab === 'notes' && (
                  <div className="space-y-6 flex flex-col h-full pb-8">
                    {isCreatingNote ? (
                      <div className="flex flex-col h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-6">
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-semibold text-text-main">Title</label>
                          <input
                            type="text"
                            placeholder="Enter a title"
                            className="w-full bg-surface border border-border/50 rounded-[6px] px-3 py-2 text-[13px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
                          />
                          <div className="text-right text-[11px] text-text-muted">0 / 120 characters</div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[13px] font-semibold text-text-main">Description <span className="text-red-500">*</span></label>
                          <div className="border border-border/50 rounded-[8px] overflow-hidden">
                            <div className="p-0 bg-bg">
                              <NotionEditor 
                                content={newNote}
                                onChange={(html) => setNewNote(html)}
                                minHeight="min-h-[150px]"
                                placeholder="Add a note"
                              />
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-text-muted">0 / 65000 characters</div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[13px] font-semibold text-text-main">Color</label>
                          <div className="flex flex-wrap gap-2">
                            {['#fef3c7', '#dcfce7', '#dbeafe', '#f3f4f6', '#ccfbf1', '#fae8ff', '#ffedd5', '#ffe4e6', '#f3e8ff', '#cffafe'].map(c => (
                              <button 
                                key={c}
                                onClick={() => setSelectedColor(c)}
                                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${selectedColor === c ? 'border-2 border-primary text-primary' : 'border border-transparent hover:brightness-95'}`}
                                style={{ backgroundColor: c }}
                              >
                                {selectedColor === c && <CheckCircle2 className="w-4 h-4" />}
                              </button>
                            ))}
                          </div>
                        </div>



                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button 
                            onClick={() => setIsCreatingNote(false)}
                            className="px-4 py-2 border border-border rounded-[6px] text-[13px] font-semibold text-text-main hover:bg-surface-hover transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => {
                              if (!newNote.trim()) return;
                              addEvent.mutate({ type: 'note', content: newNote, metadata: { color: selectedColor } });
                              setNewNote('');
                              setIsCreatingNote(false);
                            }}
                            disabled={addEvent.isPending || !newNote.trim()}
                            className="px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Search & Filter */}
                        <div className="shrink-0 flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Search notes"
                              value={noteSearch}
                              onChange={(e) => setNoteSearch(e.target.value)}
                              className="w-full bg-surface border border-border/50 rounded-[6px] pl-9 pr-3 py-1.5 text-[13px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
                            />
                          </div>
                          <button 
                            onClick={() => setNoteSort((s: 'desc' | 'asc') => s === 'desc' ? 'asc' : 'desc')}
                            className={`w-8 h-8 flex items-center justify-center border border-border/50 rounded-[6px] transition-colors ${noteSort === 'asc' ? 'bg-primary/20 text-primary border-primary/30' : 'bg-surface text-text-muted hover:text-text-main'}`}>
                            <svg className={`w-4 h-4 transition-transform ${noteSort === 'asc' ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                          </button>
                        </div>

                        <div className="flex-1 space-y-4 pt-2">
                          {events
                            .filter((e: any) => e.type === 'note' && (e.content || '').toLowerCase().includes(noteSearch.toLowerCase()))
                            .sort((a: any, b: any) => noteSort === 'desc' 
                              ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                              : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                            .map((note: any) => (
                            <div key={note.id} className="p-4 rounded-[8px] flex flex-col gap-3 relative shadow-sm" style={{ backgroundColor: note.metadata?.color || 'rgba(40, 54, 77, 0.05)', border: note.metadata?.color ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(40, 54, 77, 0.2)' }} >
                              <div className="flex items-start justify-between">
                                <div className={`text-[14px] prose prose-p:my-0 font-medium leading-snug pr-6 ${note.metadata?.color ? 'text-black prose-p:text-black' : 'text-text-main prose-invert'}`} dangerouslySetInnerHTML={{ __html: note.content }} />
                              </div>
                              
                              <div className="flex items-center justify-between mt-1">
                                <div className={`flex items-center gap-1.5 text-[12px] font-medium ${note.metadata?.color ? 'text-black/60' : 'text-text-muted'}`}>
                                  {new Date(note.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}, {new Date(note.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <button className={`${note.metadata?.color ? 'text-black/40 hover:text-black' : 'text-text-muted hover:text-text-main'} ml-1`}>
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {events.filter((e: any) => e.type === 'note').length === 0 && (
                            <div className="text-center py-8 text-text-muted">
                              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p className="text-[13px]">No notes yet</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {rightTab === 'documents' && id && (
                  <div className="h-full">
                    <ContactDocumentsTab contactId={id} />
                  </div>
                )}

                {rightTab === 'appointments' && id && (
                  <div className="h-full">
                    <ContactAppointmentsTab contactId={id} />
                  </div>
                )}
                </div>
              </div>
            </div>
          )}

          {/* Vertical Navigation Bar */}
          <div className="w-[52px] flex flex-col items-center py-4 gap-2 bg-surface shrink-0">
            {[
              { id: 'activity', icon: Clock, label: 'Activity' },
              { id: 'notes', icon: FileText, label: 'Notes' },
              { id: 'documents', icon: Folder, label: 'Documents' },
              { id: 'appointments', icon: Calendar, label: 'Appointments' },
            ].map((tab) => (
              <button 
                key={tab.id} 
                onClick={() => {
                  setRightTab(tab.id as any);
                  setIsRightPanelOpen(true);
                }} 
                title={tab.label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${rightTab === tab.id && isRightPanelOpen ? 'bg-white/10 text-white shadow-sm border border-white/20' : 'text-text-muted hover:text-text-main hover:bg-bg border border-transparent'}`}
              >
                <tab.icon className="w-[18px] h-[18px]" strokeWidth={2} />
              </button>
            ))}
          </div>
        </div>

        </div>
      </div>
    </div>
  );
}
