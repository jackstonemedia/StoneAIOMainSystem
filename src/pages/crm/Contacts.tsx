import { Plus, Search, Filter, MoreHorizontal, Mail, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface Contact {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  score?: number;
  lastActivity?: string;
  leadScore?: number;
  lastContact?: string;
}

export default function Contacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/crm/contacts')
      .then(res => res.json())
      .then(data => {
        setContacts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch contacts:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-border bg-surface shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-text-muted mt-1">Manage your leads, customers, and partners.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          New Contact
        </button>
      </header>

      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-bg shrink-0">
        <div className="relative w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search contacts..." 
            className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-hover transition-colors">
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-text-muted">Loading contacts...</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-bg border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium text-text-muted">Name</th>
                  <th className="px-6 py-3 font-medium text-text-muted">Company</th>
                  <th className="px-6 py-3 font-medium text-text-muted">Contact Info</th>
                  <th className="px-6 py-3 font-medium text-text-muted">Lead Score</th>
                  <th className="px-6 py-3 font-medium text-text-muted">Last Activity</th>
                  <th className="px-6 py-3 font-medium text-text-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((contact) => {
                  const score = contact.leadScore || contact.score || 0;
                  const lastActivity = contact.lastContact || contact.lastActivity || 'Never';
                  
                  return (
                    <tr 
                      key={contact.id} 
                      onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                      className="hover:bg-surface-hover transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                            {contact.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="font-medium text-text-main group-hover:text-primary transition-colors">{contact.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-muted">{contact.company}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-text-muted">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{contact.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-text-muted">
                            <Phone className="w-3 h-3" />
                            <span>{contact.phone}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-bg rounded-full h-1.5 max-w-[60px]">
                            <div 
                              className={`h-1.5 rounded-full ${score >= 80 ? 'bg-green' : score >= 60 ? 'bg-amber' : 'bg-red'}`} 
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{score}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-muted">{lastActivity}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 text-text-muted hover:text-text-main opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
