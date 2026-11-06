/**
 * Calendar & Appointment Tools — Stone AIO Assistant
 * Spec Section 2.8 & Stage S3
 */

import { db } from '../../../../infrastructure/database/client.js';
import type { ToolDefinition } from './types.js';

export const calendarTools: ToolDefinition[] = [
  // 1. list_appointments
  {
    name: 'list_appointments',
    description: 'List scheduled meetings and appointments in the workspace.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'ISO start date filter.' },
        endDate: { type: 'string', description: 'ISO end date filter.' },
        contactId: { type: 'string', description: 'Contact ID filter.' },
      },
    },
    execute: async (args: { startDate?: string; endDate?: string; contactId?: string }, ctx) => {
      const appointments = await db.appointment.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...(args.contactId ? { contactId: args.contactId } : {}),
          ...(args.startDate ? { startTime: { gte: new Date(args.startDate) } } : {}),
          ...(args.endDate ? { endTime: { lte: new Date(args.endDate) } } : {}),
        },
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { startTime: 'asc' },
        take: 50,
      });

      return {
        appointments: appointments.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          startTime: a.startTime,
          endTime: a.endTime,
          location: a.location,
          status: a.status,
          contact: a.contact ? `${a.contact.firstName} ${a.contact.lastName}`.trim() : null,
        })),
        total: appointments.length,
      };
    },
  },

  // 2. book_appointment
  {
    name: 'book_appointment',
    description: 'Book a new meeting or appointment in the workspace calendar.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Appointment title.' },
        startTime: { type: 'string', description: 'ISO start time (e.g. 2026-10-25T14:00:00Z).' },
        endTime: { type: 'string', description: 'ISO end time (e.g. 2026-10-25T14:30:00Z).' },
        contactId: { type: 'string', description: 'Optional Contact ID.' },
        location: { type: 'string', description: 'Meeting location or video link.' },
        description: { type: 'string', description: 'Meeting notes or agenda.' },
      },
      required: ['title', 'startTime', 'endTime'],
    },
    execute: async (
      args: {
        title: string;
        startTime: string;
        endTime: string;
        contactId?: string;
        location?: string;
        description?: string;
      },
      ctx
    ) => {
      const appointment = await db.appointment.create({
        data: {
          workspaceId: ctx.workspaceId,
          title: args.title,
          startTime: new Date(args.startTime),
          endTime: new Date(args.endTime),
          contactId: args.contactId || null,
          location: args.location || null,
          description: args.description || null,
          status: 'scheduled',
        },
      });

      if (args.contactId && db.contactEvent && typeof db.contactEvent.create === 'function') {
        await db.contactEvent
          .create({
            data: {
              contactId: args.contactId,
              type: 'appointment',
              title: `Appointment booked: ${appointment.title}`,
              content: args.description || `Scheduled for ${args.startTime}`,
              metadataJson: JSON.stringify({
                createdByAssistant: true,
                createdForUserId: ctx.userId,
                createdForUserName: ctx.userName || 'User',
                source: 'assistant',
                appointmentId: appointment.id,
              }),
            },
          })
          .catch(() => {});
      }

      return {
        appointment: {
          id: appointment.id,
          title: appointment.title,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          status: appointment.status,
        },
        message: `Appointment "${appointment.title}" scheduled successfully.`,
      };
    },
  },

  // 3. cancel_appointment
  {
    name: 'cancel_appointment',
    description: 'Cancel a scheduled appointment.',
    risk: 'destructive',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'The UUID of the appointment to cancel.' },
        reason: { type: 'string', description: 'Optional cancellation reason.' },
      },
      required: ['appointmentId'],
    },
    execute: async (args: { appointmentId: string; reason?: string }, ctx) => {
      const existing = await db.appointment.findFirst({
        where: { id: args.appointmentId, workspaceId: ctx.workspaceId },
      });

      if (!existing) {
        throw new Error(`Appointment ${args.appointmentId} not found in workspace.`);
      }

      const updated = await db.appointment.update({
        where: { id: args.appointmentId },
        data: {
          status: 'cancelled',
          description: args.reason
            ? `${existing.description || ''}\n[Cancelled]: ${args.reason}`.trim()
            : existing.description,
        },
      });

      return {
        appointmentId: updated.id,
        status: 'cancelled',
        message: `Appointment "${updated.title}" cancelled successfully.`,
      };
    },
  },

  // 4. reschedule_appointment
  {
    name: 'reschedule_appointment',
    description: 'Reschedule an existing appointment to a new date and time.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', description: 'The UUID of the appointment to reschedule.' },
        startTime: { type: 'string', description: 'New ISO start time (e.g. 2026-10-25T14:00:00Z).' },
        endTime: { type: 'string', description: 'New ISO end time (e.g. 2026-10-25T14:30:00Z).' },
      },
      required: ['appointmentId', 'startTime', 'endTime'],
    },
    execute: async (args: { appointmentId: string; startTime: string; endTime: string }, ctx) => {
      const existing = await db.appointment.findFirst({
        where: { id: args.appointmentId, workspaceId: ctx.workspaceId },
      });

      if (!existing) {
        throw new Error(`Appointment ${args.appointmentId} not found in workspace.`);
      }

      const updated = await db.appointment.update({
        where: { id: args.appointmentId },
        data: {
          startTime: new Date(args.startTime),
          endTime: new Date(args.endTime),
          status: 'scheduled',
        },
      });

      if (existing.contactId && db.contactEvent && typeof db.contactEvent.create === 'function') {
        await db.contactEvent
          .create({
            data: {
              contactId: existing.contactId,
              type: 'appointment',
              title: `Appointment rescheduled: ${updated.title}`,
              content: `Rescheduled to ${args.startTime}`,
              metadataJson: JSON.stringify({
                createdByAssistant: true,
                createdForUserId: ctx.userId,
                createdForUserName: ctx.userName || 'User',
                source: 'assistant',
                appointmentId: updated.id,
              }),
            },
          })
          .catch(() => {});
      }

      return {
        appointment: {
          id: updated.id,
          title: updated.title,
          startTime: updated.startTime,
          endTime: updated.endTime,
        },
        message: `Appointment "${updated.title}" rescheduled successfully.`,
      };
    },
  },
];
