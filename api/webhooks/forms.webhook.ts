import { Request, Response } from 'express';
import { db } from '../../infrastructure/database/client.js';

export const formCaptureWebhook = async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    if (!workspaceId) {
      res.status(400).json({ error: 'Missing workspaceId' });
      return;
    }

    // Verify workspace exists
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true }
    });

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    const { firstName, lastName, email, phone } = req.body;

    // Create the contact
    const contact = await db.contact.create({
      data: {
        workspaceId,
        firstName: firstName || 'Unknown',
        lastName: lastName || 'Contact',
        email: email || null,
        phone: phone || null,
        source: 'Web Form',
        tagsJson: JSON.stringify(['web-lead']),
      }
    });

    res.status(201).json({ success: true, contactId: contact.id });
  } catch (error) {
    console.error('[Form Capture Webhook] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
