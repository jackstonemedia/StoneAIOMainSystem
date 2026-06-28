import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env.js';

if (!env.REDIS_URL) {
  console.warn('⚠️ REDIS_URL is not set. Background jobs (BullMQ) may fail to connect.');
}

const connection = env.REDIS_URL ? new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
}) : null;

const mockWorkers = new Map<string, MockWorker>();

class MockQueue {
  name: string;
  constructor(name: string) { this.name = name; }
  async add(name: string, data: any) {
    const jobId = data.jobId || 'mock-job-' + Date.now();
    setTimeout(() => {
      const worker = mockWorkers.get(this.name);
      if (worker) {
        worker.processJob({ id: jobId, name, data }).catch(console.error);
      }
    }, 0);
    return { id: jobId };
  }
  async getJobs() { return []; }
  async clean() {}
  on() {}
}

class MockWorker {
  name: string;
  processor: (job: Job) => Promise<any>;
  constructor(name: string, processor: (job: Job) => Promise<any>) {
    this.name = name;
    this.processor = processor;
    mockWorkers.set(name, this);
  }
  async processJob(jobData: any) {
    try {
      await this.processor(jobData as Job);
    } catch (e) {
      console.error(`[MockWorker] ${this.name} job ${jobData.id} failed:`, e);
    }
  }
  on() {}
}

/**
 * Creates a BullMQ Queue with standard connection settings.
 */
export function createQueue(name: string) {
  if (!connection) return new MockQueue(name) as any;
  return new Queue(name, { connection: connection as any });
}

/**
 * Creates a BullMQ Worker to process jobs for a specific queue.
 */
export function createWorker(
  name: string,
  processor: (job: Job) => Promise<any>,
  concurrency: number = 5
) {
  if (!connection) {
    console.log(`[BullMQ] Creating in-memory mock worker for ${name}`);
    return new MockWorker(name, processor) as any;
  }
  const worker = new Worker(name, processor, { connection: connection as any, concurrency });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ Worker] ${name} job ${job?.id} failed:`, err);
  });

  return worker;
}

/**
 * Creates a BullMQ QueueEvents listener for monitoring.
 */
export function createQueueEvents(name: string) {
  if (!connection) return { on: () => {} } as any;
  return new QueueEvents(name, { connection: connection as any });
}

// Global queues
export const adsMetricsQueue = createQueue('ads-metrics');
export const googleLeadsQueue = createQueue('google-leads');
export const campaignEngineQueue = createQueue('campaign-engine');
export const contactsQueue = createQueue('contacts');
export const campaignsQueue = createQueue('campaigns');
export const leadStudioQueue = createQueue('lead-studio');

