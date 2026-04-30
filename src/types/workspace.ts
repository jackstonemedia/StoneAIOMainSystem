/**
 * Workspace & auth domain types.
 */

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
}
