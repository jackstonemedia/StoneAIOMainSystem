import { Router } from 'express';
import { db } from '../../infrastructure/database/client.js';

const router = Router();

// Public form submission (no auth)
router.post('/forms/:id/submit', async (req, res) => {
  try {
    const sub = await db.formSubmission.create({ data: { formId: req.params.id, data: JSON.stringify(req.body) } });
    await db.form.update({ where: { id: req.params.id }, data: { visits: { increment: 1 } } }).catch(() => {});
    // Auto-create contact if email field present
    const data = req.body as Record<string, string>;
    const emailKey = Object.keys(data).find(k => k.toLowerCase().includes('email'));
    if (emailKey && data[emailKey]) {
      const firstKey = Object.keys(data).find(k => k.toLowerCase().includes('first') || k.toLowerCase() === 'name');
      const lastKey = Object.keys(data).find(k => k.toLowerCase().includes('last'));
      const nameVal = firstKey ? data[firstKey] : '';
      const parts = nameVal.split(' ');
      await db.contact.upsert({
        where: { id: `form_${data[emailKey].replace(/[^a-z0-9]/gi, '_')}` },
        create: { id: `form_${data[emailKey].replace(/[^a-z0-9]/gi, '_')}`, workspaceId: req.workspaceId, firstName: parts[0]||nameVal||'Form', lastName: parts.slice(1).join(' ')||(lastKey ? data[lastKey!]||'Submission' : 'Submission'), email: data[emailKey], phone: data[Object.keys(data).find(k => k.toLowerCase().includes('phone'))||'']||null, source: 'form', status: 'new' },
        update: { email: data[emailKey] },
      }).catch(() => {});
    }
    res.json({ success: true, id: sub.id });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// Stripe stubs
router.post('/stripe/create-payment-intent', async (req, res) => {
  const { amount, dealId } = req.body;
  if (!amount) return res.status(400).json({ error: 'Amount is required' });
  res.json({ clientSecret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`, dealId, amount });
});
router.post('/stripe/webhook', (req, res) => res.json({ received: true }));

export default router;
