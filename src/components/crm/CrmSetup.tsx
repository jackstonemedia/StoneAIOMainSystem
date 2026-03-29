import React, { useState } from 'react';
import { SmartTable, Column, TableGroup } from './SmartTable';
import { Mail, Building2, CircleDollarSign } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContact } from '../../lib/api';

export default function CrmSetup() {
  const [names, setNames] = useState<string[]>(['', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleCreateContacts = async () => {
    const validNames = names.filter(n => n.trim() !== '');
    if (validNames.length === 0) return;
    
    setIsSubmitting(true);
    try {
      for (const name of validNames) {
        const parts = name.trim().split(' ');
        const firstName = parts[0];
        const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
        
        await createContact({
          firstName,
          lastName,
          email: `${firstName.toLowerCase()}@example.com`
        });
      }
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewItems = names.filter(n => n.trim() !== '').map((name, i) => {
    const parts = name.trim().split(' ');
    return {
      id: `preview-${i}`,
      firstName: parts[0] || 'Unknown',
      lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
      email: `${parts[0].toLowerCase() || 'contact'}@company.com`
    };
  });

  const tableColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Name',
      width: '25%',
      render: (c) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 uppercase border border-primary/20">
            {c.firstName?.charAt(0) || 'U'}
          </div>
          <span className="font-medium text-text-main">
            {`${c.firstName} ${c.lastName || ''}`.trim()}
          </span>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      align: 'left',
      width: '30%',
      render: (c) => (
        <div className="flex items-center gap-1.5 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded w-max">
          <Mail className="w-3 h-3" />
          {c.email}
        </div>
      )
    },
    {
      key: 'company',
      header: 'Accounts',
      align: 'center',
      width: '20%',
      render: () => (
        <div className="flex items-center justify-center mx-auto gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded w-max text-xs font-medium">
           <Building2 className="w-3 h-3" />
           Add
        </div>
      )
    },
    {
      key: 'deals',
      header: 'Deals',
      align: 'center',
      width: '20%',
      render: () => (
        <div className="flex items-center justify-center gap-1.5 mx-auto bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-3 py-1 rounded w-max text-xs font-medium">
           <CircleDollarSign className="w-3 h-3" />
           Add deal
        </div>
      )
    }
  ];

  const tableGroups: TableGroup<any>[] = [
    {
      id: 'preview_contacts',
      title: 'Active Contacts',
      color: 'bg-green-500',
      items: previewItems.length > 0 ? previewItems : [{ id: 'mock', firstName: 'Type a name', lastName: 'on the left...', email: 'preview@example.com' }]
    }
  ];

  return (
    <div className="w-full h-full flex bg-bg">
      {/* Left Pane - Setup Form */}
      <div className="w-[450px] shrink-0 border-r border-border bg-surface flex flex-col p-12 overflow-y-auto">
        <h1 className="text-2xl font-semibold mb-2 text-text-main flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
             <div className="w-3 h-3 bg-white rounded-full"></div>
          </span>
          Next, add a few contacts
        </h1>
        <p className="text-sm text-text-muted mb-8 italic">Each row represents a single contact. You can add more information later.</p>
        
        <div className="flex flex-col gap-3 mb-8">
          {names.map((name, idx) => (
            <input 
              key={idx}
              type="text"
              value={name}
              onChange={(e) => {
                const newNames = [...names];
                newNames[idx] = e.target.value;
                setNames(newNames);
              }}
              placeholder="e.g. Robert Thompson"
              className="w-full p-3 bg-bg border border-border/80 rounded-lg text-sm font-medium focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-text-muted/50"
            />
          ))}
          <button 
             onClick={() => setNames([...names, ''])}
             className="text-left text-primary text-sm font-medium p-2 hover:bg-primary/5 rounded border border-transparent hover:border-primary/20 transition-all w-max"
          >
            + Add another
          </button>
        </div>

        <div className="mt-auto pt-8 flex justify-end">
          <button 
            disabled={isSubmitting || previewItems.length === 0}
            onClick={handleCreateContacts}
            className="px-6 py-2.5 bg-primary text-white font-medium shadow-md shadow-primary/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover transition-all flex items-center gap-2"
          >
            {isSubmitting ? 'Creating...' : 'Next'}
          </button>
        </div>
      </div>

      {/* Right Pane - Live Table Preview */}
      <div className="flex-1 overflow-auto bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
         <div className="p-8 h-full flex items-center justify-center">
            {/* The "Window" Preview frame */}
            <div className="w-full max-w-4xl bg-surface border border-border/70 rounded-2xl shadow-2xl p-8 overflow-hidden transform scale-95 origin-center transition-all animate-in fade-in zoom-in duration-500">
               <h2 className="text-2xl font-bold mb-6 text-text-main/80">Contacts</h2>
               <div className="opacity-80">
                 <SmartTable columns={tableColumns} groups={tableGroups} />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
