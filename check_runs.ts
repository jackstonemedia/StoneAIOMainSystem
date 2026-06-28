import { db } from './infrastructure/database/client.js';

async function checkRuns() {
  const runs = await db.workflowRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 5,
    include: {
      workflow: {
        select: { name: true }
      }
    }
  });

  for (const run of runs) {
    console.log(`Run: ${run.id} | Workflow: ${run.workflow?.name} | Status: ${run.status}`);
    if (run.errorMessage) {
      console.log(`  Error: ${run.errorMessage}`);
    }
    if (run.runData) {
      console.log(`  Data:`, run.runData.substring(0, 500));
    }
    console.log('---');
  }
}

checkRuns().catch(console.error).finally(() => process.exit(0));
