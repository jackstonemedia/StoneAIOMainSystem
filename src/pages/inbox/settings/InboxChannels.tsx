import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '../lib/api/inbox';
import { Plus, Trash2, Copy, Check, Globe, Mail, MessageSquare, ArrowLeft, Facebook, Twitter, Instagram, Phone, Settings, Loader2 } from 'lucide-react';
import type { InboxChannel } from '../types/inbox';

const AVAILABLE_CHANNELS = [
  { id: 'live_chat', name: 'Website', description: 'Live chat widget for your website.', icon: Globe, color: 'bg-blue-500' },
  { id: 'facebook', name: 'Facebook', description: 'Connect your Facebook Page.', icon: Facebook, color: 'bg-[#1877F2]' },
  { id: 'instagram', name: 'Instagram', description: 'Connect your Instagram account.', icon: Instagram, color: 'bg-[#E4405F]' },
  { id: 'twitter', name: 'Twitter', description: 'Connect your Twitter profile.', icon: Twitter, color: 'bg-[#1DA1F2]' },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Connect WhatsApp API.', icon: Phone, color: 'bg-[#25D366]' },
  { id: 'sms', name: 'SMS', description: 'Connect Twilio for SMS.', icon: MessageSquare, color: 'bg-slate-600' },
  { id: 'email', name: 'Email', description: 'Connect your support email.', icon: Mail, color: 'bg-indigo-500' },
  { id: 'api', name: 'API', description: 'Build a custom integration.', icon: Settings, color: 'bg-slate-800' },
];

function EmbedCodeModal({ channel, onClose }: { channel: InboxChannel; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const { data } = useQuery({
    queryKey: ['inbox', 'embed', channel.id],
    queryFn: () => inboxApi.getEmbedCode(channel.id),
  });

  const code = data?.html || `<!-- Loading... -->`;

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Embed Code for {channel.name}</h2>
          <p className="text-[12px] text-slate-500 mt-1">Paste this snippet into your website's HTML before the closing &lt;/body&gt; tag.</p>
        </div>
        <div className="p-6">
          <div className="relative">
            <pre className="bg-slate-900 text-green-400 rounded-xl p-4 text-[11px] overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
              {code}
            </pre>
            <button
              onClick={copyCode}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[13px] font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InboxChannels() {
  const qc = useQueryClient();
  const [view, setView] = useState<'list' | 'add' | 'configure'>('list');
  const [selectedChannelType, setSelectedChannelType] = useState<string | null>(null);
  
  // Wizard state
  const [name, setName] = useState('');
  const [color, setColor] = useState('#4f46e5');
  const [welcomeMessage, setWelcomeMessage] = useState('How can we help you today?');
  
  // Extra fields for APIs
  const [accountId, setAccountId] = useState('');
  const [authToken, setAuthToken] = useState('');

  const [embedChannel, setEmbedChannel] = useState<InboxChannel | null>(null);

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ['inbox', 'channels'],
    queryFn: inboxApi.listChannels,
  });

  const create = useMutation({
    mutationFn: () => inboxApi.createChannel({ 
      name, 
      channelType: selectedChannelType as any,
      widgetColor: color,
      welcomeMessage,
      settingsJson: JSON.stringify({ accountId, authToken }) // Mock storage of credentials
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox', 'channels'] });
      setView('list');
      resetForm();
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => inboxApi.deleteChannel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox', 'channels'] }),
  });

  const resetForm = () => {
    setName('');
    setColor('#4f46e5');
    setWelcomeMessage('How can we help you today?');
    setAccountId('');
    setAuthToken('');
    setSelectedChannelType(null);
  };

  const handleSelectProvider = (type: string) => {
    setSelectedChannelType(type);
    
    // Auto-fill names for social channels
    const config = AVAILABLE_CHANNELS.find(c => c.id === type);
    if (config) setName(config.name);
    
    // For social networks, mock the OAuth flow immediately
    if (['facebook', 'instagram', 'twitter'].includes(type)) {
      // Mock OAuth Flow
      alert(`Redirecting to ${config?.name} OAuth... (Mocked for now)`);
      create.mutate();
    } else {
      setView('configure');
    }
  };

  const getChannelIcon = (type: string) => {
    const channel = AVAILABLE_CHANNELS.find(c => c.id === type);
    const Icon = channel?.icon || Globe;
    return <Icon className="w-4 h-4 text-white" />;
  };

  const getChannelColor = (type: string) => {
    const channel = AVAILABLE_CHANNELS.find(c => c.id === type);
    return channel?.color || 'bg-slate-500';
  };

  if (view === 'add') {
    return (
      <div className="max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('list')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Add Inbox</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Select a provider to connect a new inbox channel.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AVAILABLE_CHANNELS.map(channel => {
            const Icon = channel.icon;
            return (
              <div 
                key={channel.id} 
                onClick={() => handleSelectProvider(channel.id)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer group flex flex-col items-start gap-4"
              >
                <div className={`w-10 h-10 rounded-lg ${channel.color} flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{channel.name}</h3>
                  <p className="text-[13px] text-slate-500 mt-1">{channel.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === 'configure') {
    const config = AVAILABLE_CHANNELS.find(c => c.id === selectedChannelType);
    const Icon = config?.icon || Globe;

    return (
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setView('add')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div className="flex items-center gap-3">
             <div className={`w-8 h-8 rounded-lg ${config?.color} flex items-center justify-center shadow-sm`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
            <div>
              <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Configure {config?.name}</h2>
              <p className="text-[13px] text-slate-500 mt-0.5">Enter the required details to connect this channel.</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Channel Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              placeholder="e.g., Main Website Support"
            />
          </div>

          {selectedChannelType === 'live_chat' && (
            <>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Brand Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 p-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors uppercase font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Welcome Message</label>
                <textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none"
                  rows={3}
                  placeholder="How can we help you today?"
                />
              </div>
            </>
          )}

          {selectedChannelType === 'sms' && (
            <>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Twilio Account SID</label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Twilio Auth Token</label>
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>
            </>
          )}

          {selectedChannelType === 'email' && (
            <>
              <div>
                <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">Forwarding Email</label>
                <input
                  type="text"
                  disabled
                  value="support-12345@inbox.stoneaio.com"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px] text-slate-500"
                />
                <p className="text-[12px] text-slate-500 mt-1">Configure your email provider to forward emails to this address.</p>
              </div>
            </>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
            <button 
              onClick={() => setView('list')}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[13px] font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending || !name}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
            >
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Channel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Inboxes</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage your connected channels.</p>
        </div>
        <button
          onClick={() => setView('add')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Inbox
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : channels.length === 0 ? (
        <div className="text-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl border-dashed">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Globe className="w-6 h-6 text-indigo-500" />
          </div>
          <h3 className="text-[14px] font-semibold text-slate-900 dark:text-white mb-1">No channels yet</h3>
          <p className="text-[13px] text-slate-500 mb-6 max-w-sm mx-auto">Connect your first inbox channel to start receiving messages from your customers.</p>
          <button
            onClick={() => setView('add')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Connect Inbox
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="font-medium p-4">Channel Name</th>
                <th className="font-medium p-4">Type</th>
                <th className="font-medium p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {channels.map((ch: any) => (
                <tr key={ch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 font-medium text-slate-900 dark:text-white flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getChannelColor(ch.channelType)} shadow-sm`}>
                      {getChannelIcon(ch.channelType)}
                    </div>
                    {ch.name}
                  </td>
                  <td className="p-4 text-slate-500 capitalize">{ch.channelType.replace('_', ' ')}</td>
                  <td className="p-4 flex justify-end gap-2">
                    {ch.channelType === 'live_chat' && (
                      <button
                        onClick={() => setEmbedChannel(ch)}
                        className="px-3 py-1.5 text-[12px] font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-md transition-colors"
                      >
                        Embed Code
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('Delete this channel?')) del.mutate(ch.id);
                      }}
                      disabled={del.isPending}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {embedChannel && (
        <EmbedCodeModal channel={embedChannel} onClose={() => setEmbedChannel(null)} />
      )}
    </div>
  );
}
