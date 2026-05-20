import Queue, { Job } from 'bull';
import { engineService } from './engine.service';

export class QueueService {
  private queue: Queue.Queue | null = null;
  
  initialize(): void {
    if (process.env.REDIS_URL) {
      this.queue = new Queue('workflow-execution', process.env.REDIS_URL);
      this.queue.process(async (job) => {
        await this.processJob(job);
      });
      console.log('Workflow Engine: Bull queue initialized');
    } else {
      console.log('Workflow Engine: No REDIS_URL found, running in-process (inline)');
    }
  }
  
  async enqueue(params: {
    workspaceId: string;
    workflowId: string;
    triggerData: unknown;
    mode: 'production' | 'test' | 'manual';
    userId?: string;
  }): Promise<{ runId: string }> {
    if (this.queue) {
      const job = await this.queue.add(params);
      return { runId: String(job.id) };
    } else {
      // Inline synchronous execution (for local/dev without Redis)
      const { runId } = await engineService.executeWorkflow(params);
      return { runId };
    }
  }

  private async processJob(job: Job): Promise<void> {
    const data = job.data as {
      workspaceId: string;
      workflowId: string;
      triggerData: unknown;
      mode: 'production' | 'test' | 'manual';
      userId?: string;
    };
    
    await engineService.executeWorkflow(data);
  }
    
  async getJobStatus(runId: string): Promise<string> {
    if (!this.queue) return 'completed'; // Inline is always completed by the time it returns
    
    const job = await this.queue.getJob(runId);
    if (!job) return 'not_found';
    
    const state = await job.getState();
    return state;
  }
}

export const queueService = new QueueService();
