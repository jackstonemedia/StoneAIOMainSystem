import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, BellOff, Wand2 } from 'lucide-react';
import { useAdAccounts, useInitAdOAuth, useDisconnectAdAccount } from '../../hooks/useAdAccounts';
import { useAdSettings, useUpdateAdSettings } from '../../hooks/useAdSettings';
import AdAccountCard from '../../components/ads/AdAccountCard';

export default function AdsSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: accounts = [], isLoading: isLoadingAccounts } = useAdAccounts();
  const { data: settings, isLoading: isLoadingSettings } = useAdSettings();
  
  const { mutate: initOAuth, isPending: isOAuthPending } = useInitAdOAuth();
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnectAdAccount();
  const { mutate: updateSettings } = useUpdateAdSettings();

  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifMode, setNotifMode] = useState('IN_APP');
  const [aiEnabled, setAiEnabled] = useState(true);

  useEffect(() => {
    if (settings) {
      setNotifEnabled(settings.leadNotificationsEnabled);
      setNotifMode(settings.leadNotificationMode);
      setAiEnabled(settings.aiAssistedCreativeDefault);
    }
  }, [settings]);

  // Handle OAuth query params
  useEffect(() => {
    const error = searchParams.get('oauth_error');
    if (error) {
      alert(`OAuth Error: ${error}`);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleSaveSettings = (updates: any) => {
    updateSettings(updates);
  };

  if (isLoadingAccounts || isLoadingSettings) {
    return <div className="p-8 text-center text-text-muted animate-pulse">Loading settings...</div>;
  }

  const googleAccount = accounts.find(a => a.platform === 'GOOGLE');
  const fbAccount = accounts.find(a => a.platform === 'FACEBOOK');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h2 className="text-xl font-bold text-text-main">Connected Accounts</h2>
        <p className="text-sm text-text-muted mt-1">Connect your ad platforms to launch campaigns and track performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {googleAccount && googleAccount.status !== 'DISCONNECTED' ? (
          <AdAccountCard account={googleAccount} onDisconnect={disconnect} isDisconnecting={isDisconnecting} />
        ) : (
          <div className="p-6 border border-border border-dashed rounded-xl flex flex-col items-center justify-center text-center space-y-4 bg-surface/50 hover:bg-surface transition-colors">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 font-bold text-xl">G</div>
            <div>
              <h3 className="font-semibold text-text-main">Google Ads</h3>
              <p className="text-sm text-text-muted mt-1">Connect to launch search and display ads.</p>
            </div>
            <button 
              onClick={() => initOAuth('google')}
              disabled={isOAuthPending}
              className="px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-border/50 transition-colors"
            >
              {isOAuthPending ? 'Connecting...' : 'Connect Google'}
            </button>
          </div>
        )}

        {fbAccount && fbAccount.status !== 'DISCONNECTED' ? (
          <AdAccountCard account={fbAccount} onDisconnect={disconnect} isDisconnecting={isDisconnecting} />
        ) : (
          <div className="p-6 border border-border border-dashed rounded-xl flex flex-col items-center justify-center text-center space-y-4 bg-surface/50 hover:bg-surface transition-colors">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-xl">f</div>
            <div>
              <h3 className="font-semibold text-text-main">Meta Ads</h3>
              <p className="text-sm text-text-muted mt-1">Connect to launch Facebook and Instagram ads.</p>
            </div>
            <button 
              onClick={() => initOAuth('facebook')}
              disabled={isOAuthPending}
              className="px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-border/50 transition-colors"
            >
              {isOAuthPending ? 'Connecting...' : 'Connect Meta'}
            </button>
          </div>
        )}
      </div>

      <hr className="border-border" />

      <div>
        <h2 className="text-xl font-bold text-text-main mb-6">Preferences</h2>
        
        <div className="space-y-6">
          <div className="p-5 border border-border rounded-xl bg-surface flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className={`p-2.5 rounded-lg ${notifEnabled ? 'bg-primary/10 text-primary' : 'bg-background text-text-muted'}`}>
                {notifEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-medium text-text-main">Lead Notifications</h4>
                <p className="text-sm text-text-muted mt-1">Receive alerts when new ad leads are captured.</p>
                {notifEnabled && (
                  <select 
                    value={notifMode}
                    onChange={(e) => { 
                      setNotifMode(e.target.value); 
                      handleSaveSettings({ leadNotificationMode: e.target.value }); 
                    }}
                    className="mt-3 bg-background border border-border rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="IN_APP">In-App Only</option>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="ALL">All Channels</option>
                  </select>
                )}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mt-2">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={notifEnabled} 
                onChange={(e) => { 
                  setNotifEnabled(e.target.checked); 
                  handleSaveSettings({ leadNotificationsEnabled: e.target.checked }); 
                }} 
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="p-5 border border-border rounded-xl bg-surface flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className={`p-2.5 rounded-lg ${aiEnabled ? 'bg-purple-500/10 text-purple-500' : 'bg-background text-text-muted'}`}>
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-medium text-text-main">AI Assisted Creative</h4>
                <p className="text-sm text-text-muted mt-1">Default to using Gemini AI for ad copy generation.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mt-2">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={aiEnabled} 
                onChange={(e) => { 
                  setAiEnabled(e.target.checked); 
                  handleSaveSettings({ aiAssistedCreativeDefault: e.target.checked }); 
                }} 
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
