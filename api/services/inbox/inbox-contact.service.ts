import { db } from '../../../infrastructure/database/client.js';

export async function listContacts(workspaceId: string, q?: string) {
  const where: any = { workspaceId };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
    ];
  }
  return db.inboxContact.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
}

export async function getContact(workspaceId: string, id: string) {
  return db.inboxContact.findFirst({
    where: { id, workspaceId },
    include: {
      conversations: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      }
    }
  });
}

export async function createContact(workspaceId: string, data: any) {
  return db.inboxContact.create({
    data: { workspaceId, ...data }
  });
}

export async function updateContact(workspaceId: string, id: string, data: any) {
  return db.inboxContact.update({
    where: { id, workspaceId },
    data
  });
}

export async function resolveWidgetContact(workspaceId: string, externalId: string, data: any) {
  const existing = await db.inboxContact.findFirst({
    where: { workspaceId, externalId }
  });
  
  if (existing) {
    return db.inboxContact.update({
      where: { id: existing.id },
      data: { ...data, lastActivityAt: new Date() }
    });
  }
  
  return db.inboxContact.create({
    data: {
      workspaceId,
      externalId,
      ...data,
      lastActivityAt: new Date()
    }
  });
}
