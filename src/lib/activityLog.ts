import { db, StorageKey } from './storage';

export enum ActivityType {
  NOTE = 'note',
  CALL = 'call',
  EMAIL = 'email',
  MEETING = 'meeting',
  TASK = 'task',
  SYSTEM = 'system'
}

export interface ActivityLogEntry {
  id: string;
  type: ActivityType;
  entityId: string;
  entityType: string;
  description: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export async function logActivity(entry: {
  type: ActivityType;
  entityId: string;
  entityType: string;
  description: string;
  userId: string;
}): Promise<void> {
  await db.insert<ActivityLogEntry>(StorageKey.ACTIVITY_LOG, entry);
}
