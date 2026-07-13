import { db } from '../../../infrastructure/database/client.js';
import { nanoid } from 'nanoid';

export async function listChannels(workspaceId: string) {
  return db.inboxChannel.findMany({
    where: { workspaceId },
    include: { agents: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getChannel(workspaceId: string, channelId: string) {
  return db.inboxChannel.findFirst({
    where: { id: channelId, workspaceId },
    include: { agents: true },
  });
}

export async function createChannel(workspaceId: string, data: {
  name: string;
  channelType: string;
  avatarUrl?: string;
  welcomeMessage?: string;
  awayMessage?: string;
  widgetColor?: string;
}) {
  const embedToken = data.channelType === 'live_chat' ? nanoid(32) : undefined;
  return db.inboxChannel.create({
    data: { workspaceId, embedToken, ...data },
  });
}

export async function updateChannel(workspaceId: string, channelId: string, data: Partial<{
  name: string;
  channelType: string;
  avatarUrl: string;
  welcomeMessage: string;
  awayMessage: string;
  widgetColor: string;
  isEnabled: boolean;
  regenerateToken: boolean;
}>) {
  const { regenerateToken, ...rest } = data;
  const extra: Record<string, string> = {};
  if (regenerateToken) extra.embedToken = nanoid(32);

  return db.inboxChannel.update({
    where: { id: channelId, workspaceId },
    data: { ...rest, ...extra },
  });
}

export async function deleteChannel(workspaceId: string, channelId: string) {
  return db.inboxChannel.delete({ where: { id: channelId, workspaceId } });
}

export async function listChannelAgents(channelId: string) {
  return db.inboxChannelAgent.findMany({ where: { inboxChannelId: channelId } });
}

export async function addChannelAgent(channelId: string, userId: string) {
  return db.inboxChannelAgent.upsert({
    where: { inboxChannelId_userId: { inboxChannelId: channelId, userId } },
    create: { inboxChannelId: channelId, userId },
    update: {},
  });
}

export async function removeChannelAgent(channelId: string, userId: string) {
  return db.inboxChannelAgent.deleteMany({
    where: { inboxChannelId: channelId, userId },
  });
}

export function buildEmbedCode(channel: { embedToken: string | null }, appUrl: string) {
  const token = channel.embedToken ?? '';
  return {
    token,
    html: `<!-- Stone AIO Live Chat Widget -->
<script>
  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "${appUrl}/widget/v1/loader.js";
    js.setAttribute('data-inbox-token', '${token}');
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'stone-aio-widget'));
</script>`,
  };
}
