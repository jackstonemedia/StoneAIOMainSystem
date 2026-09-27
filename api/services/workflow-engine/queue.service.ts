import Queue, { Job } from 'bull';
import { engineService } from './engine.service.js';

export class QueueService {
  private queue: Queue.Queue | null = null;
  
  initialize(): void {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        const isTls = redisUrl.startsWith('rediss://');
        this.queue = new Queue('workflow-execution', redisUrl, {
          redis: isTls
            ? {
                tls: { rejectUnauthorized: false },
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
              }
            : {
                maxRetriesPerRequest: null,
              },
        });

        this.queue.process(5, async (job) => {
          await this.processJob(job);
        });

        this.queue.on('error', (err) => {
          console.error('[Workflow Engine] Queue error:', err.message);
        });

        this.queue.on('failed', (job, err) => {
          console.error(`[Workflow Engine] Job ${job?.id} failed:`, err.message);
        });

        console.log(`[Workflow Engine] Bull queue initialized (TLS: ${isTls})`);
      } catch (err: any) {
        console.warn('[Workflow Engine] Failed to initialize Bull queue, falling back to in-process:', err.message);
        this.queue = null;
      }
    } else {
      console.log('[Workflow Engine] No REDIS_URL found, running in-process (inline)');
    }
  }
  
  async enqueue(params: {
    workspaceId: string;
    workflowId: string;
    triggerData: unknown;
    mode: 'production' | 'test' | 'manual';
    userId?: string;
  }): Promise<{ runId: string }> {
    // In test mode, execute directly so caller receives immediate result & logs
    if (params.mode === 'test' || !this.queue) {
      console.log(`[QueueService] Executing workflow in-process (mode: ${params.mode})...`);
      const { runId } = await engineService.executeWorkflow(params);
      return { runId };
    }

    // Production queueing with retries and exponential backoff
    console.log(`[QueueService] Enqueueing workflow ${params.workflowId} for async execution...`);
    const job = await this.queue.add(params, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 200,
      removeOnFail: 500,
    });

    return { runId: job.id.toString() };
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
    if (!this.queue) return 'completed';
    
    const job = await this.queue.getJob(runId);
    if (!job) return 'not_found';
    
    const state = await job.getState();
    return state;
  }
}

export const queueService = new QueueService();
