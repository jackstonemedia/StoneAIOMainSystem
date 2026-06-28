import { engineService } from './api/services/workflow-engine/engine.service.js';
import { db } from './infrastructure/database/client.js';
import { registerAllNodes } from './api/services/workflow-engine/nodes/index.js';

async function testEngine() {
  registerAllNodes();
  
  const ws = await db.workspace.findFirst();
  if (!ws) throw new Error('No workspace');

  const node = {
    id: 'email_1',
    type: 'communication.send_email',
    label: 'Send Email',
    position: { x: 0, y: 0 },
    config: {
      to: 'jack@stone.aio', // use a real test email or something we can see
      subject: 'Test Email from Debug',
      body: 'This is a test email.'
    }
  };

  const dummyData = {
    email: 'test@example.com',
  };

  const context = {
    workspaceId: ws.id,
    workflowId: 'fake-id',
    runId: 'test-run',
    triggerData: dummyData,
    runData: {},
    mode: 'test' as const,
    userId: 'test'
  };

  try {
    console.log('Executing test node directly...');
    const result = await engineService.executeNode(node as any, [{ json: {} }], context as any);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Test Error:', e);
  }
}

testEngine().catch(console.error).finally(() => process.exit(0));
