import { useState, useEffect } from 'react';
import { Mail, MessageSquareText, Plus, Search, Filter, Trash2, Edit2, BarChart2 } from 'lucide-react';
import { db, StorageKey } from '../../lib/storage';
import { useLocation, useNavigate } from 'react-router-dom';
import { EmailCampaignRecord } from '../../types/emailCampaign';
import { calcRate } from '../../lib/emailCampaignUtils';
import { useToast } from '../../components/ui/Toast';

export default function Campaigns() {
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email');
  const [search, setSearch] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const { toast } = useToast();
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'email' || tab === 'sms') setActiveTab(tab);
  }, [location.search]);

  useEffect(() => {
    fetchCampaigns();
  }, [activeTab]);

  const fetchCampaigns = async () => {
    if (activeTab === 'email') {
      const data = await db.get<EmailCampaignRecord>(StorageKey.EMAIL_CAMPAIGNS);
      setCampaigns(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } else {
      const data = await db.get<any>(StorageKey.SMS_CAMPAIGNS);
      setCampaigns(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }
  };

  const handleCreate = () => {
    if (activeTab === 'email') {
      navigate('/marketing/email/new');
    } else {
      createSmsCampaign();
    }
  };

  const createSmsCampaign = async () => {
    await db.insert(StorageKey.SMS_CAMPAIGNS, {
      name: 'New SMS Campaign',
      content: 'Hello from Stone AIO',
      status: 'draft'
    });
    fetchCampaigns();
  };

  const deleteCampaign = async (id: string) => {
    const key = activeTab === 'email' ? StorageKey.EMAIL_CAMPAIGNS : StorageKey.SMS_CAMPAIGNS;
    await db.delete(key, id);
    toast('success', 'Campaign deleted');
    fetchCampaigns();
  };

  const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      <div className="px-6 py-6 border-b border-[var(--border)] flex items-center justify-between shrink-0 bg-[var(--surface)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Campaigns</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Manage your email and SMS marketing.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Create {activeTab === 'email' ? 'Email' : 'SMS'}
        </button>
      </div>

      <div className="flex items-center gap-6 px-6 border-b border-[var(--border)] bg-[var(--surface)]">
        <button
          onClick={() => { setActiveTab('email'); navigate('?tab=email', { replace: true }); }}
          className={`flex items-center gap-2 px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'email' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Mail className="w-4 h-4" /> Email Campaigns
        </button>
        <button
          onClick={() => { setActiveTab('sms'); navigate('?tab=sms', { replace: true }); }}
          className={`flex items-center gap-2 px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'sms' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <MessageSquareText className="w-4 h-4" /> SMS Campaigns
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input 
              type="text"
              placeholder={`Search ${activeTab} campaigns...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm outline-none text-[var(--text-main)] focus:border-primary transition-colors"
            />
          </div>
          <button className="p-2 border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(campaign => (
            <div 
              key={campaign.id} 
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:border-primary/50 transition-colors group flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-[var(--text-main)] truncate pr-4">{campaign.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      campaign.status === 'draft' ? 'bg-black/10 text-[var(--text-muted)]' :
                      campaign.status === 'sent' ? 'bg-green-500/10 text-green-500' :
                      campaign.status === 'scheduled' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-purple-500/10 text-purple-500'
                    }`}>
                      {campaign.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {activeTab === 'email' && campaign.status === 'sent' && (
                     <button 
                       onClick={() => navigate(`/marketing/email/${campaign.id}/analytics`)}
                       className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] rounded"
                       title="View Analytics"
                     >
                       <BarChart2 className="w-4 h-4" />
                     </button>
                  )}
                  {activeTab === 'email' && campaign.status !== 'sent' && (
                    <button 
                      onClick={() => navigate(`/marketing/email/${campaign.id}/edit`)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] rounded"
                      title="Edit Campaign"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => deleteCampaign(campaign.id)}
                    className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"
                    title="Delete Campaign"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-auto pt-4 border-t border-[var(--border)]">
                {activeTab === 'email' ? (
                  <>
                    <div>
                      <div className="text-xs text-[var(--text-muted)] mb-1">Open Rate</div>
                      <div className="font-semibold text-[var(--text-main)]">
                        {campaign.status === 'sent' && campaign.stats ? calcRate(campaign.stats.opened, campaign.stats.delivered) : '--'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)] mb-1">Click Rate</div>
                      <div className="font-semibold text-[var(--text-main)]">
                        {campaign.status === 'sent' && campaign.stats ? calcRate(campaign.stats.clicked, campaign.stats.delivered) : '--'}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-xs text-[var(--text-muted)] mb-1">Open Rate</div>
                      <div className="font-semibold text-[var(--text-main)]">{campaign.status === 'sent' ? '24.5%' : '--'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)] mb-1">Click Rate</div>
                      <div className="font-semibold text-[var(--text-main)]">{campaign.status === 'sent' ? '3.2%' : '--'}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-[var(--text-muted)]">
              No {activeTab} campaigns found. 
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
