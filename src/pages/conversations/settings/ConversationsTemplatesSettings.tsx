import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../../../lib/api/conversations';
import { Plus, Trash2, Loader2, Pencil, MessageSquare, Mail, X } from 'lucide-react';
import type { ConversationTemplate } from '../../../types/conversation';

const CHANNELS: { value: 'email' | 'sms' | 'both'; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'both', label: 'Both' },
];

function TemplateForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<ConversationTemplate>;
  onSave: (data: Partial<ConversationTemplate>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [channel, setChannel] = useState<'email' | 'sms' | 'both'>(initial?.channel ?? 'both');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [body, setBody] = useState(initial?.body ?? '');

  const isEmail = channel === 'email' || channel === 'both';
  const canSave = name.trim() && body.trim() && (isEmail ? subject.trim() : true);

  return (
    <div className="mb-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">
        {initial?.id ? 'Edit Template' : 'New Template'}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Follow-up, Greeting"
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Channel</label>
          <select
            value={channel}
            onChange={e => setChannel(e.target.value as any)}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {isEmail && (
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Subject</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Email subject…"
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      <div>
        <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
          Body
          <span className="ml-2 text-[11px] text-slate-400 font-normal">
            Merge fields: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-indigo-600 dark:text-indigo-400">{'{{contact.first_name}}'}</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-indigo-600 dark:text-indigo-400">{'{{contact.last_name}}'}</code>
          </span>
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={5}
          placeholder="Template body…"
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onSave({ name, channel, subject: isEmail ? subject : undefined, body })}
          disabled={!canSave || saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {initial?.id ? 'Save Changes' : 'Create Template'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-slate-600 dark:text-slate-400 rounded-lg text-[13px] font-medium hover:text-slate-900 dark:hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ConversationsTemplatesSettings() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<'all' | 'email' | 'sms' | 'both'>('all');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['conversations', 'templates'],
    queryFn: () => conversationsApi.listTemplates(),
  });

  const create = useMutation({
    mutationFn: (data: Partial<ConversationTemplate>) => conversationsApi.createTemplate(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conversations', 'templates'] }); setShowCreate(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ConversationTemplate> }) => conversationsApi.updateTemplate(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conversations', 'templates'] }); setEditId(null); },
  });

  const del = useMutation({
    mutationFn: (id: string) => conversationsApi.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations', 'templates'] }),
  });

  const filtered = templates.filter(t => channelFilter === 'all' || t.channel === channelFilter);
  const editingTemplate = templates.find(t => t.id === editId);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Templates</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Canned responses for email and SMS. Insert via "/" in the composer.</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditId(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {showCreate && (
        <TemplateForm
          onSave={data => create.mutate(data)}
          onCancel={() => setShowCreate(false)}
          saving={create.isPending}
        />
      )}
      {editId && editingTemplate && (
        <TemplateForm
          initial={editingTemplate}
          onSave={data => update.mutate({ id: editId, data })}
          onCancel={() => setEditId(null)}
          saving={update.isPending}
        />
      )}

      {/* Channel filter tabs */}
      <div className="flex items-center gap-1 mb-4">
        {(['all', 'email', 'sms', 'both'] as const).map(ch => (
          <button
            key={ch}
            onClick={() => setChannelFilter(ch)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
              channelFilter === ch
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {ch === 'all' ? 'All' : ch === 'email' ? 'Email' : ch === 'sms' ? 'SMS' : 'Both'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-slate-500">No templates yet</p>
          <p className="text-[12px] text-slate-400 mt-1">Create reusable templates to speed up your replies.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => (
            <div key={t.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-bold text-slate-900 dark:text-white">{t.name}</span>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                      t.channel === 'email' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
                        : t.channel === 'sms' ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800'
                        : 'text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}>
                      {t.channel}
                    </span>
                  </div>
                  {t.subject && (
                    <p className="text-[12px] font-semibold text-slate-600 dark:text-slate-400 truncate mb-0.5">Subject: {t.subject}</p>
                  )}
                  <p className="text-[13px] text-slate-500 line-clamp-2">{t.body}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditId(t.id)} className="p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => { if (confirm(`Delete "${t.name}"?`)) del.mutate(t.id); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
