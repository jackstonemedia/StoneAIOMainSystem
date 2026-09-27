import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../infrastructure/database/client.js';
import Stripe from 'stripe';
import { emitTrigger } from '../services/trigger-emitter.service.js';
import { claimWebhookEvent } from '../../infrastructure/database/idempotency.js';
import { validate } from '../middleware/validate.js';

const createCheckoutSchema = {
  body: z.object({
    planId: z.string().min(1, 'planId is required'),
    returnUrl: z.string().url().optional(),
  }),
};

const createPaymentIntentSchema = {
  body: z.object({
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    dealId: z.string().min(1, 'dealId is required'),
  }),
};

const router = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in environment variables.');
  }
  return new Stripe(key, { apiVersion: '2026-04-22.dahlia' as any });
}

export const PLAN_CONFIGS: Record<string, { name: string; amount: number; creditsLimit: number }> = {
  free: { name: 'Free Plan', amount: 0, creditsLimit: 500 },
  basic: { name: 'Basic Plan', amount: 1000, creditsLimit: 5000 },
  starter: { name: 'Basic Plan', amount: 1000, creditsLimit: 5000 },
  pro: { name: 'Pro Plan', amount: 2900, creditsLimit: 25000 },
  ultra: { name: 'Ultra Plan', amount: 9900, creditsLimit: 100000 },
  team: { name: 'Ultra Plan', amount: 9900, creditsLimit: 100000 },
};

// ── 1. Create Checkout Session for Subscriptions ────────────────────────────
router.post('/billing/create-checkout-session', validate(createCheckoutSchema), async (req: Request, res: Response) => {
  try {
    const { planId, returnUrl } = req.body;
    const workspaceId = (req as any).workspaceId || 'default';
    
    if (!planId || !PLAN_CONFIGS[planId.toLowerCase()]) {
      return res.status(400).json({ error: `Invalid plan ID: ${planId}. Supported: basic, pro, ultra.` });
    }

    const normalizedPlanId = planId.toLowerCase();
    const planConfig = PLAN_CONFIGS[normalizedPlanId];
    const stripe = getStripe();

    const baseUrl = returnUrl || process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
    const successUrl = `${baseUrl}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}&success=true`;
    const cancelUrl = `${baseUrl}/settings?tab=billing&canceled=true`;

    // Check if custom Price ID exists in env, else use dynamic price_data
    const envPriceKey = `STRIPE_PRICE_${normalizedPlanId.toUpperCase()}`;
    const configuredPriceId = process.env[envPriceKey];

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

    if (configuredPriceId) {
      lineItems = [{ price: configuredPriceId, quantity: 1 }];
    } else {
      lineItems = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Stone AIO ${planConfig.name}`,
            description: `Access to Stone AIO ${planConfig.name} (${planConfig.creditsLimit.toLocaleString()} monthly AI credits).`,
          },
          unit_amount: planConfig.amount,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }];
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: workspaceId,
      metadata: {
        workspaceId,
        planId,
      },
      subscription_data: {
        metadata: {
          workspaceId,
          planId,
        },
      },
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('[Stripe] Checkout session creation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to initiate checkout session.' });
  }
});

// ── 2. Verify Session after Checkout Redirect ───────────────────────────────
router.post('/billing/verify-session', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    const workspaceId = (req as any).workspaceId || 'default';
    if (!sessionId) return res.status(400).json({ error: 'Session ID is required' });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid' || session.status === 'complete') {
      const targetWsId = session.client_reference_id || session.metadata?.workspaceId || workspaceId;
      const planId = session.metadata?.planId?.toLowerCase() || 'pro';
      const planConfig = PLAN_CONFIGS[planId] || { name: 'Pro Plan', creditsLimit: 25000 };

      const updatedWs = await (db as any).workspace.update({
        where: { id: targetWsId },
        data: {
          plan: planId,
          stripeCustomerId: (session.customer as string) || undefined,
          stripeSubscriptionId: (session.subscription as string) || undefined,
          subscriptionStatus: 'active',
          creditsLimit: planConfig.creditsLimit,
        }
      }).catch((err: any) => {
        console.warn('[Stripe Verify] Workspace update failed:', err);
        return null;
      });

      await emitTrigger(targetWsId, 'subscription.activated', {
        planId,
        customerId: session.customer,
        subscriptionId: session.subscription,
      }).catch(() => {});

      return res.json({
        success: true,
        plan: planId,
        planName: planConfig.name,
        creditsLimit: planConfig.creditsLimit,
        workspace: updatedWs,
      });
    }

    return res.json({ success: false, status: session.status });
  } catch (err: any) {
    console.error('[Stripe Verify] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to verify session' });
  }
});

// ── 3. Dev / Sandbox Plan Switcher ───────────────────────────────────────────
router.post('/billing/dev-set-plan', async (req: Request, res: Response) => {
  try {
    const { planId } = req.body;
    const workspaceId = (req as any).workspaceId || 'default';
    const normalizedPlan = planId?.toLowerCase() || 'free';

    const planConfig = PLAN_CONFIGS[normalizedPlan] || { name: 'Free Plan', creditsLimit: 500 };

    const updated = await (db as any).workspace.update({
      where: { id: workspaceId },
      data: {
        plan: normalizedPlan,
        creditsLimit: planConfig.creditsLimit,
        subscriptionStatus: normalizedPlan === 'free' ? 'inactive' : 'active',
      }
    });

    return res.json({ success: true, plan: normalizedPlan, workspace: updated });
  } catch (err: any) {
    console.error('[Billing dev-set-plan] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── 4. Create Stripe Customer Portal Session ─────────────────────────────────
router.post('/billing/create-portal-session', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId || 'default';
    const stripe = getStripe();

    let customerId: string | null = null;
    const ws = await (db as any).workspace.findUnique({ where: { id: workspaceId } });
    customerId = ws?.stripeCustomerId || null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { workspaceId },
        name: ws?.name || 'Workspace Owner',
      });
      customerId = customer.id;
      await (db as any).workspace.update({
        where: { id: workspaceId },
        data: { stripeCustomerId: customerId },
      });
    }

    const baseUrl = process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings?tab=billing`,
    });

    return res.json({ url: portalSession.url });
  } catch (error: any) {
    console.error('[Stripe] Portal session error:', error);
    return res.status(500).json({ error: error.message || 'Failed to open customer portal.' });
  }
});

// ── 5. Subscription Status & Credits ─────────────────────────────────────────
router.get('/billing/subscription-status', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId || 'default';
    const ws = await (db as any).workspace.findUnique({ where: { id: workspaceId } });

    let activeSubscription: any = null;
    let paymentMethod: any = null;

    if (ws?.stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = getStripe();
        const subs = await stripe.subscriptions.list({
          customer: ws.stripeCustomerId,
          status: 'all',
          limit: 1,
        });
        if (subs.data.length > 0) {
          activeSubscription = subs.data[0];
          if (activeSubscription.default_payment_method) {
            const pmId = typeof activeSubscription.default_payment_method === 'string'
              ? activeSubscription.default_payment_method
              : activeSubscription.default_payment_method.id;
            paymentMethod = await stripe.paymentMethods.retrieve(pmId);
          }
        }
      } catch (err) {
        console.warn('[Stripe] Failed to retrieve subscription details:', err);
      }
    }

    const currentPlan = ws?.plan || 'free';
    const config = PLAN_CONFIGS[currentPlan] || { name: 'Free Plan', amount: 0, creditsLimit: 500 };

    return res.json({
      plan: currentPlan,
      planName: config.name,
      creditsUsed: (ws as any)?.creditsUsed ?? 0,
      creditsLimit: (ws as any)?.creditsLimit ?? config.creditsLimit,
      subscription: activeSubscription,
      paymentMethod: paymentMethod?.card ? {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
      } : null,
    });
  } catch (error: any) {
    console.error('[Stripe] Subscription status error:', error);
    return res.status(500).json({ error: error.message || 'Failed to retrieve subscription status.' });
  }
});

// ── 4. Invoices List ─────────────────────────────────────────────────────────
router.get('/billing/invoices', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId || 'default';
    const ws = await (db as any).workspace.findUnique({ where: { id: workspaceId } });

    if (!ws?.stripeCustomerId || !process.env.STRIPE_SECRET_KEY) {
      return res.json({ invoices: [] });
    }

    const stripe = getStripe();
    const invoices = await stripe.invoices.list({
      customer: ws.stripeCustomerId,
      limit: 10,
    });

    const formatted = invoices.data.map(inv => ({
      id: inv.number || inv.id,
      date: new Date(inv.created * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      amount: `$${((inv.amount_paid || inv.total) / 100).toFixed(2)}`,
      status: inv.status === 'paid' ? 'Paid' : inv.status || 'Pending',
      pdfUrl: inv.invoice_pdf || inv.hosted_invoice_url,
    }));

    return res.json({ invoices: formatted });
  } catch (error: any) {
    console.error('[Stripe] Invoices error:', error);
    return res.status(500).json({ error: error.message || 'Failed to load invoices.' });
  }
});

// ── 5. CRM Client Invoicing (Deals/Opportunities) ────────────────────────────
router.post('/stripe/create-payment-intent', validate(createPaymentIntentSchema), async (req: Request, res: Response) => {
  try {
    const { amount, dealId } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount is required' });

    let contactEmail: string | null = null;
    let deal = null;

    if (dealId) {
      deal = await db.deal.findUnique({
        where: { id: dealId },
        include: { contact: true }
      });
      if (deal?.contact?.email) contactEmail = deal.contact.email;
    }

    if (!contactEmail) {
      return res.status(400).json({ error: 'No contact email found. Link a contact with an email to this deal.' });
    }

    const stripe = getStripe();

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

    return res.json({ success: true, invoiceId: invoice.id });
  } catch (error: any) {
    console.error('Stripe error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate invoice' });
  }
});

// ── 6. Standalone Public Webhook Handler ─────────────────────────────────────
export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'];
  const primarySecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secondarySecret = 'whsec_NeD7VNGrHGqZTLkBgPe02WYQCVs5pWW4';

  let event: Stripe.Event | null = null;

  try {
    const stripe = getStripe();
    const secrets = [primarySecret, secondarySecret].filter(Boolean) as string[];

    if (sig && secrets.length > 0) {
      let lastErr: any = null;
      for (const secret of secrets) {
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, secret);
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!event && lastErr) {
        throw lastErr;
      }
    } else {
      event = typeof req.body === 'string' || Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString())
        : req.body;
    }
  } catch (err: any) {
    console.error('[Stripe Webhook] Verification error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (!event) {
    return res.status(400).send('Invalid event payload');
  }

  // P1.2: Check idempotency to prevent duplicate processing on retried webhooks
  if (event.id) {
    const isNew = await claimWebhookEvent('stripe', event.id, { type: event.type });
    if (!isNew) {
      console.log(`[Stripe Webhook] Duplicate event ${event.id} (${event.type}) ignored.`);
      return res.json({ received: true, duplicate: true });
    }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.client_reference_id || session.metadata?.workspaceId;
        const planId = session.metadata?.planId || 'pro';
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (workspaceId) {
          const planConfig = PLAN_CONFIGS[planId] || { creditsLimit: 25000 };
          await (db as any).workspace.update({
            where: { id: workspaceId },
            data: {
              plan: planId,
              stripeCustomerId: customerId || undefined,
              stripeSubscriptionId: subscriptionId || undefined,
              subscriptionStatus: 'active',
              creditsLimit: planConfig.creditsLimit,
            },
          }).catch((e: any) => console.error('[Stripe Webhook] Workspace update error:', e));

          await emitTrigger(workspaceId, 'subscription.activated', {
            planId,
            customerId,
            subscriptionId,
          }).catch(() => {});
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const ws = customerId ? await (db as any).workspace.findFirst({ where: { stripeCustomerId: customerId } }) : null;
        if (ws) {
          await (db as any).workspace.update({
            where: { id: ws.id },
            data: {
              subscriptionStatus: sub.status,
            },
          }).catch(() => {});
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const ws = customerId ? await (db as any).workspace.findFirst({ where: { stripeCustomerId: customerId } }) : null;
        if (ws) {
          await (db as any).workspace.update({
            where: { id: ws.id },
            data: {
              plan: 'free',
              subscriptionStatus: 'canceled',
              creditsLimit: 500,
            },
          }).catch(() => {});

          await emitTrigger(ws.id, 'subscription.canceled', {
            customerId,
            subscriptionId: sub.id,
          }).catch(() => {});
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const dealId = invoice.metadata?.dealId;

        if (dealId) {
          await db.deal.update({
            where: { id: dealId },
            data: { pipelineStageId: 'won' }
          }).catch(() => {});

          await db.activity.create({
            data: {
              dealId,
              type: 'payment',
              title: 'Invoice Paid',
              notes: `Stripe invoice ${invoice.id} for $${((invoice.amount_paid || 0) / 100).toFixed(2)} was paid.`,
            }
          }).catch(() => {});
        }

        const customerId = invoice.customer as string;
        const ws = customerId ? await (db as any).workspace.findFirst({ where: { stripeCustomerId: customerId } }) : null;
        const workspaceId = invoice.metadata?.workspaceId || ws?.id || 'default';

        await emitTrigger(workspaceId, 'payment.received', {
          invoiceId: invoice.id,
          amount: (invoice.amount_paid || 0) / 100,
          currency: invoice.currency,
          customerId,
          paidAt: new Date().toISOString(),
        }).catch(console.error);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const ws = customerId ? await (db as any).workspace.findFirst({ where: { stripeCustomerId: customerId } }) : null;
        const workspaceId = invoice.metadata?.workspaceId || ws?.id || 'default';

        await emitTrigger(workspaceId, 'payment.failed', {
          invoiceId: invoice.id,
          amount: (invoice.amount_due || 0) / 100,
          customerId,
        }).catch(console.error);
        break;
      }

      default:
        break;
    }

    return res.json({ received: true });
  } catch (e: any) {
    console.error('[Stripe Webhook] Processing error:', e);
    return res.status(500).send('Server Error');
  }
}

// Router-level webhook listener fallback
router.post('/stripe/webhook', stripeWebhookHandler);

export default router;
