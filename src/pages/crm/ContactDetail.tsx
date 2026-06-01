import { useState } from 'react';
import { 
  ChevronLeft, Plus, Phone, 
  Clock, CheckCircle2, Edit2, Mail, 
  ChevronDown, Lock, Smile, FileText, Sparkles,
  RefreshCw, Send
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ActivityTimeline from '../../components/crm/ActivityTimeline';
import ContactTasksTab from '../../components/crm/ContactTasksTab';
import ContactFilesTab from '../../components/crm/ContactFilesTab';
import ContactDealsTab from '../../components/crm/ContactDealsTab';
import { useToast } from '../../components/ui/Toast';

export default function ContactDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('activity');
  const [commsTab, setCommsTab] = useState<'sms' | 'email' | 'internal' | 'whatsapp'>('internal');
  const [commsText, setCommsText] = useState('');
  
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  
  const [showAdvancedIdentity, setShowAdvancedIdentity] = useState(false);
  const [showAdvancedMethods, setShowAdvancedMethods] = useState(false);
  const [showAdvancedCrm, setShowAdvancedCrm] = useState(false);

  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ['contacts'],
    queryFn: () => fetch('/api/crm/contacts').then(r => r.ok ? r.json().then(d => d.contacts || []) : [])
  });
  const contact = contacts.find((c: any) => c.id === id);

  const { data: events = [], isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: ['contact-events', id],
    queryFn: () => fetch(`/api/crm/contacts/${id}/events`).then(r => r.ok ? r.json() : [])
  });

  const addEvent = useMutation({
    mutationFn: async ({ type, content }: { type: string; content: string }) => {
      const res = await fetch(`/api/crm/contacts/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: type === 'note' ? 'Left a Note' : `Sent ${type.toUpperCase()}`, content })
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
    addEvent.mutate({ type: commsTab === 'internal' ? 'note' : commsTab, content: commsText });
  };

  const updateContact = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/crm/contacts/${id}`, {
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

  const filteredEvents = activeTab === 'notes' ? events.filter((e: any) => e.type === 'note') : events;

  return (
    <div className="flex flex-col h-full w-full relative bg-bg">
      {/* Universal Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border bg-surface shrink-0 shadow-sm relative z-10">
        <div className="flex items-center gap-4">
          <Link to="/crm/contacts" className="flex items-center text-[13px] font-semibold text-text-muted hover:text-text-main transition-colors">
            <ChevronLeft className="w-4 h-4 mr-0.5" /> Back
          </Link>
          <div className="w-[1px] h-4 bg-border/80"></div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 border border-primary/20 shadow-sm">
              <span className="text-[14px] font-bold text-primary">{contact.name.substring(0, 1)}</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-[16px] font-bold text-text-main tracking-tight leading-tight">{contact.name}</h1>
              <span className="text-[12px] font-medium text-text-muted">{contact.jobTitle ? `${contact.jobTitle} at ` : ''}{contact.businessName || 'No Company'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 border-r border-border pr-6">
            <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-[6px] hover:bg-surface-hover transition-colors card-hover-lift bg-surface">
              <div className="w-5 h-5 rounded-lg bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">JS</div>
              <span className="text-[13px] font-semibold text-text-main">Jack Stone</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {[
              { icon: Phone, color: 'text-white bg-primary hover:opacity-90', title: 'Call Contact', action: () => { setActiveTab('calls'); setCommsTab('sms'); } },
              { icon: Mail, color: 'text-text-muted bg-surface hover:text-primary hover:border-primary border border-border', title: 'Send Email', action: () => { setActiveTab('emails'); setCommsTab('email'); } },
              { icon: Clock, color: 'text-text-muted bg-surface hover:text-amber-500 hover:border-amber-500 border border-border', title: 'Schedule Meeting', action: () => toast('info', 'Opening calendar scheduler...') },
              { icon: CheckCircle2, color: 'text-text-muted bg-surface hover:text-emerald-500 hover:border-emerald-500 border border-border', title: 'Create Task', action: () => { setActiveTab('tasks'); toast('info', 'Opening task creation modal...'); } }
            ].map((btn, i) => (
              <button key={i} title={btn.title} onClick={btn.action} className={`w-9 h-9 rounded-[6px] flex items-center justify-center transition-all card-hover-lift shadow-sm ${btn.color}`}>
                <btn.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2-Column Main Layout */}
      <div className="flex-1 overflow-hidden flex mx-8 mt-6 mb-6 gap-6">
        
        {/* Left Sidebar: Persistent Overview Profile */}
        <div className="w-[340px] flex flex-col shrink-0 bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 rounded-[8px] overflow-y-auto styled-scrollbar relative">
          <form onSubmit={handleSaveContact} className="p-6 space-y-8 relative z-10">
            
            {/* Core Identity */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5 cursor-pointer group" onClick={() => setShowAdvancedIdentity(!showAdvancedIdentity)}>
                <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider group-hover:text-text-main transition-colors">Core Identity</h4>
                <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${showAdvancedIdentity ? 'rotate-180' : ''}`} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { label: 'Full Name', name: 'fullName', value: contact.name },
                  { label: 'Job Title', name: 'jobTitle', value: contact.title || '' },
                  { label: 'Company Name', name: 'businessName', value: contact.businessName || '' },
                ].map((field, i) => (
                  <div key={i} className="flex flex-col relative group">
                    <label className="text-[11px] font-bold text-text-muted mb-1">{field.label}</label>
                    <input type="text" name={field.name} defaultValue={field.value} placeholder="—" className="w-full bg-transparent border-b border-border/50 text-[13px] font-medium text-text-main pb-1.5 focus:outline-none focus:border-primary focus:bg-primary/5 focus:px-2 rounded-t-lg transition-all placeholder:text-text-muted/40" />
                  </div>
                ))}
                
                {showAdvancedIdentity && [
                  { label: 'Preferred Name', name: 'preferredName', value: contact.preferredName || '' },
                  { label: 'Date of Birth', name: 'dateOfBirth', value: contact.dateOfBirth ? new Date(contact.dateOfBirth).toISOString().split('T')[0] : '' }
                ].map((field, i) => (
                  <div key={'adv_'+i} className="flex flex-col relative group animate-in fade-in slide-in-from-top-2">
                    <label className="text-[11px] font-bold text-text-muted mb-1">{field.label}</label>
                    <input type={field.name === 'dateOfBirth' ? 'date' : 'text'} name={field.name} defaultValue={field.value} placeholder="—" className="w-full bg-transparent border-b border-border/50 text-[13px] font-medium text-text-main pb-1.5 focus:outline-none focus:border-primary focus:bg-primary/5 focus:px-2 rounded-t-lg transition-all placeholder:text-text-muted/40" />
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Methods */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5 cursor-pointer group" onClick={() => setShowAdvancedMethods(!showAdvancedMethods)}>
                <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider group-hover:text-text-main transition-colors">Contact Methods</h4>
                <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${showAdvancedMethods ? 'rotate-180' : ''}`} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { label: 'Primary Email', name: 'email', value: contact.email },
                  { label: 'Mobile Phone', name: 'phone', value: contact.phone },
                ].map((field, i) => (
                  <div key={i} className="flex flex-col relative group">
                    <label className="text-[11px] font-bold text-text-muted mb-1">{field.label}</label>
                    <input type="text" name={field.name} defaultValue={field.value} placeholder="—" className="w-full bg-transparent border-b border-border/50 text-[13px] font-medium text-text-main pb-1.5 focus:outline-none focus:border-primary focus:bg-primary/5 focus:px-2 rounded-t-lg transition-all placeholder:text-text-muted/40" />
                  </div>
                ))}

                {showAdvancedMethods && [
                  { label: 'Work Email', name: 'workEmail', value: '' },
                  { label: 'Work Phone', name: 'workPhone', value: '' },
                  { label: 'Physical Address', name: 'address', value: contact.location || '' },
                  { label: 'LinkedIn Profile', name: 'website', value: (contact.socialProfilesJson ? JSON.parse(contact.socialProfilesJson).website : '') || '' }
                ].map((field, i) => (
                  <div key={'adv_'+i} className="flex flex-col relative group animate-in fade-in slide-in-from-top-2">
                    <label className="text-[11px] font-bold text-text-muted mb-1">{field.label}</label>
                    <input type="text" name={field.name} defaultValue={field.value} placeholder="—" className="w-full bg-transparent border-b border-border/50 text-[13px] font-medium text-text-main pb-1.5 focus:outline-none focus:border-primary focus:bg-primary/5 focus:px-2 rounded-t-lg transition-all placeholder:text-text-muted/40" />
                  </div>
                ))}
              </div>
            </div>

            {/* CRM Data */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5 cursor-pointer group" onClick={() => setShowAdvancedCrm(!showAdvancedCrm)}>
                <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider group-hover:text-text-main transition-colors">CRM Data</h4>
                <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${showAdvancedCrm ? 'rotate-180' : ''}`} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { label: 'Contact Type', name: 'contactType', value: contact.status || 'Lead' },
                  { label: 'Lead Score', name: 'leadScore', value: contact.leadScore || '85' },
                  { label: 'Contact Owner', name: 'contactOwner', value: contact.assignedUserId || '' },
                ].map((field, i) => (
                  <div key={i} className="flex flex-col relative group">
                    <label className="text-[11px] font-bold text-text-muted mb-1">{field.label}</label>
                    <input type="text" name={field.name} defaultValue={field.value} placeholder="—" className="w-full bg-transparent border-b border-border/50 text-[13px] font-medium text-text-main pb-1.5 focus:outline-none focus:border-primary focus:bg-primary/5 focus:px-2 rounded-t-lg transition-all placeholder:text-text-muted/40" />
                  </div>
                ))}

                {showAdvancedCrm && [
                  { label: 'Contact Source', name: 'source', value: contact.source || 'Manual Import' },
                  { label: 'Assigned Team', name: 'assignedTeam', value: '' }
                ].map((field, i) => (
                  <div key={'adv_'+i} className="flex flex-col relative group animate-in fade-in slide-in-from-top-2">
                    <label className="text-[11px] font-bold text-text-muted mb-1">{field.label}</label>
                    <input type="text" name={field.name} defaultValue={field.value} placeholder="—" className="w-full bg-transparent border-b border-border/50 text-[13px] font-medium text-text-main pb-1.5 focus:outline-none focus:border-primary focus:bg-primary/5 focus:px-2 rounded-t-lg transition-all placeholder:text-text-muted/40" />
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Tags</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {(contact.tags || []).map((tag: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-bg border border-border rounded-full text-[12px] font-medium text-text-main group cursor-pointer hover:border-red-400/50 transition-colors shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                    {tag}
                    <div onClick={() => handleRemoveTag(tag)} className="w-3.5 h-3.5 rounded-full hover:bg-red-400/20 text-text-muted hover:text-red-400 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100">
                      <span className="text-[10px] leading-none mb-0.5">&times;</span>
                    </div>
                  </div>
                ))}
                {isAddingTag ? (
                  <input
                    autoFocus
                    type="text"
                    value={newTagText}
                    onChange={e => setNewTagText(e.target.value)}
                    onKeyDown={handleAddTag}
                    onBlur={() => { setNewTagText(''); setIsAddingTag(false); }}
                    placeholder="Type tag & Enter..."
                    className="bg-bg border border-primary shadow-sm text-[12px] text-text-main px-2.5 py-1 rounded-full w-32 outline-none"
                  />
                ) : (
                  <button onClick={() => setIsAddingTag(true)} className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-hover border border-dashed border-border rounded-full text-[12px] font-semibold text-text-muted hover:text-text-main hover:border-primary/50 transition-colors">
                    <Plus className="w-3 h-3" /> Add Tag
                  </button>
                )}
              </div>
            </div>

            {/* Custom Fields */}
            <div className="space-y-4 pb-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Custom Fields</h4>
                <button type="button" className="flex items-center gap-1 px-2 py-0.5 bg-surface-hover border border-dashed border-border rounded-full text-[10px] font-semibold text-text-muted hover:text-text-main hover:border-primary/50 transition-colors">
                  <Plus className="w-2.5 h-2.5" /> Add Field
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col relative group">
                  <label className="text-[11px] font-bold text-text-muted mb-1">Industry Tier (Custom)</label>
                  <input type="text" name="customField_industryTier" defaultValue="Enterprise" placeholder="—" className="w-full bg-transparent border-b border-border/50 text-[13px] font-medium text-text-main pb-1.5 focus:outline-none focus:border-primary focus:bg-primary/5 focus:px-2 rounded-t-lg transition-all placeholder:text-text-muted/40" />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 -mx-6 -mb-6 p-6 bg-surface/90 backdrop-blur-2xl border-t border-border/50 flex justify-between items-center z-20 mt-8 shadow-[0_-8px_32px_rgba(0,0,0,0.2)]">
              <div className="flex flex-col gap-1">
                <div className="text-[10px] text-text-muted font-medium">Created: {new Date(contact.createdAt).toLocaleDateString()}</div>
                <div className="text-[10px] text-text-muted font-medium">Active: {contact.lastContactedAt ? new Date(contact.lastContactedAt).toLocaleDateString() : 'N/A'}</div>
              </div>
              <button disabled={updateContact.isPending} type="submit" className="px-5 py-2.5 bg-text-main text-bg rounded-[8px] text-[13px] font-bold hover:opacity-90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                {updateContact.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Main Content: Tabs, Composer, Feed */}
        <div className="flex-1 flex flex-col bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 rounded-[8px] relative overflow-hidden">
          
          {/* Main Content Tabs */}
          <div className="px-8 pt-4 flex items-center gap-6 border-b border-border/50 bg-transparent shrink-0 z-[4] overflow-x-auto styled-scrollbar">
            {['Activity', 'Notes', 'Emails', 'Calls', 'Tasks', 'Deals', 'Files', 'Forms', 'Automations'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase())} 
                className={`pb-3 text-[14px] font-bold border-b-[3px] transition-colors whitespace-nowrap ${activeTab === tab.toLowerCase() ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          
          <div className="flex-1 overflow-y-auto styled-scrollbar relative">
            <div className="max-w-4xl mx-auto w-full p-8 space-y-8">
              
              {/* Dynamic Action Area (Composer) for Comms-based Tabs */}
              {['activity', 'notes', 'emails', 'calls'].includes(activeTab) && (
                <div className="bg-surface border border-border shadow-sm rounded-[12px] overflow-hidden flex flex-col">
                  {/* Composer Tabs */}
                  <div className="flex items-center border-b border-border bg-surface-hover/30 px-4 pt-3 gap-6">
                    {[
                      { id: 'internal', label: 'Log Note', icon: Edit2 },
                      { id: 'email', label: 'Email', icon: Mail },
                      { id: 'sms', label: 'SMS', icon: Phone },
                      { id: 'whatsapp', label: 'WhatsApp', icon: Lock }
                    ].map(t => (
                      <button 
                        key={t.id}
                        onClick={() => setCommsTab(t.id as any)}
                        className={`flex items-center gap-1.5 pb-2.5 text-[12px] font-bold border-b-[3px] transition-colors ${commsTab === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'}`}
                      >
                        <t.icon className="w-3.5 h-3.5" />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* To/From Fields if external comms */}
                  {commsTab !== 'internal' && (
                    <div className="flex flex-col border-b border-border bg-bg">
                      <div className="flex items-center px-5 py-2.5 border-b border-border/50 text-[13px]">
                        <span className="text-text-muted w-14 font-bold text-[10px] uppercase tracking-wider">From</span>
                        <div className="flex items-center gap-2 flex-1 cursor-pointer hover:text-primary transition-colors">
                          <span className="font-semibold text-text-main">Jack Stone (+1 555-0000)</span>
                          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                        </div>
                      </div>
                      <div className="flex items-center px-5 py-2.5 text-[13px]">
                        <span className="text-text-muted w-14 font-bold text-[10px] uppercase tracking-wider">To</span>
                        <div className="flex items-center gap-2 flex-1 cursor-pointer hover:text-primary transition-colors">
                          <span className="font-semibold text-text-main">{contact.name} ({contact.email || contact.phone || 'No Info'})</span>
                          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Text Area */}
                  <textarea 
                    value={commsText}
                    onChange={(e) => setCommsText(e.target.value)}
                    className="w-full p-5 text-[14px] text-text-main placeholder:text-text-muted/40 resize-none outline-none bg-transparent min-h-[120px]"
                    placeholder={commsTab === 'internal' ? "Start typing to log a note or mention someone using @..." : `Type your ${commsTab} message...`}
                  />
                  
                  {/* Toolbar & Send */}
                  <div className="p-3 border-t border-border bg-surface-hover/30 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCommsText(p => p + '**bold** ')} className="w-8 h-8 flex items-center justify-center rounded-[6px] text-text-muted hover:bg-surface hover:text-text-main transition-colors font-bold text-[13px]" title="Bold">B</button>
                      <button onClick={() => setCommsText(p => p + '🙂 ')} className="w-8 h-8 flex items-center justify-center rounded-[6px] text-text-muted hover:bg-surface hover:text-text-main transition-colors" title="Emoji"><Smile className="w-4 h-4" /></button>
                      <button onClick={() => setCommsText(p => p + '\n- ')} className="w-8 h-8 flex items-center justify-center rounded-[6px] text-text-muted hover:bg-surface hover:text-text-main transition-colors" title="List"><FileText className="w-4 h-4" /></button>
                      <div className="w-[1px] h-4 bg-border/50 mx-1" />
                      <button onClick={() => toast('success', 'AI generation activated')} className="w-8 h-8 flex items-center justify-center rounded-[6px] text-primary hover:bg-primary/10 transition-colors" title="AI Generate"><Sparkles className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-3">
                      {commsText && (
                        <button onClick={() => setCommsText('')} className="text-[12px] font-bold text-text-muted hover:text-text-main transition-colors">Discard</button>
                      )}
                      <button 
                        onClick={handleSend}
                        disabled={addEvent.isPending || !commsText.trim()}
                        className="px-5 py-2 rounded-[6px] text-[13px] font-bold text-white transition-opacity bg-primary hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-sm">
                        {addEvent.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : (commsTab === 'internal' ? <Edit2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />)}
                        {commsTab === 'internal' ? 'Log Note' : 'Send Message'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Feed Content */}
              {['activity', 'notes'].includes(activeTab) && (
                <div className="bg-surface border border-border shadow-sm rounded-[12px] p-6">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/50">
                    <h3 className="text-[15px] font-bold text-text-main flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" /> {activeTab === 'notes' ? 'Notes History' : 'Activity Timeline'}
                    </h3>
                    <div className="flex items-center gap-1.5 bg-bg border border-border rounded-[6px] p-1 shadow-sm">
                      <button className="text-[11px] font-bold px-2 py-1 bg-surface rounded-lg text-text-main shadow-sm border border-border">All Time</button>
                      <button className="text-[11px] font-bold px-2 py-1 text-text-muted hover:text-text-main transition-colors">This Month</button>
                    </div>
                  </div>

                  {eventsLoading ? (
                    <div className="space-y-4 py-2">
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
                    <div className="text-center py-16">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bg border border-border flex items-center justify-center">
                        <Clock className="w-6 h-6 text-text-muted/50" />
                      </div>
                      <h4 className="text-[14px] font-bold text-text-main mb-1">No history found</h4>
                      <p className="text-[12px] text-text-muted max-w-[250px] mx-auto">Interactions logged via the composer above will appear here.</p>
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
                </div>
              )}

              {/* Deals Tab */}
              {activeTab === 'deals' && id && (
                <div className="bg-surface border border-border shadow-sm rounded-[12px] p-6">
                  <h3 className="text-[15px] font-bold text-text-main mb-4">Linked Deals</h3>
                  <ContactDealsTab contactId={id} />
                </div>
              )}

              {/* Tasks Tab */}
              {activeTab === 'tasks' && id && (
                <div className="bg-surface border border-border shadow-sm rounded-[12px] p-6">
                  <h3 className="text-[15px] font-bold text-text-main mb-4">Tasks</h3>
                  <ContactTasksTab contactId={id} />
                </div>
              )}

              {/* Files Tab */}
              {activeTab === 'files' && id && (
                <div className="bg-surface border border-border shadow-sm rounded-[12px] p-6">
                  <h3 className="text-[15px] font-bold text-text-main mb-4">Files & Attachments</h3>
                  <ContactFilesTab contactId={id} />
                </div>
              )}

              {/* Emails Tab */}
              {activeTab === 'emails' && (
                <div className="bg-surface border border-border shadow-sm rounded-[12px] p-6">
                  <h3 className="text-[15px] font-bold text-text-main mb-4">Email Threads</h3>
                  <div className="text-center py-12 border border-dashed border-border rounded-[10px]">
                    <Mail className="w-10 h-10 mx-auto mb-3 text-text-muted/30" />
                    <p className="text-[13px] font-semibold text-text-muted">No email threads yet</p>
                    <p className="text-[12px] text-text-muted/60 mt-1">Connect your email via Settings to sync threads automatically</p>
                  </div>
                </div>
              )}

              {/* Calls Tab */}
              {activeTab === 'calls' && (
                <div className="bg-surface border border-border shadow-sm rounded-[12px] p-6">
                  <h3 className="text-[15px] font-bold text-text-main mb-4">Call Log</h3>
                  <div className="text-center py-12 border border-dashed border-border rounded-[10px]">
                    <Phone className="w-10 h-10 mx-auto mb-3 text-text-muted/30" />
                    <p className="text-[13px] font-semibold text-text-muted">No calls logged</p>
                    <p className="text-[12px] text-text-muted/60 mt-1">Use the composer above to log a call</p>
                  </div>
                </div>
              )}

              {/* Forms & Automations — Coming Soon with proper UX */}
              {['forms', 'automations'].includes(activeTab) && (
                <div className="bg-surface border border-border shadow-sm rounded-[12px] p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-[16px] font-bold text-text-main mb-2 capitalize">{activeTab}</h3>
                  <p className="text-[13px] text-text-muted max-w-[280px] mx-auto">This module is connected to the backend. Full UI is being built as part of the implementation plan.</p>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
