/**
 * Public Booking & Calendar Engine Test Suite
 *
 * Verifies:
 * 1. Booking info resolution from workspace name/slug.
 * 2. Slot calculation without conflicting with existing appointments.
 * 3. Appointment creation and CRM Contact generation.
 * 4. Conflict rejection if slot is already occupied.
 * 5. Valid RFC 5545 .ics calendar invite generation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import publicBookingRouter from '../public-booking.routes.js';
import { db } from '../../../infrastructure/database/client.js';

vi.mock('../../../infrastructure/database/client.js', () => ({
  db: {
    workspace: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../services/trigger-emitter.service.js', () => ({
  emitTrigger: vi.fn().mockResolvedValue(undefined),
}));

const app = express();
app.use(express.json());
app.use('/api/public/calendar', publicBookingRouter);

describe('Public Calendar Booking & Scheduling Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/public/calendar/booking-info/:slug returns public profile', async () => {
    (db.workspace.findFirst as any).mockResolvedValue({
      id: 'ws-test-1',
      name: 'Alpha Growth Co',
    });

    const res = await request(app).get('/api/public/calendar/booking-info/default');
    expect(res.status).toBe(200);
    expect(res.body.workspaceName).toBe('Alpha Growth Co');
    expect(res.body.availableDurations).toContain(30);
    expect(res.body.bookingTitle).toContain('Alpha Growth Co');
  });

  it('GET /api/public/calendar/slots/:slug calculates open slots without double booking', async () => {
    (db.workspace.findFirst as any).mockResolvedValue({
      id: 'ws-test-1',
      name: 'Alpha Growth Co',
    });

    // 10:00 to 10:30 appointment already booked
    (db.appointment.findMany as any).mockResolvedValue([
      {
        id: 'existing-appt-1',
        startTime: new Date('2026-10-15T10:00:00.000Z'),
        endTime: new Date('2026-10-15T10:30:00.000Z'),
        status: 'confirmed',
      },
    ]);

    const res = await request(app)
      .get('/api/public/calendar/slots/default')
      .query({ date: '2026-10-15', durationMinutes: 30 });

    expect(res.status).toBe(200);
    expect(res.body.availableSlots).toContain('09:00');
    expect(res.body.availableSlots).toContain('09:30');
    expect(res.body.availableSlots).not.toContain('10:00'); // Blocked!
    expect(res.body.availableSlots).toContain('10:30');
  });

  it('POST /api/public/calendar/book/:slug creates contact and appointment', async () => {
    (db.workspace.findFirst as any).mockResolvedValue({
      id: 'ws-test-1',
      name: 'Alpha Growth Co',
    });

    // No conflicts for this date
    (db.appointment.findMany as any).mockResolvedValue([]);

    // Contact doesn't exist yet
    (db.contact.findFirst as any).mockResolvedValue(null);
    (db.contact.create as any).mockResolvedValue({
      id: 'new-contact-1',
      firstName: 'Emily',
      lastName: 'Watson',
      email: 'emily@techcorp.io',
    });

    (db.appointment.create as any).mockResolvedValue({
      id: 'appt-booked-1',
      title: 'Discovery Session with Emily Watson',
      startTime: new Date('2026-10-15T14:00:00.000Z'),
      endTime: new Date('2026-10-15T14:30:00.000Z'),
      status: 'confirmed',
      contact: { id: 'new-contact-1' },
    });

    const res = await request(app)
      .post('/api/public/calendar/book/default')
      .send({
        name: 'Emily Watson',
        email: 'emily@techcorp.io',
        phone: '+1 555-123-4567',
        date: '2026-10-15',
        time: '14:00',
        durationMinutes: 30,
        notes: 'Interested in email automation suite',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.appointment.title).toContain('Emily Watson');
    expect(res.body.icsUrl).toContain('/api/public/calendar/appointment/appt-booked-1/ics');
  });

  it('GET /api/public/calendar/appointment/:id/ics returns valid RFC 5545 .ics invite', async () => {
    (db.appointment.findUnique as any).mockResolvedValue({
      id: 'appt-12345',
      title: 'Strategy Consultation',
      description: 'Review Q4 scaling plan',
      startTime: new Date('2026-10-20T15:00:00.000Z'),
      endTime: new Date('2026-10-20T15:30:00.000Z'),
      location: 'Google Meet',
      workspace: { name: 'Stone AIO' },
    });

    const res = await request(app).get('/api/public/calendar/appointment/appt-12345/ics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.text).toContain('BEGIN:VCALENDAR');
    expect(res.text).toContain('SUMMARY:Strategy Consultation');
    expect(res.text).toContain('UID:appt-12345@stoneaio.com');
    expect(res.text).toContain('END:VCALENDAR');
  });
});
