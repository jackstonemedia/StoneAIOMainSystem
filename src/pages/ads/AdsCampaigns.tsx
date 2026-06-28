import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, List, Filter, ChevronDown, Search, Download, Plus, Settings } from 'lucide-react';
import { useAdCampaigns, usePauseCampaign, useResumeCampaign, useDuplicateCampaign, useDeleteCampaign, useBulkCampaignAction } from '../../hooks/useAdCampaigns';
import { useAdAccounts } from '../../hooks/useAdAccounts';
import CampaignTable from '../../components/ads/CampaignTable';


export default function AdsCampaigns() {
  const navigate  = useNavigate();
  const { data: accounts = [] } = useAdAccounts();
  const { data: rawCampaigns = [], isLoading, refetch } = useAdCampaigns();

  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'ALL' | 'GOOGLE' | 'FACEBOOK'>('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  const { mutate: pause }     = usePauseCampaign();
  const { mutate: resume }    = useResumeCampaign();
  const { mutate: duplicate } = useDuplicateCampaign();
  const { mutate: remove }    = useDeleteCampaign();
  const { mutate: bulk }      = useBulkCampaignAction();

  const campaigns = rawCampaigns as any[];

  const googleConnected = accounts.some(a => a.platform === 'GOOGLE' && a.status === 'ACTIVE');
  const fbConnected     = accounts.some(a => a.platform === 'FACEBOOK' && a.status === 'ACTIVE');
  const neitherConnected = !googleConnected && !fbConnected;

  return (
    <div className="flex flex-col h-full w-full relative bg-bg">

      {/* ── Unified Toolbar ────────────────────────────────────────────────── */}
      <div className="px-8 flex items-center justify-between border-b border-border bg-surface relative shadow-[0_4px_16px_rgba(0,0,0,0.03)] h-[73px]">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {/* All tab */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer border transition-colors text-[13px] font-medium text-text-main bg-surface-hover border-border">
              <List className="w-3.5 h-3.5 text-primary" />
              <span>All Campaigns</span>
            </div>

            <div className="w-[1px] h-5 bg-border mx-2"></div>

            <button onClick={() => setFilterDropdownOpen(!filterDropdownOpen)} className="btn-secondary">
              <Filter className="w-4 h-4" /> Advanced filters
            </button>
            
            <div className="relative">
              <button className="btn-secondary">
                <ChevronDown className="w-4 h-4" /> Sort
              </button>
            </div>
            
            {filterDropdownOpen && (
              <div className="absolute top-[60px] left-[150px] z-50 bg-surface border border-border shadow-xl rounded-xl p-4 w-[280px]">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">Quick Filters</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-[12px] font-medium text-text-muted mb-1.5 block">Platform</label>
                    <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value as any)} className="w-full bg-background border border-border rounded-lg px-2.5 h-8 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="ALL">All Platforms</option>
                      <option value="GOOGLE">Google Ads</option>
                      <option value="FACEBOOK">Meta Ads</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-text-muted mb-1.5 block">Status</label>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full bg-background border border-border rounded-lg px-2.5 h-8 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="ALL">All Statuses</option>
                      <option value="ACTIVE">Active</option>
                      <option value="PAUSED">Paused</option>
                      <option value="DRAFT">Draft</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative shadow-sm rounded-full flex items-center mr-2">
              <Search className="w-4 h-4 absolute left-3 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search Campaigns" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 w-[200px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
              />
            </div>
            
            <button className="btn-secondary">
              <Download className="w-4 h-4" /> Import
            </button>
            
            <div className="relative flex items-center gap-1">
              <button
                onClick={() => navigate('/ads/campaigns/new')}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" /> Add Campaign
              </button>
            </div>

            <div className="w-[1px] h-5 bg-border mx-1"></div>

            <div className="relative flex items-center gap-2">
              <button className="btn-secondary">
                <Settings className="w-4 h-4" /> Manage fields
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── No accounts banner ───────────────────────────────────────────── */}
      {neitherConnected && (
        <div className="shrink-0 mx-8 mt-6 flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl shadow-sm backdrop-blur-md relative z-10">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-text-main">No ad accounts connected</p>
            <p className="text-[12px] text-text-muted mt-0.5">
              Connect Google Ads or Meta Ads in{' '}
              <button onClick={() => navigate('/ads/settings')} className="text-primary underline underline-offset-2 hover:text-primary/80">
                Settings
              </button>{' '}
              to start creating and managing campaigns.
            </p>
          </div>
        </div>
      )}

      {/* ── Content Rendering ──────────────────────────────────────────── */}
      <CampaignTable
          campaigns={campaigns}
          isLoading={isLoading}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          platformFilter={platformFilter}
          onPause={id => pause(id)}
          onResume={id => resume(id)}
          onDuplicate={id => duplicate(id)}
          onDelete={id => {
            if (confirm('Delete this campaign? Active campaigns will be paused on the platform first. This can\'t be undone.')) {
              remove(id);
            }
          }}
          onBulkPause={ids => bulk({ action: 'pause', ids })}
          onBulkResume={ids => bulk({ action: 'resume', ids })}
          onBulkDelete={ids => bulk({ action: 'delete', ids })}
        />
    </div>
  );
}
