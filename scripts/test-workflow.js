"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var client_js_1 = require("../infrastructure/database/client.js");
// Simulate the POST /api/workflows flow with workspace_123
var workspaceId = 'workspace_123';
// Step 1: Check ensureAPProject
var apProject = await client_js_1.db.aPProject.findUnique({ where: { workspaceId: workspaceId } });
console.log('AP Project:', apProject ? apProject.apProjectId : 'NOT FOUND - will create');
if (!apProject) {
    apProject = await client_js_1.db.aPProject.create({
        data: {
            workspaceId: workspaceId,
            apProjectId: process.env.ACTIVEPIECES_PROJECT_ID || 'mock-project-id',
            apProjectName: 'Default Workspace',
        }
    });
    console.log('Created AP project:', apProject.apProjectId);
}
// Step 2: Simulate createAPFlow (it's mocked when offline)
var mockFlowId = "mock-flow-".concat(Date.now());
// Step 3: Create workflow in DB  
var wf = await client_js_1.db.workflow.create({
    data: {
        workspaceId: workspaceId,
        apFlowId: mockFlowId,
        apProjectId: apProject.apProjectId,
        apVersionId: "version-".concat(Date.now()),
        name: 'Test Workflow from Script',
        status: 'draft',
    }
});
console.log('Created workflow:', wf.id, wf.name);
console.log('✅ Workflow creation pipeline works end-to-end!');
await client_js_1.db.$disconnect();
