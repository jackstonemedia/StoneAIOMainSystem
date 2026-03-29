import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getForms, createForm } from '../../lib/api';
import { FormInput, Plus, Search, Filter, MoreHorizontal, MousePointerClick, CheckCircle2, Copy } from 'lucide-react';

export default function Forms() {
  const queryClient = useQueryClient();
  const { data: forms = [], isLoading } = useQuery<any[]>({
    queryKey: ['forms'],
    queryFn: getForms
  });

  const createMutation = useMutation<any, Error, any>({
    mutationFn: createForm,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forms'] })
  });

  const handleCreateTestForm = () => {
    createMutation.mutate({
      name: 'Test Form ' + Math.floor(Math.random() * 100),
      schema: JSON.stringify({ fields: [] })
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg font-sans overflow-hidden">
      
      {/* Header */}
      <header className="px-8 py-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-main tracking-tight">Forms & Surveys</h1>
            <p className="text-sm text-text-muted mt-1">Build custom forms to capture leads and gather feedback.</p>
          </div>
          <button 
            onClick={handleCreateTestForm}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
            Create Form
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search forms..." 
              className="w-64 pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary text-text-main placeholder:text-text-muted/60"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-surface-hover text-text-main transition-colors">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        {/* Forms List */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg/50">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Name</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Status</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Submissions</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted">Conv. Rate</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-text-muted">Loading forms...</td></tr>
              ) : forms.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-text-muted">No forms found. Create one.</td></tr>
              ) : forms.map((form: any) => (
                <tr key={form.id} className="hover:bg-surface-hover transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                        <FormInput className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-text-main group-hover:text-primary transition-colors cursor-pointer">{form.name}</h4>
                        <div className="flex flex-wrap gap-2 mt-0.5">
                          <span className="text-[10px] font-medium bg-bg text-text-muted px-1.5 py-0.5 rounded-md border border-border">Form</span>
                          <span className="text-xs text-text-muted">Last edited {new Date(form.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-text-main">{(form.submissions?.length || 0).toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm font-medium text-text-main">
                      <MousePointerClick className="w-3 h-3 text-text-muted" />
                      {form.visits > 0 ? ((form.submissions?.length || 0) / form.visits * 100).toFixed(1) : 0}%
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Copy Embed Link">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-text-muted hover:text-text-main hover:bg-surface rounded-lg transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
