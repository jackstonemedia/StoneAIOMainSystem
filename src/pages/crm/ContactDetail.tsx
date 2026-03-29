import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, Building2, CalendarDays, Activity, CircleDollarSign, Edit2, MoreHorizontal, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import QuickActionsBar from '../../components/crm/QuickActionsBar';

interface Contact {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  location: string;
  leadScore: number;
  status: string;
  about: string;
}

interface Deal {
  id: string;
  title: string;
  amount: string;
  stage: string;
  closeDate: string;
  contactId: string;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  date: string;
  target: string;
}

export default function ContactDetail() {
  const { id } = useParams();
  const [isEditing, setIsEditing] = useState(false);
  const [contact, setContact] = useState<Contact | null>(null);
  const [editForm, setEditForm] = useState<Contact | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/crm/contacts/${id}`).then(res => res.json()),
      fetch('/api/crm/deals').then(res => res.json()),
      fetch('/api/crm/activities').then(res => res.json())
    ])
      .then(([contactData, dealsData, activitiesData]) => {
        setContact(contactData);
        setEditForm(contactData);
        setDeals(dealsData.filter((d: Deal) => d.contactId === id));
        setActivities(activitiesData.filter((a: ActivityItem) => a.target === contactData.name));
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch contact details:', err);
        setLoading(false);
      });
  }, [id]);

  const handleSave = () => {
    if (!editForm) return;
    
    fetch(`/api/crm/contacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm)
    })
      .then(res => res.json())
      .then(data => {
        setContact(data);
        setIsEditing(false);
      })
      .catch(err => console.error('Failed to update contact:', err));
  };

  const handleCancel = () => {
    setEditForm(contact);
    setIsEditing(false);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'email': return { icon: Mail, color: 'text-blue-500', bg: 'bg-blue-500/10' };
      case 'call': return { icon: Phone, color: 'text-green', bg: 'bg-green/10' };
      case 'meeting': return { icon: CalendarDays, color: 'text-purple', bg: 'bg-purple/10' };
      default: return { icon: Activity, color: 'text-slate-500', bg: 'bg-slate-500/10' };
    }
  };

  if (loading || !contact || !editForm) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-muted">Loading contact...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/business/crm/contacts" className="p-2 -ml-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg">
              {contact.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              {isEditing ? (
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="text-2xl font-semibold tracking-tight bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              ) : (
                <h1 className="text-2xl font-semibold tracking-tight">{contact.name}</h1>
              )}
              
              {isEditing ? (
                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="text" 
                    value={editForm.title}
                    onChange={e => setEditForm({...editForm, title: e.target.value})}
                    className="text-sm bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-sm text-text-muted">at</span>
                  <input 
                    type="text" 
                    value={editForm.company}
                    onChange={e => setEditForm({...editForm, company: e.target.value})}
                    className="text-sm bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              ) : (
                <p className="text-sm text-text-muted mt-0.5">{contact.title} at <Link to="/business/crm/companies/1" className="text-primary hover:underline">{contact.company}</Link></p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors">
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                <Save className="w-4 h-4" />
                Save
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors">
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button className="p-2 bg-surface border border-border rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Details */}
          <div className="space-y-6">
            {/* About Card */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <h2 className="font-semibold mb-4">About</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-sm">
                  <Mail className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  <div className="w-full">
                    {isEditing ? (
                      <input 
                        type="email" 
                        value={editForm.email}
                        onChange={e => setEditForm({...editForm, email: e.target.value})}
                        className="w-full font-medium text-text-main bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    ) : (
                      <div className="font-medium text-text-main">{contact.email}</div>
                    )}
                    <div className="text-xs text-text-muted mt-1">Work Email</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <Phone className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  <div className="w-full">
                    {isEditing ? (
                      <input 
                        type="tel" 
                        value={editForm.phone}
                        onChange={e => setEditForm({...editForm, phone: e.target.value})}
                        className="w-full font-medium text-text-main bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    ) : (
                      <div className="font-medium text-text-main">{contact.phone}</div>
                    )}
                    <div className="text-xs text-text-muted mt-1">Mobile</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  <div className="w-full">
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editForm.location}
                        onChange={e => setEditForm({...editForm, location: e.target.value})}
                        className="w-full font-medium text-text-main bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    ) : (
                      <div className="font-medium text-text-main">{contact.location}</div>
                    )}
                    <div className="text-xs text-text-muted mt-1">Location</div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Background</h3>
                {isEditing ? (
                  <textarea 
                    value={editForm.about}
                    onChange={e => setEditForm({...editForm, about: e.target.value})}
                    rows={4}
                    className="w-full text-sm text-text-main leading-relaxed bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                ) : (
                  <p className="text-sm text-text-main leading-relaxed">{contact.about}</p>
                )}
              </div>
            </div>

            {/* Lead Score Card */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Lead Score</h2>
                <span className="text-2xl font-bold text-green">{contact.leadScore}</span>
              </div>
              <div className="w-full bg-bg rounded-full h-2 mb-2">
                <div className="bg-green h-2 rounded-full" style={{ width: `${contact.leadScore}%` }} />
              </div>
              <p className="text-xs text-text-muted">Highly engaged. Ready for sales contact.</p>
            </div>
          </div>

          {/* Right Column: Activity & Deals */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Quick Actions Bar */}
            <QuickActionsBar 
              contactId={contact.id} 
              contactName={contact.name} 
              contactPhone={contact.phone} 
              contactEmail={contact.email} 
            />

            {/* Associated Deals */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Deals</h2>
                <button className="text-sm text-primary hover:underline font-medium">Add Deal</button>
              </div>
              <div className="space-y-3">
                {deals.length === 0 ? (
                  <div className="text-sm text-text-muted p-4 text-center border border-dashed border-border rounded-lg">No deals found for this contact.</div>
                ) : (
                  deals.map(deal => (
                    <Link key={deal.id} to={`/business/crm/deals/${deal.id}`} className="flex items-center justify-between p-4 bg-bg border border-border rounded-lg hover:border-primary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                          <CircleDollarSign className="w-5 h-5 text-amber" />
                        </div>
                        <div>
                          <div className="font-medium text-sm hover:text-primary transition-colors">{deal.title}</div>
                          <div className="text-xs text-text-muted mt-0.5">Close date: {deal.closeDate}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{deal.amount}</div>
                        <div className="text-xs font-medium text-amber mt-0.5">{deal.stage}</div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold">Activity</h2>
                <button className="text-sm text-primary hover:underline font-medium">Log Activity</button>
              </div>
              <div className="relative border-l border-border ml-4 space-y-6 pb-4">
                {activities.length === 0 ? (
                  <div className="text-sm text-text-muted pl-6">No recent activity.</div>
                ) : (
                  activities.map((activity) => {
                    const { icon: Icon, color, bg } = getIconForType(activity.type);
                    return (
                      <div key={activity.id} className="relative pl-6">
                        <div className={`absolute -left-3 top-0.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-surface ${bg}`}>
                          <Icon className={`w-3 h-3 ${color}`} />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-sm font-medium">{activity.title}</h3>
                            <span className="text-xs text-text-muted">{activity.date}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
