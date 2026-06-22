import { useState } from 'react';
import { Play, Pause, Copy, Trash2, Search, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AdCampaign } from '../../types/ads';
import { formatCurrency } from '../../lib/utils';

interface CampaignListProps {
  campaigns: AdCampaign[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export default function CampaignList({ campaigns, onPause, onResume, onDuplicate, onDelete, isLoading }: CampaignListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  
  const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) {
    return <div className="p-8 text-center text-text-muted animate-pulse">Loading campaigns...</div>;
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-text-main bg-background border border-border rounded-lg hover:bg-border/50">
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-background/50 border-b border-border text-text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Campaign Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium text-right">Spend (30d)</th>
              <th className="px-4 py-3 font-medium text-right">Leads (30d)</th>
              <th className="px-4 py-3 font-medium text-right">Cost/Lead</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                  No campaigns found.
                </td>
              </tr>
            ) : (
              filtered.map(campaign => {
                const cpl = campaign.cachedLeads30d ? campaign.cachedSpend30dCents / campaign.cachedLeads30d : null;
                return (
                  <tr key={campaign.id} className="hover:bg-background/30 transition-colors group cursor-pointer" onClick={() => navigate(`/ads/campaigns/${campaign.id}`)}>
                    <td className="px-4 py-3 font-medium text-text-main">{campaign.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        campaign.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' :
                        campaign.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-500' :
                        campaign.status === 'DRAFT' ? 'bg-gray-500/10 text-gray-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${campaign.platform === 'GOOGLE' ? 'bg-red-500' : 'bg-blue-500'}`} />
                        {campaign.platform === 'GOOGLE' ? 'Google' : 'Meta'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(campaign.cachedSpend30dCents / 100)}</td>
                    <td className="px-4 py-3 text-right font-medium">{campaign.cachedLeads30d}</td>
                    <td className="px-4 py-3 text-right text-text-muted">
                      {cpl ? formatCurrency(cpl / 100) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        {campaign.status === 'ACTIVE' ? (
                          <button onClick={() => onPause(campaign.id)} className="p-1.5 text-text-muted hover:text-amber-500 hover:bg-amber-500/10 rounded" title="Pause">
                            <Pause className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => onResume(campaign.id)} className="p-1.5 text-text-muted hover:text-green-500 hover:bg-green-500/10 rounded" title="Resume" disabled={campaign.status === 'DRAFT'}>
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => onDuplicate(campaign.id)} className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded" title="Duplicate">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDelete(campaign.id)} className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
