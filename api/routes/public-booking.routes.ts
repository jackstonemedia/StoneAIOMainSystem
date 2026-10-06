/**
 * Public Calendar Booking Routes — Native Outreach & Scheduling Engine
 *
 * Unauthenticated endpoints for public leads & prospects to:
 * 1. View booking page profile & duration options (15m, 30m, 45m, 60m).
 * 2. Fetch live real-time available time slots without double-booking.
 * 3. Book discovery meetings (creates CRM Contact + Appointment + emits 'appointment.booked').
 * 4. Download RFC 5545 .ics calendar invites for Google Calendar & Outlook.
 */

import { Router, Request, Response } from 'express';
import { db } from '../../infrastructure/database/client.js';
import { getAvailableSlots, bookPublicAppointment } from '../services/business.service.js';

const router = Router();

/**
 * Resolves a workspace from a slug, UUID, or 'default' fallback.
 */
async function resolveWorkspaceFromSlug(slug: string) {
  if (!slug || slug === 'default') {
    return await db.workspace.findFirst({
      orderBy: { createdAt: 'asc' },
    });
  }

  // 1. Direct match on UUID id
  const byId = await db.workspace.findUnique({
    where: { id: slug },
  });
  if (byId) return byId;

  // 2. Slug match against workspace name
  const allWorkspaces = await db.workspace.findMany();
  const matched = allWorkspaces.find((w) => {
    const s = w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return s === slug.toLowerCase() || w.name.toLowerCase() === slug.toLowerCase();
  });

  return matched || allWorkspaces[0] || null;
}

/**
 * Formats a JavaScript Date into iCalendar UTC timestamp: YYYYMMDDTHHmmssZ
 */
function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generates an RFC 5545 standard .ics file string
 */
function generateIcs(appointment: {
  id: string;
  title: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  location?: string | null;
  organizerName?: string;
  organizerEmail?: string;
}): string {
  const now = new Date();
  const uid = `${appointment.id}@stoneaio.com`;
  const summary = (appointment.title || 'Discovery Session').replace(/\n/g, ' ');
  const description = (appointment.description || 'Confirmed discovery session with Stone AIO.').replace(/\n/g, '\\n');
  const location = (appointment.location || 'Online Video Meeting (Link provided via email)').replace(/\n/g, ' ');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stone AIO//Scheduling Engine//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(appointment.startTime)}`,
    `DTEND:${formatIcsDate(appointment.endTime)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `STATUS:CONFIRMED`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

// ── 1. GET /booking-info/:slug ──────────────────────────────────────────────
router.get('/booking-info/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const workspace = await resolveWorkspaceFromSlug(slug);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const availableDurations = [15, 30, 45, 60];
    const generatedSlug = workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || workspace.id;

    res.json({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      slug: generatedSlug,
      bookingTitle: `Discovery Session with ${workspace.name}`,
      bookingDescription: 'Pick a date and time that works best for you to discuss your objectives, questions, and strategy.',
      availableDurations,
      defaultDuration: 30,
    });
  } catch (err: any) {
    console.error('[PublicBooking] Failed to fetch booking info:', err);
    res.status(500).json({ error: 'Failed to load booking info' });
  }
});

// ── 2. GET /slots/:slug ─────────────────────────────────────────────────────
router.get('/slots/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const workspace = await resolveWorkspaceFromSlug(slug);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const date = (req.query.date as string) || new Date().toISOString();
    const durationMinutes = Number(req.query.durationMinutes) || 30;

    const slots = await getAvailableSlots(workspace.id, { date, durationMinutes });
    res.json(slots);
  } catch (err: any) {
    console.error('[PublicBooking] Failed to fetch available slots:', err);
    res.status(500).json({ error: 'Failed to load available slots' });
  }
});

// ── 3. POST /book/:slug ────────────────────────────────────────────────────
router.post('/book/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const workspace = await resolveWorkspaceFromSlug(slug);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const { name, email, phone, date, time, durationMinutes = 30, notes } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    if (!date || !time) {
      return res.status(400).json({ error: 'Date and time slot are required' });
    }

    // Availability validation check
    const slotCheck = await getAvailableSlots(workspace.id, { date, durationMinutes });
    if (!slotCheck.availableSlots.includes(time)) {
      return res.status(409).json({ error: 'The selected time slot is no longer available. Please select another time.' });
    }

    const result = await bookPublicAppointment(workspace.id, {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? String(phone).trim() : undefined,
      date,
      time,
      durationMinutes: Number(durationMinutes) || 30,
      notes: notes ? String(notes).trim() : undefined,
    });

    const icsUrl = `/api/public/calendar/appointment/${result.appointment.id}/ics`;

    res.status(201).json({
      success: true,
      appointment: {
        id: result.appointment.id,
        title: result.appointment.title,
        startTime: result.appointment.startTime,
        endTime: result.appointment.endTime,
        durationMinutes,
        status: result.appointment.status,
      },
      contact: {
        id: result.contact.id,
        firstName: result.contact.firstName,
        lastName: result.contact.lastName,
        email: result.contact.email,
      },
      icsUrl,
    });
  } catch (err: any) {
    console.error('[PublicBooking] Booking error:', err);
    res.status(500).json({ error: err.message || 'Failed to complete booking' });
  }
});

// ── 4. GET /appointment/:id/ics ────────────────────────────────────────────
router.get('/appointment/:id/ics', async (req: Request, res: Response) => {
  try {
    const appointment = await db.appointment.findUnique({
      where: { id: req.params.id },
      include: { workspace: true, contact: true },
    });

    if (!appointment) {
      return res.status(404).send('Appointment not found');
    }

    const icsContent = generateIcs({
      id: appointment.id,
      title: appointment.title,
      description: appointment.description,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      location: appointment.location || 'Online Meeting',
      organizerName: appointment.workspace.name,
      organizerEmail: 'support@stoneaio.com',
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="appointment-${appointment.id.slice(0, 8)}.ics"`);
    res.send(icsContent);
  } catch (err: any) {
    console.error('[PublicBooking] ICS download error:', err);
    res.status(500).send('Error generating calendar invite');
  }
});

export default router;
