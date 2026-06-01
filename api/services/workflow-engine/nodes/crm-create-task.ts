'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';
import { createTask } from '../../crm.service.js';

/**
 * CRM Create Task node.
 *
 * Creates a new task record in the CRM system with the provided details.
 *
 * Configuration:
 *   - title        (text, required)        — Task title
 *   - contactId    (text)                  — Associated contact ID
 *   - companyId    (text)                  — Associated company ID
 *   - dealId       (text)                  — Associated deal ID
 *   - dueDate      (datetime)              — Task due date
 *   - description  (textarea)              — Task description / notes
 *   - status       (select)                — Initial status: todo, in_progress, done
 *   - priority     (select)                — Priority: low, medium, high, urgent
 */
export const crmCreateTask: NodeImplementation = {
  type: 'crm.create_task',
  category: 'crm',
  displayName: 'Create Task',
  description: 'Create a new task record in the CRM.',
  iconName: 'check-square',
  color: '#10B981',
  outputHandles: [{ id: 'default', label: 'Created', color: '#10B981' }],
  configSchema: [
    {
      key: 'title',
      label: 'Task Title',
      type: 'text',
      required: true,
    },
    {
      key: 'contactId',
      label: 'Contact ID',
      type: 'text',
    },
    {
      key: 'companyId',
      label: 'Company ID',
      type: 'text',
    },
    {
      key: 'dealId',
      label: 'Deal ID',
      type: 'text',
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      type: 'datetime',
    },
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'To Do', value: 'todo' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Done', value: 'done' },
      ],
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'select',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Urgent', value: 'urgent' },
      ],
    },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    if (!config.title) {
      throw new Error('Task title is required to create a task.');
    }

    try {
      const workspaceId = (config.workspaceId as string) ?? context.workspaceId;

      const taskData = {
        title: config.title,
        contactId: config.contactId,
        companyId: config.companyId,
        dealId: config.dealId,
        dueDate: config.dueDate,
        description: config.description,
        status: config.status,
        priority: config.priority,
      };

      const task = await createTask(workspaceId, taskData);

      return {
        output: [
          {
            json: {
              taskId: task.id,
              title: task.title,
              contactId: task.contactId,
              companyId: task.companyId,
              dealId: task.dealId,
              dueDate: task.dueDate,
              description: task.description,
              status: task.status,
              priority: task.priority,
              ...task,
            },
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create task: ${message}`);
    }
  },
};
