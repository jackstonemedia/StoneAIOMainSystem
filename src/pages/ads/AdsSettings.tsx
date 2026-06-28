import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, BellOff, Wand2 } from 'lucide-react';
import { useAdAccounts, useInitAdOAuth, useDisconnectAdAccount, useCompleteAdOAuth } from '../../hooks/useAdAccounts';
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
  const { mutate: completeOAuth, isPending: isCompletingOAuth } = useCompleteAdOAuth();
  const [oauthPicker, setOauthPicker] = useState<{ platform: string; accounts: any[]; tokens: any; pages?: any[] } | null>(null);

  useEffect(() => {
    const error = searchParams.get('oauth_error');
    if (error) {
      alert(`OAuth Error: ${error}`);
      setSearchParams({});
    }
    const step = searchParams.get('oauth_step');
    if (step === 'pick_account') {
      const platform = searchParams.get('platform');
      const accountsStr = searchParams.get('accounts');
      const tokensStr = searchParams.get('tokens');
      const pagesStr = searchParams.get('pages');
      if (platform && accountsStr && tokensStr) {
        setOauthPicker({
          platform,
          accounts: JSON.parse(accountsStr),
          tokens: JSON.parse(tokensStr),
          pages: pagesStr ? JSON.parse(pagesStr) : undefined,
        });
      }
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

      {oauthPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-main">Select {oauthPicker.platform === 'google' ? 'Google' : 'Facebook'} Ad Account</h3>
            <p className="text-sm text-text-muted">Choose the ad account you want to connect to StoneAIO.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {oauthPicker.accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => {
                    completeOAuth({
                      platform: oauthPicker.platform as 'google' | 'facebook',
                      tokens: oauthPicker.tokens,
                      accountId: acc.id,
                      accountName: acc.name,
                      pages: oauthPicker.pages,
                    }, {
                      onSuccess: () => setOauthPicker(null)
                    });
                  }}
                  disabled={isCompletingOAuth}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-border/50 transition-colors flex flex-col"
                >
                  <span className="font-medium text-text-main">{acc.name}</span>
                  <span className="text-xs text-text-muted">ID: {acc.id}</span>
                </button>
              ))}
              {oauthPicker.accounts.length === 0 && (
                <div className="p-4 text-center text-sm text-text-muted border border-dashed border-border rounded-lg">
                  No ad accounts found.
                </div>
              )}
            </div>
            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setOauthPicker(null)}
                className="px-4 py-2 text-sm text-text-muted hover:text-text-main transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
