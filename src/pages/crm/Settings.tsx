import { Settings, Users, Database, Bell, Shield, Webhook } from 'lucide-react';

export default function CrmSettings() {
  const sections = [
    { id: 'general', title: 'General', icon: Settings, description: 'Basic CRM settings and preferences.' },
    { id: 'users', title: 'Users & Teams', icon: Users, description: 'Manage access and roles.' },
    { id: 'data', title: 'Data Management', icon: Database, description: 'Import, export, and custom fields.' },
    { id: 'notifications', title: 'Notifications', icon: Bell, description: 'Email and in-app alerts.' },
    { id: 'security', title: 'Security', icon: Shield, description: 'Permissions and access logs.' },
    { id: 'integrations', title: 'Integrations', icon: Webhook, description: 'Connect external tools.' },
  ];

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sections.map(section => (
              <div key={section.id} className="bg-surface border border-border rounded-xl p-6 hover:border-primary/50 transition-colors cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-bg border border-border flex items-center justify-center shrink-0 group-hover:bg-primary/5 group-hover:border-primary/20 transition-colors">
                    <section.icon className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">{section.title}</h3>
                    <p className="text-sm text-text-muted">{section.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
