import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CircleDollarSign, Calendar, Building2, Users, MoreHorizontal, Edit2, CheckCircle2, XCircle, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Deal {
  id: string;
  title: string;
  amount: string;
  stage: string;
  probability: number;
  closeDate: string;
  company: string;
  companyId: string;
  contact: string;
  contactId: string;
  owner: string;
  description: string;
}

interface Company {
  id: string;
  name: string;
  industry: string;
}

interface Contact {
  id: string;
  name: string;
  title: string;
}

export default function DealDetail() {
  const { id } = useParams();
  const [isEditing, setIsEditing] = useState(false);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [editForm, setEditForm] = useState<Deal | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/crm/deals/${id}`)
      .then(res => res.json())
      .then(dealData => {
        setDeal(dealData);
        setEditForm(dealData);
        
        // Fetch associated company and contact
        Promise.all([
          fetch(`/api/crm/companies/${dealData.companyId}`).then(res => res.ok ? res.json() : null),
          fetch(`/api/crm/contacts/${dealData.contactId}`).then(res => res.ok ? res.json() : null)
        ]).then(([companyData, contactData]) => {
          setCompany(companyData);
          setContact(contactData);
          setLoading(false);
        }).catch(err => {
          console.error('Failed to fetch associations:', err);
          setLoading(false);
        });
      })
      .catch(err => {
        console.error('Failed to fetch deal:', err);
        setLoading(false);
      });
  }, [id]);

  const handleSave = () => {
    if (!editForm) return;

    fetch(`/api/crm/deals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm)
    })
      .then(res => res.json())
      .then(data => {
        setDeal(data);
        setIsEditing(false);
      })
      .catch(err => console.error('Failed to update deal:', err));
  };

  const handleCancel = () => {
    setEditForm(deal);
    setIsEditing(false);
  };

  const stages = [
    { id: 'lead', name: 'Lead', completed: true },
    { id: 'qualified', name: 'Qualified', completed: true },
    { id: 'proposal', name: 'Proposal', completed: false, current: true },
    { id: 'negotiation', name: 'Negotiation', completed: false },
    { id: 'won', name: 'Won', completed: false },
  ];

  if (loading || !deal || !editForm) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-muted">Loading deal...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/business/crm/deals" className="p-2 -ml-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber/10 flex items-center justify-center shrink-0">
              <CircleDollarSign className="w-6 h-6 text-amber" />
            </div>
            <div>
              {isEditing ? (
                <input 
                  type="text" 
                  value={editForm.title}
                  onChange={e => setEditForm({...editForm, title: e.target.value})}
                  className="text-2xl font-semibold tracking-tight bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              ) : (
                <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
              )}
              
              {isEditing ? (
                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="text" 
                    value={editForm.amount}
                    onChange={e => setEditForm({...editForm, amount: e.target.value})}
                    className="text-sm font-medium text-text-main bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-sm text-text-muted">•</span>
                  <select 
                    value={editForm.stage}
                    onChange={e => setEditForm({...editForm, stage: e.target.value})}
                    className="text-sm bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {stages.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm text-text-muted mt-0.5">
                  <span className="font-medium text-text-main">{deal.amount}</span>
                  <span>•</span>
                  <span>{deal.stage}</span>
                </div>
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
              <button className="flex items-center gap-2 px-4 py-2 bg-green text-white rounded-lg text-sm font-medium hover:bg-green/90 transition-colors">
                <CheckCircle2 className="w-4 h-4" />
                Won
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-red/10 hover:text-red hover:border-red/20 transition-colors">
                <XCircle className="w-4 h-4" />
                Lost
              </button>
              <div className="w-px h-6 bg-border mx-1" />
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
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Pipeline Progress */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold">Pipeline Stage</h2>
              <span className="text-sm font-medium text-text-muted">{deal.probability}% Probability</span>
            </div>
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-bg rounded-full" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-amber rounded-full transition-all" style={{ width: '50%' }} />
              
              {stages.map((stage, index) => (
                <div key={stage.id} className="relative flex flex-col items-center gap-2 z-10">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                    stage.completed ? 'bg-amber border-amber text-white' : 
                    stage.current ? 'bg-surface border-amber text-amber' : 
                    'bg-surface border-border text-text-muted'
                  }`}>
                    {stage.completed && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                  <span className={`text-xs font-medium ${stage.current ? 'text-text-main' : 'text-text-muted'}`}>
                    {stage.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Details */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-surface border border-border rounded-xl p-6">
                <h2 className="font-semibold mb-4">Deal Details</h2>
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <div className="text-xs text-text-muted mb-1">Amount</div>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editForm.amount}
                        onChange={e => setEditForm({...editForm, amount: e.target.value})}
                        className="w-full font-medium bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    ) : (
                      <div className="font-medium">{deal.amount}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-text-muted mb-1">Expected Close Date</div>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editForm.closeDate}
                        onChange={e => setEditForm({...editForm, closeDate: e.target.value})}
                        className="w-full font-medium bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    ) : (
                      <div className="flex items-center gap-2 font-medium">
                        <Calendar className="w-4 h-4 text-text-muted" />
                        {deal.closeDate}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-text-muted mb-1">Pipeline</div>
                    <div className="font-medium">Standard Sales</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted mb-1">Owner</div>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editForm.owner}
                        onChange={e => setEditForm({...editForm, owner: e.target.value})}
                        className="w-full font-medium bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    ) : (
                      <div className="font-medium">{deal.owner}</div>
                    )}
                  </div>
                </div>
                
                <div className="pt-6 border-t border-border">
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Description</h3>
                  {isEditing ? (
                    <textarea 
                      value={editForm.description}
                      onChange={e => setEditForm({...editForm, description: e.target.value})}
                      rows={4}
                      className="w-full text-sm text-text-main leading-relaxed bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    />
                  ) : (
                    <p className="text-sm text-text-main leading-relaxed">{deal.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Associations */}
            <div className="space-y-6">
              {/* Company */}
              <div className="bg-surface border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">Company</h2>
                </div>
                {company ? (
                  <Link to={`/business/crm/companies/${deal.companyId}`} className="flex items-center gap-3 p-3 bg-bg border border-border rounded-lg hover:border-primary/50 transition-colors group">
                    <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <div className="font-medium text-sm group-hover:text-primary transition-colors">{company.name}</div>
                      <div className="text-xs text-text-muted mt-0.5">{company.industry}</div>
                    </div>
                  </Link>
                ) : (
                  <div className="text-sm text-text-muted">No company associated.</div>
                )}
              </div>

              {/* Contact */}
              <div className="bg-surface border border-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">Contact</h2>
                </div>
                {contact ? (
                  <Link to={`/business/crm/contacts/${deal.contactId}`} className="flex items-center gap-3 p-3 bg-bg border border-border rounded-lg hover:border-primary/50 transition-colors group">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                      {contact.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-medium text-sm group-hover:text-primary transition-colors">{contact.name}</div>
                      <div className="text-xs text-text-muted mt-0.5">{contact.title}</div>
                    </div>
                  </Link>
                ) : (
                  <div className="text-sm text-text-muted">No contact associated.</div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
