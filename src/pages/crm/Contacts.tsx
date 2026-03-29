import { Plus, Search, Filter, MoreHorizontal, Mail, Phone, Building2, CircleDollarSign, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getContacts } from '../../lib/api';
import ContactSlideOver from '../../components/crm/ContactSlideOver';
import { SmartTable, Column, TableGroup } from '../../components/crm/SmartTable';
import CrmSetup from '../../components/crm/CrmSetup';
import SmartListSidebar from '../../components/crm/SmartListSidebar';

interface Contact {
  id: string;
  firstName: string;
  lastName?: string | null;
  company?: { name: string } | null;
  email: string;
  phone?: string | null;
  score?: number;
  lastActivity?: string;
  leadScore?: number;
  lastContact?: string;
}

export default function Contacts() {
  const navigate = useNavigate();
  const { data: contacts = [], isLoading: loading } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: getContacts
  });

  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [activeListId, setActiveListId] = useState('all');

  const tableColumns: Column<Contact>[] = [
    {
      key: 'name',
      header: 'Name',
      width: '30%',
      render: (c) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 uppercase border border-primary/20">
            {c.firstName?.charAt(0) || 'U'}
          </div>
          <span className="font-medium text-text-main group-hover/row:text-primary transition-colors">
            {`${c.firstName} ${c.lastName || ''}`.trim()}
          </span>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      align: 'left',
      width: '200px',
      render: (c) => (
        <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded w-max transition-colors">
          <Mail className="w-3 h-3" />
          {c.email || 'No email'}
        </a>
      )
    },
    {
      key: 'company',
      header: 'Accounts',
      align: 'center',
      width: '180px',
      render: (c) => (
        c.company?.name ? (
          <div className="flex items-center justify-center mx-auto gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded w-max text-xs font-medium">
             <Building2 className="w-3 h-3" />
             {c.company.name}
          </div>
        ) : (
          <span className="text-text-muted text-xs">-</span>
        )
      )
    },
    {
      key: 'deals',
      header: 'Deals',
      align: 'center',
      width: '180px',
      render: () => (
        // Just mocking the exact visual from the screenshot (Light blue Deals pill)
        // In a real scenario we'd query contacts[]->deals
        <div className="flex items-center justify-center gap-1.5 mx-auto bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-3 py-1 rounded w-max text-xs font-medium cursor-pointer hover:bg-cyan-500/20 transition-colors">
           <CircleDollarSign className="w-3 h-3" />
           Add deal
        </div>
      )
    },
    {
      key: 'phone',
      header: 'Phone',
      align: 'center',
      width: '150px',
      render: (c) => (
        <span className="text-sm text-text-muted font-mono">{c.phone || '-'}</span>
      )
    }
  ];

  const tableGroups: TableGroup<Contact>[] = [
    {
      id: 'active_contacts',
      title: 'Active Contacts',
      color: 'bg-green-500',
      items: contacts
    }
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-border bg-surface shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-text-muted mt-1">Manage your leads, customers, and partners.</p>
        </div>
        <button 
          onClick={() => setIsSlideOverOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white shadow-md shadow-primary/20 rounded-lg font-medium hover:bg-primary-hover transition-all"
        >
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

      {/* Main Content Area */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center p-8 text-text-muted">Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <div className="flex-1 flex overflow-hidden">
          <CrmSetup />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <SmartListSidebar 
            activeListId={activeListId} 
            onSelectList={setActiveListId} 
          />
          <div className="flex-1 overflow-auto p-8">
            <main className="max-w-[1400px]">
              <SmartTable 
                columns={tableColumns} 
                groups={tableGroups} 
                onRowClick={(c) => navigate(`/business/crm/contacts/${c.id}`)}
                onAddClick={() => setIsSlideOverOpen(true)}
                addLabel="+ Add Item"
              />
            </main>
          </div>
        </div>
      )}

      <ContactSlideOver 
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
      />
    </div>
  );
}
