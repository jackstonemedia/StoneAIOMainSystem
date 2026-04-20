import { useState } from 'react';
import { Settings, Users, Database, Bell, Shield, Webhook, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type SectionId = 'general' | 'users' | 'data' | 'notifications' | 'security' | 'integrations';

interface Section {
  id: SectionId;
  title: string;
  icon: any;
  description: string;
  available: boolean;
}

const sections: Section[] = [
  { id: 'general',        title: 'General',         icon: Settings,   description: 'Basic CRM settings and preferences.',      available: true  },
  { id: 'users',          title: 'Users & Teams',   icon: Users,      description: 'Manage team access and role permissions.',  available: true  },
  { id: 'data',           title: 'Data Management', icon: Database,   description: 'Import, export, and manage custom fields.', available: true  },
  { id: 'notifications',  title: 'Notifications',   icon: Bell,       description: 'Configure email and in-app alerts.',        available: true  },
  { id: 'security',       title: 'Security',        icon: Shield,     description: 'Permissions, audit logs, and 2FA.',         available: false },
  { id: 'integrations',   title: 'Integrations',    icon: Webhook,    description: 'Connect external tools and webhooks.',      available: false },
];

const SECTION_CONTENT: Record<SectionId, { fields: { label: string; type: string; defaultValue?: string; placeholder?: string }[] }> = {
  general: {
    fields: [
      { label: 'CRM Name',         type: 'text',  defaultValue: 'Stone AIO CRM' },
      { label: 'Default Currency', type: 'text',  defaultValue: 'USD ($)' },
      { label: 'Fiscal Year Start',type: 'text',  defaultValue: 'January' },
      { label: 'Deal Stage Labels',type: 'text',  defaultValue: 'Won / Lost' },
    ],
  },
  users: {
    fields: [
      { label: 'Admin Email',  type: 'email', defaultValue: 'jack@stoneaio.com' },
      { label: 'Default Role', type: 'text',  defaultValue: 'Member' },
      { label: 'Invite Link',  type: 'text',  placeholder: 'Generate an invite…' },
    ],
  },
  data: {
    fields: [
      { label: 'Custom Field 1', type: 'text', placeholder: 'Field name…' },
      { label: 'Custom Field 2', type: 'text', placeholder: 'Field name…' },
    ],
  },
  notifications: {
    fields: [
      { label: 'Notify on new lead',   type: 'toggle', defaultValue: 'true' },
      { label: 'Notify on deal won',   type: 'toggle', defaultValue: 'true' },
      { label: 'Notify on deal lost',  type: 'toggle', defaultValue: 'false' },
      { label: 'Weekly digest email',  type: 'toggle', defaultValue: 'true' },
    ],
  },
  security: { fields: [] },
  integrations: { fields: [] },
};

export default function CrmSettings() {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const active = sections.find(s => s.id === activeSection);
  const content = activeSection ? SECTION_CONTENT[activeSection] : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-border bg-surface shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CRM Settings</h1>
          <p className="text-sm text-text-muted mt-1">Manage your CRM configuration and preferences.</p>
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
                onClick={() => section.available && setActiveSection(activeSection === section.id ? null : section.id)}
                disabled={!section.available}
                className={`text-left bg-surface border-2 rounded-xl p-5 transition-all group relative ${
                  activeSection === section.id
                    ? 'border-primary ring-1 ring-primary/20'
                    : section.available
                    ? 'border-border hover:border-primary/50 cursor-pointer'
                    : 'border-border opacity-60 cursor-not-allowed'
                }`}
              >
                {!section.available && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-hover text-text-muted border border-border">
                    Pro
                  </span>
                )}
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
                  <ChevronRight className={`w-4 h-4 text-text-muted shrink-0 mt-0.5 transition-transform ${activeSection === section.id ? 'rotate-90 text-primary' : ''}`} />
                </div>
              </button>
            ))}
          </div>

          {/* Expanded Section */}
          <AnimatePresence>
            {activeSection && content && content.fields.length > 0 && (
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
                  {content.fields.map((field, i) => (
                    <div key={i}>
                      <label className="block text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                        {field.label}
                      </label>
                      {field.type === 'toggle' ? (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked={field.defaultValue === 'true'} className="sr-only peer" />
                          <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-surface after:rounded-full after:h-4 after:w-4 after:transition-all" />
                        </label>
                      ) : (
                        <input
                          type={field.type}
                          defaultValue={field.defaultValue}
                          placeholder={field.placeholder}
                          className="w-full px-3.5 py-2.5 bg-surface-hover border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-border flex justify-end">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-5 py-2 rounded-[8px] text-[13px] font-semibold text-white transition-all"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    {saved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Changes'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
