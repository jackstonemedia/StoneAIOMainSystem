import { db } from '../../../infrastructure/database/client.js';
import { nanoid } from 'nanoid';

export async function provisionInbox(workspaceId: string): Promise<void> {
  const already = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { inboxEnabled: true },
  });
  if (already?.inboxEnabled) return;

  await db.$transaction(async (tx: any) => {
    const inboxToken = nanoid(32);
    await tx.workspace.update({
      where: { id: workspaceId },
      data: { inboxEnabled: true, inboxToken },
    });

    const embedToken = nanoid(32);
    await tx.inboxChannel.create({
      data: {
        workspaceId,
        name: 'Support Chat',
        channelType: 'live_chat',
        embedToken,
        welcomeMessage: 'Welcome! How can we help you today?',
        awayMessage: "Our team is away. We'll get back to you soon.",
        widgetColor: '#6366f1',
      },
    });

    const defaultLabels = [
      { title: 'Bug', color: '#ef4444' },
      { title: 'Feature Request', color: '#3b82f6' },
      { title: 'Question', color: '#f59e0b' },
      { title: 'Urgent', color: '#dc2626' },
    ];
    await tx.inboxLabel.createMany({
      data: defaultLabels.map(l => ({ workspaceId, ...l })),
    });

    await tx.inboxDisplayIdSequence.upsert({
      where: { workspaceId },
      update: {},
      create: { workspaceId, lastId: 0 },
    });
  });
}

export async function getProvisionStatus(workspaceId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { inboxEnabled: true, inboxToken: true },
  });
  return { provisioned: !!workspace?.inboxEnabled };
}
