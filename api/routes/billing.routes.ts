import { Router } from 'express';
import { db } from '../../infrastructure/database/client.js';
import Stripe from 'stripe';
import { emitTrigger } from '../services/trigger-emitter.service.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2026-04-22.dahlia' as any,
});

// Public form submission (no auth)
router.post('/forms/:id/submit', async (req, res) => {
  try {
    const sub = await db.formSubmission.create({ data: { formId: req.params.id, data: JSON.stringify(req.body) } });
    const form = await db.form.update({ where: { id: req.params.id }, data: { visits: { increment: 1 } } }).catch(() => null);
    // Auto-create contact if email field present
    const data = req.body as Record<string, string>;
    const emailKey = Object.keys(data).find(k => k.toLowerCase().includes('email'));
    let createdContact: any = null;
    let nameVal = '';
    if (emailKey && data[emailKey]) {
      const firstKey = Object.keys(data).find(k => k.toLowerCase().includes('first') || k.toLowerCase() === 'name');
      const lastKey = Object.keys(data).find(k => k.toLowerCase().includes('last'));
      nameVal = firstKey ? data[firstKey] : '';
      const parts = nameVal.split(' ');
      createdContact = await db.contact.upsert({
        where: { id: `form_${data[emailKey].replace(/[^a-z0-9]/gi, '_')}` },
        create: { id: `form_${data[emailKey].replace(/[^a-z0-9]/gi, '_')}`, workspaceId: (req as any).workspaceId || 'default', firstName: parts[0]||nameVal||'Form', lastName: parts.slice(1).join(' ')||(lastKey ? data[lastKey!]||'Submission' : 'Submission'), email: data[emailKey], phone: data[Object.keys(data).find(k => k.toLowerCase().includes('phone'))||'']||null, source: 'form', status: 'new' },
        update: { email: data[emailKey] },
      }).catch(() => null);
    }

    emitTrigger((req as any).workspaceId || 'default', 'form.submitted', {
      formId: req.params.id,
      formName: form ? form.name : 'Unknown Form',
      submittedAt: new Date().toISOString(),
      fields: data,
      contactId: createdContact?.id,
      contactEmail: emailKey ? data[emailKey] : undefined,
      contactName: nameVal || undefined,
    }).catch(console.error);
    res.json({ success: true, id: sub.id });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Stripe endpoints
router.post('/stripe/create-payment-intent', async (req, res) => {
  try {
    const { amount, dealId } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount is required' });

    let contactEmail = 'customer@example.com';
    let deal = null;

    if (dealId) {
      deal = await db.deal.findUnique({
        where: { id: dealId },
        include: { contact: true }
      });
      if (deal?.contact?.email) {
        contactEmail = deal.contact.email;
      }
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      // Mock mode if no key provided
      return res.json({ 
        success: true, 
        message: 'Mock invoice sent (No Stripe key configured)' 
      });
    }

    // 1. Create or retrieve customer
    const customer = await stripe.customers.create({
      email: contactEmail,
      name: deal?.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : 'Client',
    });

    // 2. Create invoice item
    await stripe.invoiceItems.create({
      customer: customer.id,
      amount: Math.round(amount * 100),
      currency: 'usd',
      description: deal?.title || 'Stone AIO Services',
    });

    // 3. Create and finalize invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 7,
      metadata: { dealId: dealId || '' }
    });

    // 4. Send invoice
    await stripe.invoices.sendInvoice(invoice.id);

    res.json({ success: true, invoiceId: invoice.id });
  } catch (error: any) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate invoice' });
  }
});

// Webhook listener for Stripe events
router.post('/stripe/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (endpointSecret && sig) {
      // requires body parser as raw buffer, but express.json() is used globally.
      // Assuming we handle raw body via a middleware or skipping signature in dev for now
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      event = req.body;
    }
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const dealId = invoice.metadata?.dealId;

      if (dealId) {
        // Mark the deal as Won or add an Activity
        await db.deal.update({
          where: { id: dealId },
          data: {
            pipelineStageId: 'won' // Just an example, maybe we just add activity
          }
        }).catch(() => {});

        await db.activity.create({
          data: {
            dealId,
            type: 'payment',
            title: 'Invoice Paid',
            notes: `Stripe invoice ${invoice.id} for $${(invoice.amount_paid / 100).toFixed(2)} was paid.`,
          }
        });
      }
    }

    if (
      event.type === 'payment_intent.succeeded' ||
      event.type === 'invoice.payment_succeeded'
    ) {
      const customerId = event.data.object.customer;
      const ws = customerId ? await (db as any).workspace.findFirst({ where: { stripeCustomerId: customerId } }) : null;
      const workspaceId = event.data.object.metadata?.workspaceId || ws?.id || 'default';

      emitTrigger(workspaceId, 'payment.received', {
        paymentId: event.data.object.id,
        amount: (event.data.object.amount_received || event.data.object.amount_paid || event.data.object.amount) / 100,
        currency: event.data.object.currency,
        customerId: event.data.object.customer,
        paidAt: new Date().toISOString(),
      }).catch(console.error);
    }

    if (
      event.type === 'payment_intent.payment_failed' ||
      event.type === 'invoice.payment_failed'
    ) {
      const customerId = event.data.object.customer;
      const ws = customerId ? await (db as any).workspace.findFirst({ where: { stripeCustomerId: customerId } }) : null;
      const workspaceId = event.data.object.metadata?.workspaceId || ws?.id || 'default';

      emitTrigger(workspaceId, 'payment.failed', {
        paymentId: event.data.object.id,
        amount: event.data.object.amount / 100,
        reason: event.data.object.last_payment_error?.message || 'Payment failed',
        customerId: event.data.object.customer,
      }).catch(console.error);
    }

    res.json({ received: true });
  } catch (e) {
    console.error('Webhook processing error:', e);
    res.status(500).send('Server Error');
  }
});

export default router;
