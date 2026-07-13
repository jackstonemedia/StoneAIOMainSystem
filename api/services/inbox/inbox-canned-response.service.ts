import { db } from '../../../infrastructure/database/client.js';

export async function listCannedResponses(workspaceId: string, q?: string) {
  const where: any = { workspaceId };
  if (q) {
    where.name = { contains: q, mode: 'insensitive' };
  }
  return db.cannedResponse.findMany({
    where,
    orderBy: { name: 'asc' },
  });
}

export async function createCannedResponse(workspaceId: string, data: any) {
  return db.cannedResponse.create({
    data: { workspaceId, ...data },
  });
}

export async function updateCannedResponse(workspaceId: string, id: string, data: any) {
  return db.cannedResponse.update({
    where: { id, workspaceId },
    data,
  });
}

export async function deleteCannedResponse(workspaceId: string, id: string) {
  return db.cannedResponse.delete({
    where: { id, workspaceId },
  });
}
