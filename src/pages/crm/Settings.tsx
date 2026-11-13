import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Settings, Users, Database, Bell, Shield, Webhook, ChevronRight, Check, Tag, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TagsSettings } from './TagsSettings';
import { apiFetch } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';

type SectionId = 'general' | 'users' | 'data' | 'tags' | 'notifications' | 'security' | 'integrations';

interface Section {
  id: SectionId;
  title: string;
  icon: any;
  description: string;
  /** Real destination for sections that live elsewhere (no fake "Pro" gate). */
  link?: string;
}

const sections: Section[] = [
  { id: 'general',        title: 'General',         icon: Settings,   description: 'Basic CRM settings and preferences.' },
  { id: 'users',          title: 'Users & Teams',   icon: Users,      description: 'Manage team access and role permissions.' },
  { id: 'data',           title: 'Data Management', icon: Database,   description: 'Import, export, and manage custom fields.' },
  { id: 'tags',           title: 'Tag Management',  icon: Tag,        description: 'Rename, delete, and merge contact tags.' },
  { id: 'notifications',  title: 'Notifications',   icon: Bell,       description: 'Configure email and in-app alerts.' },
  // Security and Integrations live in global Settings — these cards link
  // there instead of showing a "Pro" badge for a plan gate that doesn't exist.
  { id: 'security',       title: 'Security',        icon: Shield,     description: 'Permissions, audit logs, and 2FA.',         link: '/settings?tab=security' },
  { id: 'integrations',   title: 'Integrations',    icon: Webhook,    description: 'Connect external tools and webhooks.',      link: '/settings?tab=integrations' },
];

interface FieldDef {
  key: string;
  label: string;
  type: string;
  placeholder?: string;
}

const SECTION_CONTENT: Record<SectionId, { fields: FieldDef[] }> = {
  general: {
    fields: [
      { key: 'crmName',         label: 'CRM Name',         type: 'text', placeholder: 'CRM name…' },
      { key: 'defaultCurrency', label: 'Default Currency', type: 'text', placeholder: 'Currency…' },
      { key: 'fiscalYearStart', label: 'Fiscal Year Start',type: 'text', placeholder: 'Month…' },
      { key: 'dealStageLabels', label: 'Deal Stage Labels',type: 'text', placeholder: 'Labels…' },
    ],
  },
  users: {
    fields: [
      { key: 'adminEmail',  label: 'Admin Email',  type: 'email', placeholder: 'Admin email…' },
      { key: 'defaultRole', label: 'Default Role', type: 'text',  placeholder: 'Role…' },
      // No Invite Link field: invites are created in Settings → Team, not stored here.
    ],
  },
  data: { fields: [] },
  tags: { fields: [] },
  notifications: {
    fields: [
      { key: 'notifyNewLead',   label: 'Notify on new lead',   type: 'toggle' },
      { key: 'notifyDealWon',   label: 'Notify on deal won',   type: 'toggle' },
      { key: 'notifyDealLost',  label: 'Notify on deal lost',  type: 'toggle' },
      { key: 'weeklyDigest',    label: 'Weekly digest email',  type: 'toggle' },
    ],
  },
  security: { fields: [] },
  integrations: { fields: [] },
};

type SettingsForm = Record<string, string | boolean>;

export default function CrmSettings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsForm>({});

  // Load the saved row (blanks when the workspace has never saved).
  const { data: settings, isLoading: settingsLoading } = useQuery<any>({
    queryKey: ['crm_settings'],
    queryFn: () => apiFetch('/api/crm/settings').then(r => r.json()),
  });

  useEffect(() => {
    if (!settings) return;
    const next: SettingsForm = {};
    for (const section of Object.values(SECTION_CONTENT)) {
      for (const f of section.fields) {
        const v = settings[f.key];
        next[f.key] = f.type === 'toggle' ? Boolean(v) : (typeof v === 'string' ? v : '');
      }
    }
    setForm(next);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch('/api/crm/settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Save failed');
      }
      await qc.invalidateQueries({ queryKey: ['crm_settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setSaveError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const active = sections.find(s => s.id === activeSection);
  const content = activeSection ? SECTION_CONTENT[activeSection] : null;
  const showSaveButton = activeSection && activeSection !== 'tags' && activeSection !== 'data';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 border-b border-border bg-surface shrink-0 h-[68px]">
        <div>
          <h1 className="text-[20px] font-bold text-text-main">CRM Settings</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Manage your CRM configuration and preferences.</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => {
                  if (section.link) { navigate(section.link); return; }
                  setActiveSection(activeSection === section.id ? null : section.id);
                }}
                className={`text-left bg-surface border-2 rounded-xl p-5 transition-all group relative ${
                  activeSection === section.id
                    ? 'border-primary ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/50 cursor-pointer'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-bg border border-border group-hover:bg-primary/5 group-hover:border-primary/20'
                  }`}>
                    <section.icon className={`w-5 h-5 transition-colors ${activeSection === section.id ? 'text-primary' : 'text-text-muted group-hover:text-primary'}`} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h3 className={`font-semibold mb-1 transition-colors ${activeSection === section.id ? 'text-primary' : 'group-hover:text-primary'}`}>
                      {section.title}
                    </h3>
                    <p className="text-sm text-text-muted">{section.description}</p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-text-muted shrink-0 mt-0.5 transition-transform ${activeSection === section.id ? 'rotate-90 text-primary' : ''}`} />
              </button>
            ))}
          </div>

          {/* Expanded Section */}
          <AnimatePresence>
            {activeSection && content && (content.fields.length > 0 || activeSection === 'tags' || activeSection === 'data') && (
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="mt-6 bg-surface border border-border rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[15px] font-bold text-text-main">{active?.title} Settings</h2>
                </div>

                <div className="space-y-4">
                  {activeSection === 'tags' ? (
                    <TagsSettings />
                  ) : activeSection === 'data' ? (
                    <CustomFieldsManager />
                  ) : settingsLoading ? (
                    <p className="text-[13px] text-text-muted">Loading saved settings…</p>
                  ) : content.fields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                        {field.label}
                      </label>
                      {field.type === 'toggle' ? (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(form[field.key])}
                            onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-surface after:rounded-full after:h-4 after:w-4 after:transition-all" />
                        </label>
                      ) : (
                        <input
                          type={field.type}
                          value={typeof form[field.key] === 'string' ? form[field.key] as string : ''}
                          onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="w-full px-3.5 py-2.5 bg-surface-hover border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {showSaveButton && (
                  <div className="mt-6 pt-4 border-t border-border flex flex-col items-end gap-2">
                    {saveError && (
                      <p className="text-[12px] text-red-400">Couldn't save: {saveError}</p>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saving || settingsLoading}
                      className="flex items-center gap-2 px-5 py-2 rounded-[8px] text-[13px] font-semibold text-white transition-all disabled:opacity-40"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}

// Data Management: the real custom fields for this workspace, backed by
// /api/crm/custom-fields. The old "Custom Field 1 / 2" inputs saved nothing.
function CustomFieldsManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newLabel, setNewLabel] = useState('');

  const { data: fields = [], isLoading } = useQuery<any[]>({
    queryKey: ['crm_custom_fields'],
    queryFn: () => apiFetch('/api/crm/custom-fields?entityType=contact').then(r => r.json()),
  });

  const createField = useMutation({
    mutationFn: async (label: string) => {
      const res = await apiFetch('/api/crm/custom-fields', {
        method: 'POST',
        body: JSON.stringify({ entityType: 'contact', label, type: 'text' }),
      });
      if (!res.ok) throw new Error('Could not create the field');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm_custom_fields'] });
      setNewLabel('');
    },
    onError: () => toast('error', 'Could not create the custom field'),
  });

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/crm/custom-fields/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete the field');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm_custom_fields'] }),
    onError: () => toast('error', 'Could not delete the custom field'),
  });

  if (isLoading) return <p className="text-[13px] text-text-muted">Loading custom fields…</p>;

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-text-muted">Custom fields on your contacts. Add one here and it appears wherever contact fields are edited.</p>
      {fields.length === 0 ? (
        <div className="text-[13px] text-text-muted text-center py-6 border border-dashed border-border rounded-[8px]">
          No custom fields yet.
        </div>
      ) : (
        fields.map((f: any) => (
          <div key={f.id} className="flex items-center justify-between px-3 py-2 border border-border rounded-[8px] bg-surface-hover">
            <span className="text-[13px] font-medium text-text-main">{f.label}</span>
            <button
              onClick={() => deleteField.mutate(f.id)}
              disabled={deleteField.isPending}
              className="text-text-muted hover:text-red-400 transition-colors disabled:opacity-40"
              aria-label={`Delete ${f.label}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newLabel.trim()) createField.mutate(newLabel.trim()); }}
          placeholder="New field name…"
          className="flex-1 bg-surface border border-border text-[13px] px-3 py-2 rounded-[6px] focus:border-primary focus:outline-none"
        />
        <button
          onClick={() => { if (newLabel.trim()) createField.mutate(newLabel.trim()); }}
          disabled={!newLabel.trim() || createField.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[13px] font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Plus className="w-4 h-4" /> Add Field
        </button>
      </div>
    </div>
  );
}
