import express from 'express';
import twilio from 'twilio';
import { Resend } from 'resend';
import { db } from '../../infrastructure/database/client.js';

const router = express.Router();

function getTwilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Resend is not configured. Set RESEND_API_KEY.');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

// POST /api/crm/actions/sms
router.post('/sms', async (req, res) => {
  try {
    const { contactId, message } = req.body;

    const contact = await db.contact.findUnique({ where: { id: contactId } });
    if (!contact || !contact.phone) {
      return res.status(400).json({ error: 'Contact not found or missing phone number' });
    }

    const twilioClient = getTwilioClient();
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER!;
    const twilioResponse = await twilioClient.messages.create({
      body: message,
      from: twilioPhone,
      to: contact.phone,
    });

    const event = await db.contactEvent.create({
      data: {
        contactId,
        type: 'sms',
        title: 'Outbound SMS',
        content: message,
        metadataJson: JSON.stringify({ twilioMessageId: twilioResponse.sid, status: twilioResponse.status }),
      },
    });

    await db.contact.update({ where: { id: contactId }, data: { lastContactedAt: new Date() } });

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

    const contact = await db.contact.findUnique({ where: { id: contactId } });
    if (!contact || !contact.email) {
      return res.status(400).json({ error: 'Contact not found or missing email address' });
    }

    const resendClient = getResendClient();
    const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const resendResponse = await resendClient.emails.send({
      from: `Stone AIO <${resendFromEmail}>`,
      to: [contact.email],
      subject,
      html: body,
    });

    const event = await db.contactEvent.create({
      data: {
        contactId,
        type: 'email',
        title: `Email: ${subject}`,
        content: body,
        metadataJson: JSON.stringify({ resendId: resendResponse.data?.id, status: resendResponse.error ? 'error' : 'sent' }),
      },
    });

    await db.contact.update({ where: { id: contactId }, data: { lastContactedAt: new Date() } });

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
      data: { contactId, type: 'note', title: 'Internal Note', content: note },
    });
    res.json({ success: true, event });
  } catch (err: any) {
    console.error('Note Error:', err);
    res.status(500).json({ error: 'Failed to save note', details: err.message });
  }
});

export default router;
