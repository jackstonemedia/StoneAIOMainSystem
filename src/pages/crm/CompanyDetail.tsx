import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Globe, MapPin, Users, CircleDollarSign, Edit2, MoreHorizontal, Mail, Phone, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Company {
  id: string;
  name: string;
  industry: string;
  website: string;
  location: string;
  employees: string;
  revenue: string;
  description: string;
}

interface Contact {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  companyId: string;
}

interface Deal {
  id: string;
  title: string;
  amount: string;
  stage: string;
  closeDate: string;
  companyId: string;
}

export default function CompanyDetail() {
  const { id } = useParams();
  const [isEditing, setIsEditing] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [editForm, setEditForm] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/crm/companies/${id}`).then(res => res.json()),
      fetch('/api/crm/contacts').then(res => res.json()),
      fetch('/api/crm/deals').then(res => res.json())
    ])
      .then(([companyData, contactsData, dealsData]) => {
        setCompany(companyData);
        setEditForm(companyData);
        setContacts(contactsData.filter((c: Contact) => c.companyId === id));
        setDeals(dealsData.filter((d: Deal) => d.companyId === id));
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch company details:', err);
        setLoading(false);
      });
  }, [id]);

  const handleSave = () => {
    if (!editForm) return;

    fetch(`/api/crm/companies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm)
    })
      .then(res => res.json())
      .then(data => {
        setCompany(data);
        setIsEditing(false);
      })
      .catch(err => console.error('Failed to update company:', err));
  };

  const handleCancel = () => {
    setEditForm(company);
    setIsEditing(false);
  };

  if (loading || !company || !editForm) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-muted">Loading company...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/crm/companies" className="p-2 -ml-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-bg border border-border flex items-center justify-center font-semibold text-xl text-text-muted">
              {company.name.charAt(0)}
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
                <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
              )}
              
              {isEditing ? (
                <div className="flex items-center gap-2 mt-2">
                  <Globe className="w-3.5 h-3.5 text-text-muted" />
                  <input 
                    type="text" 
                    value={editForm.website}
                    onChange={e => setEditForm({...editForm, website: e.target.value})}
                    className="text-sm bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-sm text-text-muted">•</span>
                  <input 
                    type="text" 
                    value={editForm.industry}
                    onChange={e => setEditForm({...editForm, industry: e.target.value})}
                    className="text-sm bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm text-text-muted mt-0.5">
                  <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> {company.website}</span>
                  <span>•</span>
                  <span>{company.industry}</span>
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
                      <div className="font-medium text-text-main">{company.location}</div>
                    )}
                    <div className="text-xs text-text-muted mt-1">Headquarters</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <Users className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  <div className="w-full">
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editForm.employees}
                        onChange={e => setEditForm({...editForm, employees: e.target.value})}
                        className="w-full font-medium text-text-main bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    ) : (
                      <div className="font-medium text-text-main">{company.employees}</div>
                    )}
                    <div className="text-xs text-text-muted mt-1">Employees</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <CircleDollarSign className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  <div className="w-full">
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editForm.revenue}
                        onChange={e => setEditForm({...editForm, revenue: e.target.value})}
                        className="w-full font-medium text-text-main bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    ) : (
                      <div className="font-medium text-text-main">{company.revenue}</div>
                    )}
                    <div className="text-xs text-text-muted mt-1">Annual Revenue</div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Description</h3>
                {isEditing ? (
                  <textarea 
                    value={editForm.description}
                    onChange={e => setEditForm({...editForm, description: e.target.value})}
                    rows={4}
                    className="w-full text-sm text-text-main leading-relaxed bg-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                ) : (
                  <p className="text-sm text-text-main leading-relaxed">{company.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Contacts & Deals */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Contacts */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Contacts</h2>
                <button className="text-sm text-primary hover:underline font-medium">Add Contact</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contacts.length === 0 ? (
                  <div className="col-span-full text-sm text-text-muted p-4 text-center border border-dashed border-border rounded-lg">No contacts found for this company.</div>
                ) : (
                  contacts.map(contact => (
                    <Link key={contact.id} to={`/crm/contacts/${contact.id}`} className="flex items-start gap-3 p-4 bg-bg border border-border rounded-lg hover:border-primary/50 transition-colors group">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                        {contact.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">{contact.name}</div>
                        <div className="text-xs text-text-muted truncate mb-2">{contact.title}</div>
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Associated Deals */}
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Deals</h2>
                <button className="text-sm text-primary hover:underline font-medium">Add Deal</button>
              </div>
              <div className="space-y-3">
                {deals.length === 0 ? (
                  <div className="text-sm text-text-muted p-4 text-center border border-dashed border-border rounded-lg">No deals found for this company.</div>
                ) : (
                  deals.map(deal => (
                    <Link key={deal.id} to={`/crm/deals/${deal.id}`} className="flex items-center justify-between p-4 bg-bg border border-border rounded-lg hover:border-primary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${deal.stage === 'Won' ? 'bg-green/10' : 'bg-amber/10'}`}>
                          <CircleDollarSign className={`w-5 h-5 ${deal.stage === 'Won' ? 'text-green' : 'text-amber'}`} />
                        </div>
                        <div>
                          <div className="font-medium text-sm hover:text-primary transition-colors">{deal.title}</div>
                          <div className="text-xs text-text-muted mt-0.5">Close date: {deal.closeDate}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{deal.amount}</div>
                        <div className={`text-xs font-medium mt-0.5 ${deal.stage === 'Won' ? 'text-green' : 'text-amber'}`}>{deal.stage}</div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
