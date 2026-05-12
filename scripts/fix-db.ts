import { db } from '../infrastructure/database/client.js';

// Remove stale AP project records pointing to old dev workspace ID
const deleted = await db.aPProject.deleteMany({
  where: { workspaceId: 'ws_default_stone_aio' },
});
console.log('Deleted stale AP projects:', deleted.count);

// Also ensure workspace_123 exists (it should from seed, but double-check)
let ws = await db.workspace.findUnique({ where: { id: 'workspace_123' } });
if (!ws) {
  ws = await db.workspace.create({
    data: {
      id: 'workspace_123',
      name: 'Default Workspace',
      ownerId: 'user_123',
      plan: 'free',
    }
  });
  console.log('Created workspace_123');
} else {
  console.log('workspace_123 OK:', ws.name);
}

// Check workflow table
const wfCount = await db.workflow.count({ where: { workspaceId: 'workspace_123' } });
console.log('Workflows for workspace_123:', wfCount);

await db.$disconnect();
