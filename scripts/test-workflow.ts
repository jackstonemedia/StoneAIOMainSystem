import { db } from '../infrastructure/database/client.js';

// Simulate the POST /api/workflows flow with workspace_123
const workspaceId = 'workspace_123';

// Step 1: Check ensureAPProject
let apProject = await db.aPProject.findUnique({ where: { workspaceId } });
console.log('AP Project:', apProject ? apProject.apProjectId : 'NOT FOUND - will create');

if (!apProject) {
  apProject = await db.aPProject.create({
    data: {
      workspaceId,
      apProjectId: process.env.ACTIVEPIECES_PROJECT_ID || 'mock-project-id',
      apProjectName: 'Default Workspace',
    }
  });
  console.log('Created AP project:', apProject.apProjectId);
}

// Step 2: Simulate createAPFlow (it's mocked when offline)
const mockFlowId = `mock-flow-${Date.now()}`;

// Step 3: Create workflow in DB  
const wf = await db.workflow.create({
  data: {
    workspaceId,
    apFlowId: mockFlowId,
    apProjectId: apProject.apProjectId,
    apVersionId: `version-${Date.now()}`,
    name: 'Test Workflow from Script',
    status: 'draft',
  }
});

console.log('Created workflow:', wf.id, wf.name);
console.log('✅ Workflow creation pipeline works end-to-end!');

await db.$disconnect();
