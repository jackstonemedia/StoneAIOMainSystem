/**
 * Sending Domain Service — Email Marketing Module
 *
 * Manages custom sending domains with DKIM/SPF verification via Resend Domains API.
 * Tenant isolation: all queries and actions strictly scoped by workspaceId.
 */

import { Resend } from 'resend';
import { db } from '../../../infrastructure/database/client.js';
import { env } from '../../../infrastructure/config/env.js';
import { SendingDomainStatus } from '@prisma/client';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function createSendingDomain(
  workspaceId: string,
  domain: string,
  region?: string
) {
  const cleanDomain = domain.trim().toLowerCase();

  let resendDomainId = `mock_dom_${Date.now()}`;
  let dnsRecords: any = [];

  if (resend) {
    const res = await resend.domains.create({
      name: cleanDomain,
      region: (region as any) || undefined,
    });

    if (res.error) {
      throw new Error(`Resend domain creation failed: ${res.error.message}`);
    }

    if (res.data) {
      resendDomainId = res.data.id;
      dnsRecords = res.data.records || [];
    }
  }

  return db.sendingDomain.create({
    data: {
      workspaceId,
      domain: cleanDomain,
      resendDomainId,
      status: SendingDomainStatus.PENDING,
      region: region || null,
      dnsRecords: (dnsRecords as any) ?? [],
    },
  });
}

export async function getSendingDomains(workspaceId: string) {
  return db.sendingDomain.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function verifySendingDomain(workspaceId: string, id: string) {
  const record = await db.sendingDomain.findFirst({
    where: { id, workspaceId },
  });

  if (!record) {
    throw new Error('Sending domain not found');
  }

  let newStatus: SendingDomainStatus = SendingDomainStatus.PENDING;
  let records: any = record.dnsRecords;
  let verifiedAt = record.verifiedAt;

  if (resend && record.resendDomainId && !record.resendDomainId.startsWith('mock_')) {
    await resend.domains.verify(record.resendDomainId);
    const domainInfo = await resend.domains.get(record.resendDomainId);

    if (domainInfo.data) {
      records = domainInfo.data.records || [];
      const statusStr = domainInfo.data.status?.toLowerCase();
      if (statusStr === 'verified') {
        newStatus = SendingDomainStatus.VERIFIED;
        verifiedAt = new Date();
      } else if (statusStr === 'failed') {
        newStatus = SendingDomainStatus.FAILED;
      }
    }
  } else {
    // In dev mode without API key, verify for testing
    newStatus = SendingDomainStatus.VERIFIED;
    verifiedAt = new Date();
  }

  return db.sendingDomain.update({
    where: { id },
    data: {
      status: newStatus,
      dnsRecords: (records as any) ?? [],
      verifiedAt,
    },
  });
}

export async function deleteSendingDomain(workspaceId: string, id: string) {
  const record = await db.sendingDomain.findFirst({
    where: { id, workspaceId },
  });

  if (!record) {
    throw new Error('Sending domain not found');
  }

  if (resend && record.resendDomainId && !record.resendDomainId.startsWith('mock_')) {
    try {
      await resend.domains.remove(record.resendDomainId);
    } catch (err: any) {
      console.warn(`[SendingDomain] Resend domain removal warning:`, err.message);
    }
  }

  return db.sendingDomain.deleteMany({
    where: { id, workspaceId },
  });
}
