import { db } from '../../../infrastructure/database/client.js';

export async function listLabels(workspaceId: string) {
  return db.inboxLabel.findMany({
    where: { workspaceId },
    orderBy: { title: 'asc' },
  });
}

export async function createLabel(workspaceId: string, data: any) {
  return db.inboxLabel.create({
    data: { workspaceId, ...data },
  });
}

export async function updateLabel(workspaceId: string, id: string, data: any) {
  return db.inboxLabel.update({
    where: { id, workspaceId },
    data,
  });
}

export async function deleteLabel(workspaceId: string, id: string) {
  return db.inboxLabel.delete({
    where: { id, workspaceId },
  });
}
