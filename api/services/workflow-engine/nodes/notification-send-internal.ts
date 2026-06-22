'use strict';
import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';
import { db } from '../../../../infrastructure/database/client.js';

export const notificationSendInternal: NodeImplementation = {
  type: 'notification.send_internal',
  category: 'communication',
  displayName: 'Send Notification',
  description: 'Create an in-app notification for the workspace.',
  iconName: 'bell',
  color: '#6366F1',
  outputHandles: [{ id: 'default', label: 'Sent', color: '#6366F1' }],
  configSchema: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'body', label: 'Body', type: 'textarea' },
    { key: 'type', label: 'Type', type: 'select', options: [
      { label: 'Info', value: 'info' },
      { label: 'Success', value: 'success' },
      { label: 'Warning', value: 'warning' },
      { label: 'Error', value: 'error' },
    ]},
    { key: 'link', label: 'Link URL (optional)', type: 'text' },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const title = config.title as string;
    if (!title) throw new Error('Notification title is required.');

    const notification = await db.notification.create({
      data: {
        workspaceId: context.workspaceId,
        title,
        body: (config.body as string) || null,
        type: (config.type as string) || 'info',
        link: (config.link as string) || null,
      },
    });

    return { output: [{ json: { notificationId: notification.id, title } }] };
  },
};
