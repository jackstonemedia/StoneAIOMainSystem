import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../../../lib/api/conversations';
import { queryKeys } from '../../../lib/queryKeys';
import type { Conversation } from '../../../types/conversation';

function Accordion({ title, children, defaultOpen = false }: { title: string; children?: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/40">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-[12px] font-bold text-text-main hover:bg-surface-hover transition-colors">
        {title}
        {open ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <Plus className="w-3.5 h-3.5 text-text-muted" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function ThreadInfoPanel({ conv }: { conv: Conversation }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'contact' | 'copilot'>('contact');
  const [tagInput, setTagInput] = useState('');

  const patch = useMutation({
    mutationFn: (data: Parameters<typeof conversationsApi.patch>[1]) => conversationsApi.patch(conv.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.detail(conv.id) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
  });

  const contact = conv.contact;
  const displayName = contact
    ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || contact.email || 'Unknown'
    : 'Unknown';

  const tags: string[] = Array.isArray(conv.tags) ? conv.tags : (conv.tagsJson ? JSON.parse(conv.tagsJson as any) : []);

  const addTag = (tag: string) => {
    if (!tag.trim() || tags.includes(tag.trim())) return;
    patch.mutate({ tags: [...tags, tag.trim()] });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    patch.mutate({ tags: tags.filter(t => t !== tag) });
  };

  const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;

  return (
    <div className="w-[280px] shrink-0 border-l border-border/60 bg-surface/85 flex flex-col h-full font-inter overflow-hidden backdrop-blur-md">
      {/* Tabs */}
      <div className="flex p-2 gap-1 bg-surface/60 border-b border-border/50 shrink-0">
        <button
          onClick={() => setTab('contact')}
          className={`flex-1 py-1.5 text-[12px] font-bold rounded-md transition-all ${
            tab === 'contact' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
          }`}
        >
          Contact
        </button>
        <button
          onClick={() => setTab('copilot')}
          className={`flex-1 py-1.5 text-[12px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
            tab === 'copilot' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
          }`}
        >
          <span>✨</span> Copilot
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {tab === 'contact' && (
          <>
            {/* Contact profile */}
            <div className="p-4 border-b border-border/40">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-surface-hover border border-border flex items-center justify-center text-text-main font-bold overflow-hidden shrink-0 shadow-xs">
                  {contact?.avatarUrl
                    ? <img src={contact.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    : displayName[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-bold text-text-main leading-tight truncate">{displayName}</h3>
                  {conv.channel === 'email' && contact?.email && (
                    <p className="text-[11px] text-text-muted mt-0.5 truncate">{contact.email}</p>
                  )}
                  {conv.channel === 'sms' && contact?.phone && (
                    <p className="text-[11px] text-text-muted mt-0.5 truncate">{contact.phone}</p>
                  )}
                </div>
              </div>
              {contact?.id && (
                <button
                  onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                  className="w-full py-1.5 text-[12px] font-semibold text-primary border border-primary/30 rounded-lg flex items-center justify-center gap-1.5 hover:bg-primary/10 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View Contact Record
                </button>
              )}
            </div>

            {/* Tags */}
            <Accordion title="Tags" defaultOpen>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-surface text-text-main rounded-md border border-border">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="text-text-muted hover:text-red-400 transition-colors ml-0.5">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTag(tagInput); }}
                  placeholder="Add tag…"
                  className="flex-1 bg-surface-hover border border-border text-text-main text-[12px] px-2.5 py-1 rounded-lg focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => addTag(tagInput)}
                  className="px-2 py-1 bg-surface-hover hover:bg-surface border border-border text-text-muted hover:text-text-main rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </Accordion>

            {/* Conversation actions */}
            <Accordion title="Conversation Actions" defaultOpen>
              <div className="space-y-3">
                {/* Assignee */}
                <div>
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Assignee</p>
                  <select
                    value={conv.assignedUserId ?? ''}
                    onChange={e => patch.mutate({ assignedUserId: e.target.value || null })}
                    className="w-full bg-surface-hover border border-border text-text-main text-[12px] px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-primary"
                  >
                    <option value="">Unassigned</option>
                    {conv.assignedUser && (
                      <option value={conv.assignedUser.id}>{conv.assignedUser.name}</option>
                    )}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Priority</p>
                  <select
                    value={conv.priority ?? ''}
                    onChange={e => patch.mutate({ priority: (e.target.value || undefined) as any })}
                    className="w-full bg-surface-hover border border-border text-text-main text-[12px] px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-primary"
                  >
                    <option value="">None</option>
                    {PRIORITY_OPTIONS.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Accordion>

            {/* Contact details */}
            <Accordion title="Contact Information">
              {contact ? (
                <div className="space-y-2 text-[12px] text-text-muted">
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted w-4">✉</span>
                      <span className="truncate text-text-main">{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted w-4">📞</span>
                      <span className="text-text-main">{contact.phone}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[12px] text-text-muted italic">No contact linked</p>
              )}
            </Accordion>

            {/* Conversation info */}
            <Accordion title="Conversation Info">
              <div className="space-y-2 text-[12px] text-text-muted">
                <div className="flex justify-between"><span className="text-text-muted">Channel</span><span className="capitalize text-text-main font-medium">{conv.channel}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Status</span><span className="capitalize text-text-main font-medium">{conv.status}</span></div>
                {conv.createdAt && (
                  <div className="flex justify-between"><span className="text-text-muted">Created</span><span className="text-text-main font-medium">{new Date(conv.createdAt).toLocaleDateString()}</span></div>
                )}
                {conv.starred && (
                  <div className="flex justify-between"><span className="text-text-muted">Starred</span><span className="text-text-main font-medium">Yes</span></div>
                )}
              </div>
            </Accordion>
          </>
        )}

        {tab === 'copilot' && (
          <div className="p-6 text-center">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-primary/20 shadow-sm">
              <span className="text-2xl">✨</span>
            </div>
            <h3 className="text-[14px] font-bold text-text-main mb-1.5">Stone AI Copilot</h3>
            <p className="text-[12px] text-text-muted mb-5 leading-relaxed">
              Summarize conversations and generate suggested responses tailored to this customer.
            </p>
            <button className="btn-primary w-full py-2 text-[12px]">
              Generate Draft
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
