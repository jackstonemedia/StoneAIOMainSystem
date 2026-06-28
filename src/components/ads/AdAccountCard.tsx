import { AlertCircle, CheckCircle2, RefreshCw, Unplug } from 'lucide-react';
import type { AdAccount } from '../../types/ads';

interface AdAccountCardProps {
  account: AdAccount;
  onDisconnect: (platform: string) => void;
  isDisconnecting?: boolean;
}

export default function AdAccountCard({ account, onDisconnect, isDisconnecting }: AdAccountCardProps) {
  const isGoogle = account.platform === 'GOOGLE';
  
  return (
    <div className="p-5 border border-border rounded-xl bg-surface">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${isGoogle ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
            {isGoogle ? <span className="font-bold text-lg">G</span> : <span className="font-bold text-lg">f</span>}
          </div>
          <div>
            <h3 className="font-semibold text-text-main">{isGoogle ? 'Google Ads' : 'Meta Ads'}</h3>
            <p className="text-sm text-text-muted">{account.accountName || 'Unknown Account'}</p>
          </div>
        </div>
        
        <button 
          onClick={() => onDisconnect(account.platform)}
          disabled={isDisconnecting}
          className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Disconnect Account"
        >
          {isDisconnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />}
        </button>
      </div>

      <div className="mt-5 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Status</span>
          {account.status === 'ACTIVE' ? (
            <span className="flex items-center gap-1.5 text-green-500 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Active
            </span>
          ) : account.status === 'NEEDS_ATTENTION' ? (
            <span className="flex items-center gap-1.5 text-amber-500 font-medium">
              <AlertCircle className="w-4 h-4" /> Needs Attention
            </span>
          ) : (
            <span className="text-text-muted">Disconnected</span>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Account ID</span>
          <span className="font-mono text-text-main">{account.externalAccountId || '—'}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Last Sync</span>
          <span className="text-text-main text-xs">
            {(account as any).isSyncing ? (
              <span className="flex items-center gap-1.5 text-primary">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Syncing metrics...
              </span>
            ) : (account as any).lastSyncedAt ? (
              <span>
                {new Date((account as any).lastSyncedAt).toLocaleString()}
              </span>
            ) : (
              'Never'
            )}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Connected</span>
          <span className="text-text-main">
            {account.connectedAt ? new Date(account.connectedAt).toLocaleDateString() : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
