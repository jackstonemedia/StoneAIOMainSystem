/**
 * SDR Storage Adapter
 * Provides hybrid persistence: Prisma Database client with in-memory dev fallback.
 */

import { db } from '../../../infrastructure/database/client.js';
import { nanoid } from 'nanoid';

export interface StoredSdrAgent {
  id: string;
  workspaceId: string;
  name: string;
  targetIcp: any;
  valueProposition: string;
  primaryOffer: string;
  calendarUrl?: string | null;
  mode: 'COPILOT' | 'AUTOPILOT';
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  dailyLimit: number;
  sequenceConfig: any;
  createdAt: string;
  updatedAt: string;
}

export interface StoredSdrDossier {
  id: string;
  agentId: string;
  contactId?: string | null;
  businessName: string;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
  websiteSummary: string;
  hookAngle: string;
  draftedSubject: string;
  draftedBody: string;
  sequenceSteps: any[];
  status: 'DRAFTED' | 'APPROVED' | 'SENDING' | 'ENGAGED' | 'MEETING_BOOKED' | 'BOUNCED' | 'DECLINED';
  metrics?: any;
  createdAt: string;
  updatedAt: string;
}

// In-Memory Dev Store (fallback when DB tables don't exist yet)
const memoryAgents = new Map<string, StoredSdrAgent>();
const memoryDossiers = new Map<string, StoredSdrDossier>();

/** Only swallow "table does not exist" Prisma errors — re-throw everything else */
function isTableMissingError(e: unknown): boolean {
  const msg = String((e as any)?.message || '');
  return msg.includes('does not exist') || (e as any)?.code === 'P2021';
}

export const sdrStore = {
  async listAgents(workspaceId: string): Promise<StoredSdrAgent[]> {
    try {
      return await (db as any).autonomousSdrAgent.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }
    return Array.from(memoryAgents.values()).filter(a => a.workspaceId === workspaceId);
  },

  async createAgent(data: Omit<StoredSdrAgent, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoredSdrAgent> {
    try {
      return await (db as any).autonomousSdrAgent.create({
        data: {
          ...data,
          mode: data.mode === 'AUTOPILOT' ? 'AUTOPILOT' : 'COPILOT',
          status: data.status || 'ACTIVE',
        },
      });
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }

    const agent: StoredSdrAgent = {
      ...data,
      id: `sdr_${nanoid(10)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryAgents.set(agent.id, agent);
    return agent;
  },

  async getAgent(id: string, workspaceId: string): Promise<StoredSdrAgent | null> {
    try {
      const found = await (db as any).autonomousSdrAgent.findFirst({
        where: { id, workspaceId },
      });
      return found ?? null;
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }
    const agent = memoryAgents.get(id);
    return agent && agent.workspaceId === workspaceId ? agent : null;
  },

  async updateAgent(id: string, updates: Partial<StoredSdrAgent>): Promise<StoredSdrAgent> {
    try {
      // Strip immutable fields that Prisma won't accept in data
      const { id: _id, workspaceId: _ws, createdAt: _ca, updatedAt: _ua, ...safeUpdates } = updates as any;
      return await (db as any).autonomousSdrAgent.update({
        where: { id },
        data: { ...safeUpdates, updatedAt: new Date() },
      });
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }

    const agent = memoryAgents.get(id);
    if (!agent) throw new Error('Agent not found');
    const updated = { ...agent, ...updates, updatedAt: new Date().toISOString() };
    memoryAgents.set(id, updated);
    return updated;
  },

  async deleteAgent(id: string): Promise<void> {
    try {
      await (db as any).autonomousSdrAgent.delete({ where: { id } });
      return;
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }
    memoryAgents.delete(id);
  },

  async listDossiers(agentId: string): Promise<StoredSdrDossier[]> {
    try {
      return await (db as any).sdrLeadDossier.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }
    return Array.from(memoryDossiers.values())
      .filter(d => d.agentId === agentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async createDossier(data: Omit<StoredSdrDossier, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoredSdrDossier> {
    try {
      return await (db as any).sdrLeadDossier.create({ data });
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }

    const dossier: StoredSdrDossier = {
      ...data,
      id: `dos_${nanoid(10)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryDossiers.set(dossier.id, dossier);
    return dossier;
  },

  async getDossier(id: string): Promise<StoredSdrDossier | null> {
    try {
      const found = await (db as any).sdrLeadDossier.findUnique({ where: { id } });
      return found ?? null;
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }
    return memoryDossiers.get(id) || null;
  },

  async getDossiersByIds(ids: string[]): Promise<StoredSdrDossier[]> {
    try {
      return await (db as any).sdrLeadDossier.findMany({
        where: { id: { in: ids } },
      });
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }
    return Array.from(memoryDossiers.values()).filter(d => ids.includes(d.id));
  },

  async updateDossier(id: string, updates: Partial<StoredSdrDossier>): Promise<StoredSdrDossier> {
    try {
      const { id: _id, agentId: _aid, createdAt: _ca, updatedAt: _ua, ...safeUpdates } = updates as any;
      return await (db as any).sdrLeadDossier.update({
        where: { id },
        data: { ...safeUpdates, updatedAt: new Date() },
      });
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }

    const d = memoryDossiers.get(id);
    if (!d) throw new Error('Dossier not found');
    const updated = { ...d, ...updates, updatedAt: new Date().toISOString() };
    memoryDossiers.set(id, updated);
    return updated;
  },

  async batchApproveDossiers(agentId: string, dossierIds?: string[]): Promise<number> {
    try {
      const whereClause: any = { agentId, status: 'DRAFTED' };
      if (dossierIds && dossierIds.length > 0) whereClause.id = { in: dossierIds };
      const res = await (db as any).sdrLeadDossier.updateMany({
        where: whereClause,
        data: { status: 'APPROVED', updatedAt: new Date() },
      });
      return res.count;
    } catch (e) {
      if (!isTableMissingError(e)) throw e;
    }

    let count = 0;
    for (const [id, d] of memoryDossiers.entries()) {
      if (d.agentId === agentId && d.status === 'DRAFTED') {
        if (!dossierIds || dossierIds.length === 0 || dossierIds.includes(id)) {
          d.status = 'APPROVED';
          d.updatedAt = new Date().toISOString();
          count++;
        }
      }
    }
    return count;
  }
};
