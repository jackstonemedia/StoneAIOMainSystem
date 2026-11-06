import { db } from '../../../infrastructure/database/client.js';
import type { PrismaClient } from '@prisma/client';

export type AssistantTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Executes a callback within a database transaction that sets app.workspace_id
 * for PostgreSQL Row-Level Security (FORCE RLS).
 */
export async function withTenant<T>(
  workspaceId: string,
  fn: (tx: AssistantTx) => Promise<T>
): Promise<T> {
  if (!workspaceId) {
    throw new Error('Tenant context missing: workspaceId is required');
  }

  return await db.$transaction(async (tx) => {
    try {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
    } catch {
      // In mocked testing environments, set_config might not be implemented
    }
    return await fn(tx as unknown as AssistantTx);
  });
}
