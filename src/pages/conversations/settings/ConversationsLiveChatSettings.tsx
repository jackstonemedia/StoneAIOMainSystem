import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, CheckCircle2, AlertCircle, Copy, Check, Loader2 } from 'lucide-react';
import { inboxApi } from '../../../lib/api/inbox';
import type { InboxChannel } from '../../../lib/api/inbox';
import { useToast } from '../../../components/ui/Toast';

// Live chat (website widget) settings — Tier 3 Tranche A, Fix 13.
//
// POST /inbox/provision used to have no caller at all: a fresh workspace
// had no live-chat channel and no way to get one, and the embed snippet
// route's only caller was the archived inbox. This page is the caller:
// the toggle provisions the workspace (idempotent), enables the channel,
// and shows the embed snippet. Turning it off disables the channel, and
// the widget middleware then answers 401 for that token — the widget
// genuinely stops, it doesn't just hide the toggle.
export default function ConversationsLiveChatSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: provision, isLoading: loadingProvision } = useQuery({
    queryKey: ['inbox', 'provision'],
    queryFn: () => inboxApi.getProvisionStatus(),
  });
  const { data: channels = [], isLoading: loadingChannels } = useQuery<InboxChannel[]>({
    queryKey: ['inbox', 'channels'],
    queryFn: () => inboxApi.listChannels(),
  });

  const liveChatChannel = channels.find(c => c.channelType === 'live_chat');
  const enabled = !!provision?.provisioned && !!liveChatChannel?.isEnabled;

  const { data: embed, isLoading: loadingEmbed } = useQuery({
    queryKey: ['inbox', 'channels', liveChatChannel?.id, 'embed'],
    queryFn: () => inboxApi.getEmbedCode(liveChatChannel!.id),
    enabled: !!liveChatChannel?.id && enabled,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inbox', 'provision'] });
    qc.invalidateQueries({ queryKey: ['inbox', 'channels'] });
  };

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) {
        await inboxApi.provision();
        const fresh = await inboxApi.listChannels();
        const channel = fresh.find(c => c.channelType === 'live_chat');
        if (!channel) {
          await inboxApi.createChannel({
            name: 'Support Chat',
            channelType: 'live_chat',
            welcomeMessage: 'Welcome! How can we help you today?',
            awayMessage: "Our team is away. We'll get back to you soon.",
          });
        } else if (!channel.isEnabled) {
          await inboxApi.updateChannel(channel.id, { isEnabled: true });
        }
      } else if (liveChatChannel) {
        await inboxApi.updateChannel(liveChatChannel.id, { isEnabled: false });
      }
    },
    onSuccess: (_, next) => {
      invalidate();
      toast('success', next ? 'Live chat enabled' : 'Live chat disabled');
    },
    onError: () => toast('error', 'Could not change live chat. Please try again.'),
  });

  const copyEmbed = async () => {
    if (!embed?.html) return;
    try {
      await navigator.clipboard.writeText(embed.html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('error', 'Could not copy. Select the code and copy it manually.');
    }
  };

  if (loadingProvision || loadingChannels) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading live chat settings…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-[18px] font-bold text-slate-900 dark:text-white">Live Chat</h2>
        <p className="text-[13px] text-slate-500 leading-relaxed mt-1">
          Show a chat widget on your website so visitors can message you. Chats arrive in
          Conversations under the Live chat tab, where your team answers them.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-slate-900 dark:text-white">Enable live chat</p>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                {enabled ? (
                  <><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400 font-medium">Live — the widget answers on your site</span></>
                ) : (
                  <><AlertCircle className="w-3 h-3 text-slate-400" /><span>Off — visitors see no widget</span></>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggle.mutate(!enabled)}
            disabled={toggle.isPending}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
            aria-label={enabled ? 'Disable live chat' : 'Enable live chat'}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {enabled && liveChatChannel && (
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
            <div>
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Channel</p>
              <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{liveChatChannel.name}</p>
              {liveChatChannel.welcomeMessage && (
                <p className="text-[12px] text-slate-500 mt-0.5">Visitors see: “{liveChatChannel.welcomeMessage}”</p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Embed on your website</label>
                <button
                  onClick={copyEmbed}
                  disabled={!embed?.html}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white text-[12px] font-semibold rounded-lg disabled:opacity-50 transition-colors"
                >
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy code</>}
                </button>
              </div>
              <textarea
                readOnly
                value={loadingEmbed ? 'Loading embed code…' : (embed?.html ?? '')}
                rows={9}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[12px] font-mono text-slate-900 dark:text-white focus:outline-none resize-none"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Paste this just before the closing <code>&lt;/body&gt;</code> tag on every page where
                the widget should appear. Turning live chat off above stops the widget from answering.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
