import { useState } from 'react';
import { User, Palette, Bell, Key, Users, Shield, Save, Check } from 'lucide-react';
import { useTheme, type ThemeName } from '../lib/ThemeContext';

export default function SettingsPage() {
  const { theme, setTheme, themes } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'api', name: 'API Keys', icon: Key },
    { id: 'team', name: 'Team', icon: Users },
    { id: 'security', name: 'Security', icon: Shield },
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Settings Sidebar */}
      <div className="w-56 border-r border-border bg-surface/30 p-4 flex flex-col gap-1 overflow-y-auto shrink-0">
        <h2 className="text-lg font-bold px-3 mb-4">Settings</h2>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
              activeTab === tab.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="animate-fade-up space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">Profile</h2>
                <p className="text-sm text-text-muted">Manage your personal information.</p>
              </div>

              <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">J</div>
                  <div>
                    <button className="text-sm font-medium text-primary hover:underline">Change avatar</button>
                    <p className="text-xs text-text-muted mt-1">JPG, PNG or GIF. Max 2MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">First Name</label>
                    <input type="text" defaultValue="Jack" className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Last Name</label>
                    <input type="text" defaultValue="Stone" className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input type="email" defaultValue="jack@stoneaio.com" className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Company</label>
                  <input type="text" defaultValue="Stone AIO" className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                </div>
              </div>

              <button onClick={handleSave} className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-all flex items-center gap-2">
                {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="animate-fade-up space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">Appearance</h2>
                <p className="text-sm text-text-muted">Customize how Stone AIO looks for you.</p>
              </div>

              <div className="bg-surface border border-border rounded-xl p-6">
                <h3 className="text-sm font-semibold mb-4">Theme</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        theme === t.id ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-text-muted'
                      }`}
                    >
                      {/* Theme Preview */}
                      <div className="flex gap-1 mb-3">
                        <div className="w-full h-16 rounded-lg overflow-hidden flex" style={{ background: t.preview.bg }}>
                          <div className="w-1/4 h-full" style={{ background: t.preview.surface }} />
                          <div className="flex-1 p-2">
                            <div className="h-2 rounded-full w-3/4 mb-1.5" style={{ background: t.preview.primary, opacity: 0.7 }} />
                            <div className="h-1.5 rounded-full w-1/2" style={{ background: t.preview.accent, opacity: 0.5 }} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{t.name}</span>
                        {theme === t.id && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="animate-fade-up space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">Notifications</h2>
                <p className="text-sm text-text-muted">Configure how you receive notifications.</p>
              </div>

              <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
                {[
                  { title: 'Agent Run Completed', desc: 'Get notified when an agent finishes a run.' },
                  { title: 'Agent Errors', desc: 'Alert when an agent encounters an error.' },
                  { title: 'Credit Usage Alerts', desc: 'Notify when credits are running low.' },
                  { title: 'Weekly Summary', desc: 'A weekly digest of your agent activity.' },
                  { title: 'Product Updates', desc: 'New features and announcements.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div>
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className="text-xs text-text-muted">{item.desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={i < 3} className="sr-only peer" />
                      <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api' && (
            <div className="animate-fade-up space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">API Keys</h2>
                <p className="text-sm text-text-muted">Manage keys for external integrations.</p>
              </div>

              <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">OpenAI API Key</label>
                  <input type="password" placeholder="sk-..." defaultValue="sk-xxxxxxxxxxxx" className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">ElevenLabs API Key</label>
                  <input type="password" placeholder="xi-..." className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Google AI API Key</label>
                  <input type="password" placeholder="AIza..." className="w-full px-4 py-2.5 rounded-lg border border-border bg-bg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono" />
                </div>
              </div>

              <button onClick={handleSave} className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-all flex items-center gap-2">
                {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Keys</>}
              </button>
            </div>
          )}

          {/* Team & Security stubs */}
          {(activeTab === 'team' || activeTab === 'security') && (
            <div className="animate-fade-up space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-1">{activeTab === 'team' ? 'Team Management' : 'Security'}</h2>
                <p className="text-sm text-text-muted">{activeTab === 'team' ? 'Manage workspace members and roles.' : 'Manage security settings and sessions.'}</p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-12 text-center">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  {activeTab === 'team' ? <Users className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                </div>
                <p className="text-text-muted text-sm">Available on the Team plan and above.</p>
                <button className="mt-4 bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-all">
                  Upgrade to Team
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
