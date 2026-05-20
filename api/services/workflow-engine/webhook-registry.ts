import { Request, Response } from 'express';
import { db } from '../../../infrastructure/database/client.js';
import { queueService } from './queue.service';
import { randomBytes } from 'crypto';

interface WebhookConfig {
  workspaceId: string;
  workflowId: string;
  nodeId: string;
  method: string;
  secret: string | null;
}

export class WebhookRegistry {
  private webhooks: Map<string, WebhookConfig> = new Map();
  
  async initialize(): Promise<void> {
    const hooks = await db.workflowWebhook.findMany({
      where: { active: true }
    });
    
    for (const hook of hooks) {
      this.webhooks.set(hook.path, {
        workspaceId: hook.workspaceId,
        workflowId: hook.workflowId,
        nodeId: hook.nodeId,
        method: hook.method,
        secret: hook.secret
      });
    }
    console.log(`Workflow Engine: Loaded ${hooks.length} webhooks into registry`);
  }
  
  async registerWebhook(params: {
    workspaceId: string;
    workflowId: string;
    nodeId: string;
    method: string;
    secret?: string;
  }): Promise<{ path: string; fullUrl: string }> {
    const { workspaceId, workflowId, nodeId, method, secret } = params;
    
    const path = `/hooks/${randomBytes(8).toString('hex')}`;
    
    await db.workflowWebhook.create({
      data: {
        workspaceId,
        workflowId,
        nodeId,
        path,
        method,
        secret: secret || null,
        active: true
      }
    });
    
    this.webhooks.set(path, { workspaceId, workflowId, nodeId, method, secret: secret || null });
    
    const appUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
    return { path, fullUrl: `${appUrl}/api${path}` };
  }
  
  async unregisterWebhook(workflowId: string, nodeId: string): Promise<void> {
    const hook = await db.workflowWebhook.findFirst({
      where: { workflowId, nodeId }
    });
    
    if (hook) {
      await db.workflowWebhook.delete({ where: { id: hook.id } });
      this.webhooks.delete(hook.path);
    }
  }
  
  async reload(): Promise<void> {
    this.webhooks.clear();
    await this.initialize();
  }
  
  getByPath(path: string): WebhookConfig | undefined {
    return this.webhooks.get(path);
  }
}

export const webhookRegistry = new WebhookRegistry();

export async function webhookHandler(req: Request, res: Response): Promise<void> {
  const path = req.path;
  
  const config = webhookRegistry.getByPath(path);
  if (!config) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }
  
  if (config.method !== 'ALL' && req.method !== config.method) {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  if (config.secret) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader.replace('Bearer ', '') !== config.secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
  
  const triggerData = {
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query,
    params: req.params
  };
  
  try {
    await queueService.enqueue({
      workspaceId: config.workspaceId,
      workflowId: config.workflowId,
      triggerData,
      mode: 'production'
    });
    
    res.status(200).json({ accepted: true });
  } catch (err: any) {
    console.error('Webhook execution failed:', err);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
}
