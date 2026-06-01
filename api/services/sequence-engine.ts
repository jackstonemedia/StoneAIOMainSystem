/**
 * Sequence Engine
 * 
 * Processes enrolled contacts through multi-step automated follow-up sequences.
 * Supports email, SMS, wait steps, and conditional skips on reply.
 * Uses the same Gmail/Resend sending logic as campaigns and workflow nodes.
 */

import { db } from '../../infrastructure/database/client.js';
import { sendGmailMessage } from './channels/gmail.service.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SequenceStepDef {
  id: string;
  type: 'email' | 'sms' | 'wait';
  delayMinutes: number;       // how long after previous step (0 for first step)
  subject?: string;           // email only
  body?: string;              // email/SMS body template
  html?: boolean;             // email only
}

interface EnrollmentProgress {
  currentStepIndex: number;
  stepScheduledAt: string;    // ISO when the next step is due
  startedAt: string;          // when the enrollment started
}

// ── Email/SMS Sending (reused pattern from campaign-engine) ───────────────────

async function sendEmail(to: string, subject: string, body: string, html: boolean, workspaceId: string): Promise<{ success: boolean; messageId?: string; provider?: string; error?: string }> {
  // Try Gmail first
  if (process.env.GMAIL_CLIENT_ID) {
    const gmailConn = await db.channelConnection.findFirst({
      where: { workspaceId, provider: 'gmail', isActive: true },
    }).catch(() => null);

    if (gmailConn?.credentialsJson) {
      try {
        const result = await sendGmailMessage(gmailConn.id, to, subject, body, undefined, html ? body : undefined);
        return { success: true, messageId: result?.messageId, provider: 'gmail' };
      } catch (gmailErr) {
        console.warn('[Sequence] Gmail send failed:', gmailErr);
      }
    }
  }

  // Fallback: Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const Resend = (await import('resend')).Resend;
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: 'info@stoneaio.com',
        to: [to],
        subject,
        ...(html ? { html: body } : { text: body }),
      });
      if (error) return { success: false, error: error.message };
      return { success: true, messageId: data?.id, provider: 'resend' };
    } catch (resendErr: any) {
      return { success: false, error: resendErr.message || String(resendErr) };
    }
  }

  return { success: false, error: 'No email provider configured' };
}

// ── Template Substitution ─────────────────────────────────────────────────────

function substituteTemplate(template: string, contact: { firstName?: string | null; lastName?: string | null; email?: string | null; company?: { name?: string | null } | null }): string {
  return template
    .replace(/\{\{first_name\}\}/gi, contact.firstName || 'there')
    .replace(/\{\{last_name\}\}/gi, contact.lastName || '')
    .replace(/\{\{email\}\}/gi, contact.email || '')
    .replace(/\{\{company_name\}\}/gi, contact.company?.name || 'your company');
}

// ── Sequence Processing ──────────────────────────────────────────────────────

/**
 * Process ONE enrollment that is due. Called by the sequence worker interval.
 */
async function processEnrollment(
  enrollment: any,
  steps: SequenceStepDef[],
): Promise<void> {
  const progress = JSON.parse((enrollment as any).sequenceData || '{}') as EnrollmentProgress;
  const stepIdx = progress.currentStepIndex;

  if (stepIdx >= steps.length) {
    // All steps done — mark completed
    await db.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    return;
  }

  const now = new Date();
  const stepDueAt = new Date(progress.stepScheduledAt);
  if (now < stepDueAt) {
    return; // Not due yet
  }

  const step = steps[stepIdx];
  const contact = await db.contact.findUnique({
    where: { id: enrollment.contactId },
    include: { company: true },
  });

  if (!contact) {
    await db.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'cancelled' },
    });
    return;
  }

  // Check skip-on-reply: if contact has replied since enrollment, skip remaining
  if (step.type !== 'wait') {
    const hasReplied = await db.activity.findFirst({
      where: {
        contactId: contact.id,
        type: 'email_received',
        createdAt: { gte: new Date(progress.startedAt) },
      },
    });
    if (hasReplied) {
      await db.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      await db.activity.create({
        data: {
          workspaceId: enrollment.workspaceId,
          contactId: contact.id,
          type: 'info',
          title: 'Sequence skipped — contact replied',
          notes: `Contact replied, removed from sequence "${enrollment.sequence.name}"`,
        },
      }).catch(() => {});
      return;
    }
  }

  // Execute the step
  if (step.type === 'wait') {
    // Just advance to next step
    const nextStep = steps[stepIdx + 1];
    if (!nextStep) {
      await db.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      return;
    }
    const nextDueAt = new Date(now.getTime() + nextStep.delayMinutes * 60 * 1000);
    await db.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        sequenceData: JSON.stringify({
          currentStepIndex: stepIdx + 1,
          stepScheduledAt: nextDueAt.toISOString(),
          startedAt: progress.startedAt,
        } as EnrollmentProgress),
      },
    });
    return;
  }

  if (step.type === 'email' && contact.email) {
    const subject = substituteTemplate(step.subject || '', contact);
    const body = substituteTemplate(step.body || '', contact);
    const result = await sendEmail(contact.email, subject, body, step.html !== false, enrollment.workspaceId);

    if (result.success) {
      await db.activity.create({
        data: {
          workspaceId: enrollment.workspaceId,
          contactId: contact.id,
          type: 'email_sent',
          title: `Sequence email: ${step.subject || '(no subject)'}`,
          notes: `Sent to ${contact.email} via ${result.provider}`,
        },
      }).catch(() => {});
    } else {
      console.warn(`[Sequence] Email failed for ${contact.email}:`, result.error);
    }

    // Advance to next step
    advanceEnrollment(enrollment, stepIdx, steps);
  }

  if (step.type === 'sms' && contact.phone) {
    try {
      const twilioConn = await db.channelConnection.findFirst({
        where: { workspaceId: enrollment.workspaceId, provider: 'twilio', isActive: true },
      });
      if (twilioConn && twilioConn.twilioPhoneNumber) {
        const { decryptJson } = await import('./channels/encryption.js');
        const creds = decryptJson(twilioConn.credentialsJson as string) as { accountSid: string; authToken: string };
        const twilio = (await import('twilio')).default;
        await twilio(creds.accountSid, creds.authToken).messages.create({
          body: step.body || '',
          from: twilioConn.twilioPhoneNumber,
          to: contact.phone,
        });
      }
      await db.activity.create({
        data: {
          workspaceId: enrollment.workspaceId,
          contactId: contact.id,
          type: 'sms_sent',
          title: 'Sequence SMS sent',
          notes: `Sent to ${contact.phone}`,
        },
      }).catch(() => {});
    } catch (err) {
      console.error(`[Sequence] SMS failed for ${contact.phone}:`, err);
    }
    advanceEnrollment(enrollment, stepIdx, steps);
  }
}

async function advanceEnrollment(enrollment: any, currentIdx: number, steps: SequenceStepDef[]): Promise<void> {
  const nextIdx = currentIdx + 1;
  const progress = JSON.parse((enrollment as any).sequenceData || '{}') as EnrollmentProgress;

  if (nextIdx >= steps.length) {
    await db.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    return;
  }

  const nextStep = steps[nextIdx];
  const nextDueAt = new Date(Date.now() + nextStep.delayMinutes * 60 * 1000);

  await db.sequenceEnrollment.update({
    where: { id: enrollment.id },
    data: {
      sequenceData: JSON.stringify({
        currentStepIndex: nextIdx,
        stepScheduledAt: nextDueAt.toISOString(),
        startedAt: progress.startedAt,
      } as EnrollmentProgress),
    },
  });
}

// ── Enrollment API ─────────────────────────────────────────────────────────────

export async function enrollContact(
  sequenceId: string,
  contactId: string,
  workspaceId: string,
): Promise<{ success: boolean; enrollmentId?: string; nextStepAt?: string; error?: string }> {
  const sequence = await db.sequence.findUnique({ where: { id: sequenceId, workspaceId } });
  if (!sequence) return { success: false, error: 'Sequence not found' };
  if ((sequence as any).status !== 'active') return { success: false, error: 'Sequence is not active' };

  const contact = await db.contact.findUnique({ where: { id: contactId, workspaceId } });
  if (!contact) return { success: false, error: 'Contact not found' };

  // Check if already enrolled
  const existing = await db.sequenceEnrollment.findFirst({
    where: { sequenceId, contactId, status: { in: ['active', 'paused'] } },
  });
  if (existing) return { success: false, error: 'Contact already enrolled' };

  const steps = JSON.parse((sequence as any).stepsJson || '[]') as SequenceStepDef[];
  if (steps.length === 0) return { success: false, error: 'Sequence has no steps' };

  // First step is due immediately
  const firstStep = steps[0];
  const firstDueAt = firstStep.delayMinutes > 0
    ? new Date(Date.now() + firstStep.delayMinutes * 60 * 1000)
    : new Date();

  const enrollment = await db.sequenceEnrollment.create({
    data: {
      sequenceId,
      contactId,
      status: 'active',
      sequenceData: JSON.stringify({
        currentStepIndex: 0,
        stepScheduledAt: firstDueAt.toISOString(),
        startedAt: new Date().toISOString(),
      } as EnrollmentProgress),
    },
  });

  return { success: true, enrollmentId: enrollment.id, nextStepAt: firstDueAt.toISOString() };
}

export async function getEnrollmentProgress(enrollmentId: string): Promise<any> {
  const enrollment = await db.sequenceEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { sequence: true, contact: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  if (!enrollment) return null;

  const steps = JSON.parse((enrollment.sequence as any).stepsJson || '[]') as SequenceStepDef[];
  const progress = JSON.parse((enrollment as any).sequenceData || '{}') as EnrollmentProgress;

  return {
    ...enrollment,
    totalSteps: steps.length,
    stepsCompleted: progress.currentStepIndex,
    currentStep: steps[progress.currentStepIndex] || null,
    nextStepDueAt: progress.stepScheduledAt,
  };
}
