import { Request, Response } from 'express';
import { db } from '../../infrastructure/database/client.js';
import { emitTrigger } from '../services/trigger-emitter.service.js';

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

    // Slice 1c: a captured contact is a real contact.created, and the
    // capture itself is a form.submitted with no page (pageId-less, so it
    // matches "any page" FORM_SUBMITTED configs only).
    emitTrigger(workspaceId, 'contact.created', { contactId: contact.id, email: email || null, source: 'Web Form' }).catch(() => {});
    emitTrigger(workspaceId, 'form.submitted', { contactId: contact.id }).catch(() => {});

    res.status(201).json({ success: true, contactId: contact.id });
  } catch (error) {
    console.error('[Form Capture Webhook] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
