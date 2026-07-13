import { Request, Response, NextFunction } from 'express';
import { db } from '../../infrastructure/database/client.js';

export async function resolveInboxChannel(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-inbox-token'] || req.query.inboxToken;
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Missing inbox token' });
  }

  const channel = await db.inboxChannel.findUnique({ 
    where: { embedToken: token },
    include: { workspace: true }
  });

  if (!channel || !channel.isEnabled) {
    return res.status(401).json({ error: 'Invalid or disabled token' });
  }
  
  (req as any).inboxChannel = channel;
  (req as any).workspaceId = channel.workspaceId;
  next();
}
