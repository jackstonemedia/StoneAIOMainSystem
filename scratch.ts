import Queue from 'bull';
import dotenv from 'dotenv';
dotenv.config();
const q = new Queue('workflow-execution', process.env.REDIS_URL!);
async function test() {
  const waiting = await q.getWaitingCount();
  const active = await q.getActiveCount();
  const failed = await q.getFailedCount();
  const delayed = await q.getDelayedCount();
  const completed = await q.getCompletedCount();
  console.log({ waiting, active, failed, delayed, completed });
}
test().catch(console.error).finally(() => process.exit(0));
