import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelConnectionsApi } from '../../../lib/api/conversations';
import { queryKeys } from '../../../lib/queryKeys';
import {
  Mail, MessageSquare, Plus, Loader2, CheckCircle2, AlertCircle,
  RefreshCw, Trash2, ChevronDown, ChevronUp, Search, Phone,
} from 'lucide-react';
import type { ChannelConnection } from '../../../types/conversation';

// ── Gmail section ─────────────────────────────────────────────────────────────
function GmailSection({ connections, onDisconnect, onReconnect }: {
  connections: ChannelConnection[];
  onDisconnect: (id: string) => void;
  onReconnect: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ChannelConnection> }) =>
      channelConnectionsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.conversations.channelConnections() }),
  });

  if (connections.length === 0) {
    return (
      <div className="text-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl border-dashed">
        <Mail className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-300 mb-1">No Gmail accounts connected</p>
        <p className="text-[13px] text-slate-500 mb-4">Connect a Gmail account to send and receive emails in Conversations.</p>
        <button
          onClick={() => channelConnectionsApi.connectGmail()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[13px] font-semibold transition-colors"
        >
          <Mail className="w-4 h-4" /> Connect Gmail
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {connections.map(conn => {
        const isExpanded = expandedId === conn.id;
        const isHealthy = conn.isActive && conn.status !== 'expired';
        return (
          <div key={conn.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{conn.email ?? conn.label ?? 'Gmail Account'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {isHealthy
                      ? <><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Connected</span></>
                      : <><AlertCircle className="w-3 h-3 text-red-500" /><span className="text-[11px] text-red-500 font-medium">Expired</span></>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isHealthy && (
                  <button
                    onClick={() => onReconnect(conn.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[12px] font-semibold rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reconnect
                  </button>
                )}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : conn.id)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => onDisconnect(conn.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50 dark:bg-slate-950">
                {[
                  { key: 'twoWaySync', label: 'Two-way sync', desc: 'Sync replies sent from Gmail directly into conversations' },
                  { key: 'autoReply', label: 'Auto-reply when away', desc: 'Send auto-reply when no one is available' },
                  { key: 'archiveOnReply', label: 'Archive on reply', desc: 'Auto-archive conversations after you reply' },
                ].map(opt => (
                  <div key={opt.key} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{opt.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                    <button
                      onClick={() => update.mutate({ id: conn.id, data: { [opt.key]: !(conn as any)[opt.key] } })}
                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${
                        (conn as any)[opt.key] ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${(conn as any)[opt.key] ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}

                {conn.autoReply && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Auto-reply message</label>
                    <textarea
                      defaultValue={conn.autoReplyText ?? ''}
                      onBlur={e => update.mutate({ id: conn.id, data: { autoReplyText: e.target.value } })}
                      rows={2}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Signature</label>
                  <textarea
                    defaultValue={conn.signature ?? ''}
                    onBlur={e => update.mutate({ id: conn.id, data: { signature: e.target.value } })}
                    rows={3}
                    placeholder="Your email signature…"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Twilio section ────────────────────────────────────────────────────────────
function TwilioSection({ connections, onDisconnect }: {
  connections: ChannelConnection[];
  onDisconnect: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [showProvision, setShowProvision] = useState(false);
  const [areaCode, setAreaCode] = useState('');
  const [numberResults, setNumberResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const searchNumbers = async () => {
    if (!areaCode.trim()) return;
    setSearching(true);
    try {
      const results = await channelConnectionsApi.searchTwilioNumbers(areaCode.trim());
      setNumberResults(results);
    } finally {
      setSearching(false);
    }
  };

  const provision = useMutation({
    mutationFn: (phoneNumber: string) => channelConnectionsApi.provisionTwilioNumber({ phoneNumber }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.channelConnections() });
      setShowProvision(false);
      setNumberResults([]);
      setAreaCode('');
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ChannelConnection> }) =>
      channelConnectionsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.conversations.channelConnections() }),
  });

  return (
    <div className="space-y-4">
      {connections.length === 0 && !showProvision && (
        <div className="text-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl border-dashed">
          <Phone className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-300 mb-1">No SMS numbers provisioned</p>
          <p className="text-[13px] text-slate-500 mb-4">Search for a Twilio number to start sending SMS.</p>
          <button onClick={() => setShowProvision(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[13px] font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Provision Number
          </button>
        </div>
      )}

      {connections.map(conn => {
        const isExpanded = expandedId === conn.id;
        return (
          <div key={conn.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{conn.twilioPhoneNumber ?? 'SMS Number'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {conn.isActive
                      ? <><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Active</span></>
                      : <><AlertCircle className="w-3 h-3 text-slate-400" /><span className="text-[11px] text-slate-500">Inactive</span></>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setExpandedId(isExpanded ? null : conn.id)} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button onClick={() => onDisconnect(conn.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50 dark:bg-slate-950">
                {[
                  { key: 'stopStartHandling', label: 'STOP/START keyword handling', desc: 'Auto opt-out contacts who reply STOP' },
                  { key: 'quietHoursEnabled', label: 'Quiet hours enforcement', desc: 'Pause SMS during non-business hours' },
                  { key: 'businessHoursAutoReply', label: 'Business hours auto-reply', desc: 'Auto-reply outside business hours' },
                ].map(opt => (
                  <div key={opt.key} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{opt.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                    <button
                      onClick={() => update.mutate({ id: conn.id, data: { [opt.key]: !(conn as any)[opt.key] } })}
                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 mt-0.5 ${
                        (conn as any)[opt.key] ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${(conn as any)[opt.key] ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Forwarding number</label>
                  <input
                    defaultValue={conn.forwardingNumber ?? ''}
                    onBlur={e => update.mutate({ id: conn.id, data: { forwardingNumber: e.target.value } })}
                    placeholder="+1 555 000 0000"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Provision new number */}
      <button
        onClick={() => setShowProvision(true)}
        className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <Plus className="w-4 h-4" /> Provision New Number
      </button>

      {showProvision && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">Search Available Numbers</h3>
            <button onClick={() => { setShowProvision(false); setNumberResults([]); }} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
              ×
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={areaCode}
              onChange={e => setAreaCode(e.target.value)}
              placeholder="Area code (e.g. 415)"
              maxLength={3}
              className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              onClick={searchNumbers}
              disabled={searching || areaCode.length < 3}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[13px] font-semibold disabled:opacity-50 transition-colors"
            >
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Search
            </button>
          </div>
          {numberResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {numberResults.map(n => (
                <div key={n.phoneNumber} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{n.phoneNumber}</p>
                    <p className="text-[11px] text-slate-500">{n.locality}, {n.region}</p>
                  </div>
                  <button
                    onClick={() => provision.mutate(n.phoneNumber)}
                    disabled={provision.isPending}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-semibold rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {provision.isPending ? 'Provisioning…' : 'Select'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ConversationsChannelsSettings() {
  const qc = useQueryClient();
  const { data: connections = [], isLoading } = useQuery({
    queryKey: queryKeys.conversations.channelConnections(),
    queryFn: channelConnectionsApi.list,
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => channelConnectionsApi.disconnect(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.conversations.channelConnections() }),
  });

  const gmailConns = connections.filter(c => c.provider === 'gmail' || c.provider === 'outlook');
  const twilioConns = connections.filter(c => c.provider === 'twilio');

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="max-w-3xl space-y-10">
      {/* Gmail */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Email — Gmail</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">Connected Gmail and Outlook mailboxes.</p>
          </div>
          <button
            onClick={() => channelConnectionsApi.connectGmail()}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[13px] font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Connect Gmail
          </button>
        </div>
        <GmailSection
          connections={gmailConns}
          onDisconnect={id => { if (confirm('Disconnect this mailbox?')) disconnect.mutate(id); }}
          onReconnect={() => channelConnectionsApi.connectGmail()}
        />
      </section>

      {/* SMS / Twilio */}
      <section>
        <div className="mb-4">
          <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">SMS — Twilio</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Provisioned Twilio phone numbers for SMS conversations.</p>
        </div>
        <TwilioSection
          connections={twilioConns}
          onDisconnect={id => { if (confirm('Remove this number?')) disconnect.mutate(id); }}
        />
      </section>
    </div>
  );
}
