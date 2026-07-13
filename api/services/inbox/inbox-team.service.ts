import { db } from '../../../infrastructure/database/client.js';

export async function listTeams(workspaceId: string) {
  return db.inboxTeam.findMany({
    where: { workspaceId },
    orderBy: { name: 'asc' },
    include: { members: true },
  });
}

export async function createTeam(workspaceId: string, data: any) {
  return db.inboxTeam.create({
    data: { workspaceId, ...data },
  });
}

export async function updateTeam(workspaceId: string, id: string, data: any) {
  return db.inboxTeam.update({
    where: { id, workspaceId },
    data,
  });
}

export async function deleteTeam(workspaceId: string, id: string) {
  return db.inboxTeam.delete({
    where: { id, workspaceId },
  });
}

export async function listTeamMembers(teamId: string) {
  return db.inboxTeamMember.findMany({
    where: { teamId },
  });
}

export async function addTeamMember(teamId: string, userId: string) {
  return db.inboxTeamMember.upsert({
    where: { teamId_userId: { teamId, userId } },
    create: { teamId, userId },
    update: {},
  });
}

export async function removeTeamMember(teamId: string, userId: string) {
  return db.inboxTeamMember.deleteMany({
    where: { teamId, userId },
  });
}
