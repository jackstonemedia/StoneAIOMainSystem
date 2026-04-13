import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, CalendarDays, Activity,
  CircleDollarSign, Edit2, MoreHorizontal, Save, X, Linkedin, Twitter,
  Github, Tag, Plus, ExternalLink
} from 'lucide-react';
import { useState, useEffect } from 'react';
import QuickActionsBar from '../../components/crm/QuickActionsBar';
import ContactHealthScore from '../../components/crm/ContactHealthScore';
import CustomFieldsPanel from '../../components/crm/CustomFieldsPanel';
import FileAttachments from '../../components/crm/FileAttachments';
import { motion, AnimatePresence } from 'motion/react';

interface Contact {
  id: string; name: string; title: string; company: string;
  email: string; phone: string; location: string; leadScore: number;
  status: string; about: string; linkedin?: string; twitter?: string; github?: string;
  tags?: string[];
}

interface Deal { id: string; title: string; amount: string; stage: string; closeDate: string; contactId: string; }
interface ActivityItem { id: string; type: string; title: string; date: string; target: string; note?: string; }

const MOCK_CONTACTS: Record<string, Contact> = {
  '1': { id: '1', name: 'Alex Johnson', title: 'CTO', company: 'Acme Corp', email: 'alex@acme.com', phone: '+1 555-0101', location: 'New York, NY', leadScore: 92, status: 'Active', about: 'Alex leads technical strategy at Acme Corp. Previously at Google and Stripe. Strong interest in AI-powered automation and enterprise SaaS.', linkedin: 'linkedin.com/in/alexjohnson', twitter: '@alexj', tags: ['VIP', 'Enterprise', 'Decision Maker'] },
  '2': { id: '2', name: 'Maria Garcia', title: 'VP Sales', company: 'TechFlow', email: 'maria@techflow.io', phone: '+1 555-0102', location: 'San Francisco, CA', leadScore: 56, status: 'Active', about: 'VP of Sales at TechFlow with a background in SaaS sales cycles. Interested in CRM tools that help her team close faster.', twitter: '@mariag_sales', tags: ['New', 'Mid-Market'] },
  '3': { id: '3', name: 'James Lee', title: 'Founder', company: 'Orbit Labs', email: 'james@orbit.dev', phone: '+1 555-0103', location: 'Austin, TX', leadScore: 81, status: 'Active', about: 'Serial entrepreneur building Orbit Labs. Looking for enterprise CRM to scale GTM operations.', linkedin: 'linkedin.com/in/jameslee', github: 'github.com/jameslee', tags: ['Hot Lead', 'Enterprise'] },
  '4': { id: '4', name: 'Sara Williams', title: '', company: '', email: 'sara@gmail.com', phone: '', location: '', leadScore: 12, status: 'Inactive', about: '', tags: [] },
  '5': { id: '5', name: 'David Chen', title: 'CEO', company: 'NovaStar', email: 'david@novastar.ai', phone: '+1 555-0105', location: 'Seattle, WA', leadScore: 74, status: 'Active', about: 'CEO of NovaStar, an AI startup building next-gen analytics tools. Evaluating CRM vendors for Q3 implementation.', linkedin: 'linkedin.com/in/davidchen', tags: ['Hot', 'Enterprise', 'Q3 Close'] },
};

const MOCK_DEALS: Deal[] = [
  { id: 'd1', title: 'Acme Enterprise Plan', amount: '$48,000', stage: 'Negotiation', closeDate: 'May 15, 2026', contactId: '1' },
  { id: 'd2', title: 'Acme Expansion Deal', amount: '$22,000', stage: 'Proposal', closeDate: 'Jun 1, 2026', contactId: '1' },
  { id: 'd3', title: 'TechFlow Starter', amount: '$9,600', stage: 'Discovery', closeDate: 'Apr 30, 2026', contactId: '2' },
  { id: 'd4', title: 'Orbit Labs Pro', amount: '$36,000', stage: 'Won', closeDate: 'Mar 20, 2026', contactId: '3' },
];

const MOCK_ACTIVITIES: ActivityItem[] = [
  { id: 'a1', type: 'call', title: 'Discovery call — 28 min', date: '2 hours ago', target: 'Alex Johnson', note: 'Discussed timeline and pricing. Follow up with proposal by Friday.' },
  { id: 'a2', type: 'email', title: 'Sent proposal deck', date: 'Yesterday', target: 'Alex Johnson' },
  { id: 'a3', type: 'meeting', title: 'Product demo — 45 min', date: '3 days ago', target: 'Alex Johnson', note: 'Live demo of pipeline and automation features. Very positive reaction.' },
  { id: 'a4', type: 'email', title: 'Intro email sent', date: '1 week ago', target: 'Alex Johnson' },
  { id: 'a5', type: 'email', title: 'Lead form submission', date: '2 weeks ago', target: 'Maria Garcia' },
  { id: 'a6', type: 'call', title: 'Cold outreach call — 5 min', date: '10 days ago', target: 'James Lee' },
];

const STAGE_COLORS: Record<string, string> = {
  Discovery: '#52677D', Proposal: '#52677D', Negotiation: '#52677D', Won: '#52677D', Lost: '#52677D',
};

const TAG_COLORS = ['#52677D', '#52677D', '#52677D', '#52677D', '#52677D', '#52677D', '#52677D'];

function getActivityIcon(type: string) {
  switch (type) {
    case 'email': return { bg: 'bg-primary/10', color: 'text-text-muted', Icon: Mail };
    case 'call': return { bg: 'bg-green-50', color: 'text-green-500', Icon: Phone };
    case 'meeting': return { bg: 'bg-primary/10', color: 'text-text-muted', Icon: CalendarDays };
    default: return { bg: 'bg-surface-hover', color: 'text-text-muted', Icon: Activity };
  }
}

export default function ContactDetail() {
  const { id = '1' } = useParams();
  const [isEditing, setIsEditing] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState<Contact | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'deals' | 'files' | 'custom'>('activity');
  const [newActivity, setNewActivity] = useState<{ type: string; title: string; note: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    // Try API first, fall back to mock
    fetch(`/api/crm/contacts/${id}`)
      .then(res => { if (!res.ok) throw new Error('not found'); return res.json(); })
      .then(data => { setContact(data); setEditForm(data); })
      .catch(() => {
        const mock = MOCK_CONTACTS[id] || MOCK_CONTACTS['1'];
        setContact(mock);
        setEditForm(mock);
      })
      .finally(() => setLoading(false));

    setDeals(MOCK_DEALS.filter(d => d.contactId === id));
    setActivities(MOCK_ACTIVITIES.filter(a => a.target === (MOCK_CONTACTS[id]?.name || '')));
  }, [id]);

  const handleSave = () => {
    if (!editForm) return;
    fetch(`/api/crm/contacts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) })
      .then(res => res.json()).then(setContact).catch(() => setContact(editForm));
    setContact(editForm); setIsEditing(false);
  };

  const addTag = () => {
    if (!newTag.trim() || !editForm) return;
    const updated = { ...editForm, tags: [...(editForm.tags || []), newTag.trim()] };
    setEditForm(updated); setContact(updated); setNewTag(''); setAddingTag(false);
  };

  const removeTag = (tag: string) => {
    if (!editForm) return;
    const updated = { ...editForm, tags: (editForm.tags || []).filter(t => t !== tag) };
    setEditForm(updated); setContact(updated);
  };

  const logActivity = () => {
    if (!newActivity || !newActivity.title.trim()) return;
    const item: ActivityItem = { id: `a-${Date.now()}`, type: newActivity.type, title: newActivity.title, date: 'Just now', target: contact?.name || '', note: newActivity.note };
    setActivities(prev => [item, ...prev]);
    setNewActivity(null);
  };

  const healthBreakdown = contact ? {
    recency: Math.min(30, Math.round(contact.leadScore * 0.30)),
    emailOpens: Math.min(25, Math.round(contact.leadScore * 0.25)),
    calls: Math.min(25, Math.round(contact.leadScore * 0.25)),
    meetings: Math.min(20, Math.round(contact.leadScore * 0.20)),
  } : { recency: 0, emailOpens: 0, calls: 0, meetings: 0 };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] text-text-muted">Loading contact...</p>
      </div>
    </div>
  );

  if (!contact || !editForm) return null;

  const initials = contact.name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="h-full flex flex-col overflow-hidden bg-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/business/crm/contacts" className="p-2 -ml-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#52677D] to-[#52677D] flex items-center justify-center font-bold text-lg text-white shadow-md">
              {initials}
            </div>
            <div>
              {isEditing ? (
                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="text-xl font-bold text-text-main bg-surface border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              ) : (
                <h1 className="text-xl font-bold text-text-main">{contact.name}</h1>
              )}
              {isEditing ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <input type="text" value={editForm.title} placeholder="Job title"
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                    className="text-sm bg-surface border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30 w-32" />
                  <span className="text-sm text-text-muted">at</span>
                  <input type="text" value={editForm.company} placeholder="Company"
                    onChange={e => setEditForm({ ...editForm, company: e.target.value })}
                    className="text-sm bg-surface border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30 w-32" />
                </div>
              ) : (
                <p className="text-sm text-text-muted mt-0.5">{contact.title}{contact.title && contact.company ? ' at ' : ''}<Link to="/business/crm/companies/1" className="text-primary hover:underline">{contact.company}</Link></p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button onClick={() => { setEditForm(contact); setIsEditing(false); }} className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-[#52677D] transition-colors shadow-sm">
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button className="p-2 bg-surface border border-border rounded-lg text-text-muted hover:bg-surface-hover transition-colors">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">

          {/* Left column */}
          <div className="space-y-5">
            {/* Info Card */}
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
              <h2 className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-4">Contact Info</h2>
              <div className="space-y-3">
                {[
                  { icon: Mail, label: 'Email', value: editForm.email, field: 'email', type: 'email' },
                  { icon: Phone, label: 'Mobile', value: editForm.phone, field: 'phone', type: 'tel' },
                  { icon: MapPin, label: 'Location', value: editForm.location, field: 'location', type: 'text' },
                  { icon: Building2, label: 'Company', value: editForm.company, field: 'company', type: 'text' },
                ].map(({ icon: Icon, label, value, field, type }) => (
                  <div key={field} className="flex items-start gap-3 text-sm">
                    <Icon className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input type={type} value={value} onChange={e => setEditForm({ ...editForm, [field]: e.target.value })}
                          className="w-full font-medium text-text-main bg-surface-hover border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30 text-[13px]" />
                      ) : (
                        <div className="font-medium text-text-main text-[13px] truncate">{value || <span className="text-text-muted italic">Not set</span>}</div>
                      )}
                      <div className="text-[11px] text-text-muted mt-0.5">{label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Social Links */}
              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">Social</h3>
                <div className="space-y-2">
                  {[
                    { icon: Linkedin, field: 'linkedin', label: 'LinkedIn', color: 'text-[#52677D]', placeholder: 'linkedin.com/in/...' },
                    { icon: Twitter, field: 'twitter', label: 'Twitter/X', color: 'text-text-main', placeholder: '@username' },
                    { icon: Github, field: 'github', label: 'GitHub', color: 'text-text-main', placeholder: 'github.com/...' },
                  ].map(({ icon: Icon, field, label, color, placeholder }) => (
                    <div key={field} className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                      {isEditing ? (
                        <input type="text" value={(editForm as any)[field] || ''} placeholder={placeholder}
                          onChange={e => setEditForm({ ...editForm, [field]: e.target.value })}
                          className="flex-1 text-[12px] bg-surface-hover border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      ) : (
                        (contact as any)[field] ? (
                          <a href={`https://${(contact as any)[field]?.replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer"
                            className="text-[12px] text-primary hover:underline flex items-center gap-1 truncate">
                            {(contact as any)[field]} <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : <span className="text-[12px] text-text-muted italic">{placeholder}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Health Score */}
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Health Score</h2>
                <span className="text-[11px] font-semibold text-text-muted">Engagement Index</span>
              </div>
              <div className="flex items-center gap-4">
                <ContactHealthScore score={contact.leadScore} size="lg" showLabel activityBreakdown={healthBreakdown} />
                <div className="flex-1 space-y-2">
                  {[
                    { label: 'Recency', val: healthBreakdown.recency, max: 30, color: '#52677D' },
                    { label: 'Email Opens', val: healthBreakdown.emailOpens, max: 25, color: '#52677D' },
                    { label: 'Calls', val: healthBreakdown.calls, max: 25, color: '#52677D' },
                    { label: 'Meetings', val: healthBreakdown.meetings, max: 20, color: '#52677D' },
                  ].map(({ label, val, max, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] text-text-muted mb-0.5"><span>{label}</span><span className="font-semibold">{val}/{max}</span></div>
                      <div className="h-1 bg-surface-hover rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${(val / max) * 100}%` }} transition={{ duration: 0.8, delay: 0.1 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[12px] font-bold text-text-muted uppercase tracking-wider">Tags</h2>
                <button onClick={() => setAddingTag(true)} className="text-[11px] font-semibold text-primary hover:bg-[#52677D] px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(contact.tags || []).map((tag, i) => (
                  <div key={tag} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[12px] font-semibold text-white" style={{ background: TAG_COLORS[i % TAG_COLORS.length] }}>
                    {tag}
                    <button onClick={() => removeTag(tag)} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-surface/20 transition-colors">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                {(contact.tags || []).length === 0 && <p className="text-[12px] text-text-muted italic">No tags yet</p>}
              </div>
              <AnimatePresence>
                {addingTag && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2">
                    <div className="flex gap-2">
                      <input autoFocus value={newTag} onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') setAddingTag(false); }}
                        placeholder="Tag name..." className="flex-1 px-2.5 py-1.5 bg-surface-hover border border-border rounded-lg text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      <button onClick={addTag} className="px-3 py-1.5 bg-primary text-white text-[12px] font-semibold rounded-lg hover:bg-[#52677D]">Add</button>
                      <button onClick={() => setAddingTag(false)} className="p-1.5 text-text-muted hover:text-text-main"><X className="w-4 h-4" /></button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right columns */}
          <div className="lg:col-span-2 space-y-5">
            {/* Quick Actions */}
            <QuickActionsBar contactId={contact.id} contactName={contact.name} contactPhone={contact.phone} contactEmail={contact.email} />

            {/* Tabs */}
            <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex border-b border-border bg-surface-hover">
                {([['activity', 'Activity'], ['deals', 'Deals'], ['files', 'Files'], ['custom', 'Custom Fields']] as const).map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-5 py-3.5 text-[13px] font-semibold transition-colors border-b-2 -mb-px ${activeTab === tab ? 'border-primary text-primary bg-surface' : 'border-transparent text-text-muted hover:text-text-main'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* Activity Tab */}
                {activeTab === 'activity' && (
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="font-semibold text-text-main">Timeline</h2>
                      <button onClick={() => setNewActivity({ type: 'call', title: '', note: '' })}
                        className="text-sm text-primary hover:underline font-medium">+ Log Activity</button>
                    </div>

                    <AnimatePresence>
                      {newActivity && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="mb-5 p-4 bg-[#52677D]/50 border border-primary/20 rounded-xl space-y-3">
                          <div className="flex gap-2">
                            {[['call', 'Call'], ['email', 'Email'], ['meeting', 'Meeting'], ['note', 'Note']].map(([type, label]) => (
                              <button key={type} onClick={() => setNewActivity({ ...newActivity, type })}
                                className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-colors ${newActivity.type === type ? 'bg-primary text-white' : 'bg-surface border border-border text-text-main hover:bg-surface-hover'}`}>
                                {label}
                              </button>
                            ))}
                          </div>
                          <input value={newActivity.title} onChange={e => setNewActivity({ ...newActivity, title: e.target.value })}
                            placeholder="Activity title..." className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30" />
                          <textarea value={newActivity.note} onChange={e => setNewActivity({ ...newActivity, note: e.target.value })}
                            placeholder="Notes (optional)..." rows={2}
                            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setNewActivity(null)} className="px-4 py-1.5 text-[12px] font-semibold text-text-muted hover:bg-surface-hover rounded-lg">Cancel</button>
                            <button onClick={logActivity} className="px-4 py-1.5 text-[12px] font-semibold bg-primary text-white rounded-lg hover:bg-[#52677D]">Log Activity</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {activities.length === 0 ? (
                      <div className="text-center py-10 text-text-muted">
                        <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-[13px] font-medium">No activity yet</p>
                        <p className="text-[12px] mt-1">Log a call, email, or meeting to start the timeline.</p>
                      </div>
                    ) : (
                      <div className="relative border-l-2 border-border ml-4 space-y-5 pb-2">
                        {activities.map(act => {
                          const { Icon, color, bg } = getActivityIcon(act.type);
                          return (
                            <div key={act.id} className="relative pl-7">
                              <div className={`absolute -left-[17px] top-0.5 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${bg}`}>
                                <Icon className={`w-3.5 h-3.5 ${color}`} />
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-0.5">
                                  <h3 className="text-[13px] font-semibold text-text-main">{act.title}</h3>
                                  <span className="text-[11px] text-text-muted">{act.date}</span>
                                </div>
                                {act.note && <p className="text-[12px] text-text-muted leading-relaxed">{act.note}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Deals Tab */}
                {activeTab === 'deals' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-text-main">Associated Deals</h2>
                      <button className="text-sm text-primary hover:underline font-medium">+ Add Deal</button>
                    </div>
                    {deals.length === 0 ? (
                      <div className="text-center py-10 text-text-muted border-2 border-dashed border-border rounded-xl">
                        <CircleDollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-[13px] font-medium">No deals linked</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {deals.map(deal => (
                          <Link key={deal.id} to={`/business/crm/deals/${deal.id}`}
                            className="flex items-center justify-between p-4 bg-surface-hover border border-border rounded-xl hover:border-primary/40 hover:bg-[#52677D]/30 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                                <CircleDollarSign className="w-5 h-5 text-text-muted0" />
                              </div>
                              <div>
                                <div className="font-semibold text-[13px] text-text-main">{deal.title}</div>
                                <div className="text-[11px] text-text-muted mt-0.5">Close: {deal.closeDate}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-[14px] text-text-main">{deal.amount}</div>
                              <div className="text-[11px] font-semibold mt-0.5" style={{ color: STAGE_COLORS[deal.stage] || '#52677D' }}>{deal.stage}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Files Tab */}
                {activeTab === 'files' && <FileAttachments entityId={id} />}

                {/* Custom Fields Tab */}
                {activeTab === 'custom' && <CustomFieldsPanel entityId={id} entityType="contact" />}
              </div>
            </div>

            {/* About */}
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
              <h2 className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-3">Background</h2>
              {isEditing ? (
                <textarea value={editForm.about || ''} onChange={e => setEditForm({ ...editForm, about: e.target.value })} rows={4}
                  className="w-full text-[13px] text-text-main leading-relaxed bg-surface-hover border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              ) : (
                <p className="text-[13px] text-text-main leading-relaxed">{contact.about || <span className="text-text-muted italic">No background notes.</span>}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
