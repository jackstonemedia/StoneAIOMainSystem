import express from 'express';
import twilio from 'twilio';
import { Resend } from 'resend';
import { db } from '../src/lib/db.js';

const router = express.Router();

// Initialize SDKs (They will fail gracefully if keys are missing from process.env)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || 'ACmock_sid_that_is_34_chars_long_12',
  process.env.TWILIO_AUTH_TOKEN || 'mock_token'
);
const resend = new Resend(process.env.RESEND_API_KEY || 're_mock123');
const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '+1234567890';
const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

// POST /api/crm/actions/sms
router.post('/sms', async (req, res) => {
  try {
    const { contactId, message } = req.body;
    
    // 1. Get contact details
    const contact = await db.contact.findUnique({ where: { id: contactId } });
    if (!contact || !contact.phone) {
      return res.status(400).json({ error: 'Contact not found or missing phone number' });
    }

    // 2. Send SMS using Twilio
    const twilioResponse = await twilioClient.messages.create({
      body: message,
      from: twilioPhone,
      to: contact.phone
    });

    // 3. Log event into contact_events
    const event = await db.contactEvent.create({
      data: {
        contactId,
        type: 'sms',
        title: 'Outbound SMS',
        content: message,
        metadata: JSON.stringify({ twilioMessageId: twilioResponse.sid, status: twilioResponse.status })
      }
    });

    // Update last contacted
    await db.contact.update({
      where: { id: contactId },
      data: { lastContactedAt: new Date() }
    });

    res.json({ success: true, event });
  } catch (err: any) {
    console.error('Twilio SMS Error:', err);
    res.status(500).json({ error: 'Failed to send SMS', details: err.message });
  }
});

// POST /api/crm/actions/email
router.post('/email', async (req, res) => {
  try {
    const { contactId, subject, body } = req.body;
    
    // 1. Get contact details
    const contact = await db.contact.findUnique({ where: { id: contactId } });
    if (!contact || !contact.email) {
      return res.status(400).json({ error: 'Contact not found or missing email address' });
    }

    // 2. Send Email using Resend
    const resendResponse = await resend.emails.send({
      from: `Stone AIO <${resendFromEmail}>`,
      to: [contact.email],
      subject: subject,
      html: body
    });

    // 3. Log event into contact_events
    const event = await db.contactEvent.create({
      data: {
        contactId,
        type: 'email',
        title: `Email: ${subject}`,
        content: body,
        metadata: JSON.stringify({ resendId: resendResponse.data?.id, status: resendResponse.error ? 'error' : 'sent' })
      }
    });

    // Update last contacted
    await db.contact.update({
      where: { id: contactId },
      data: { lastContactedAt: new Date() }
    });

    res.json({ success: true, event });
  } catch (err: any) {
    console.error('Resend Email Error:', err);
    res.status(500).json({ error: 'Failed to send Email', details: err.message });
  }
});

// POST /api/crm/actions/notes
router.post('/notes', async (req, res) => {
  try {
    const { contactId, note } = req.body;
    
    const event = await db.contactEvent.create({
      data: {
        contactId,
        type: 'note',
        title: 'Internal Note',
        content: note
      }
    });
    
    res.json({ success: true, event });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add note' });
  }
});

export default router;
