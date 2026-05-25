import { Router, Request, Response } from 'express';
import { db } from '../infrastructure/database/client.js';
import axios from 'axios';
import twilio from 'twilio';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET ALL INTEGRATIONS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const integrations = await db.integration.findMany({ where: { workspaceId: req.workspaceId } });
    const formatted = integrations.reduce((acc, intg) => {
      acc[intg.provider] = true;
      return acc;
    }, {} as Record<string, boolean>);
    
    // Check if Twilio API keys exist in ENV (implicit integration)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      formatted['sms'] = true;
    }
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. OAUTH ENTRYPOINT (Initiates redirect)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/auth/:provider', async (req: Request, res: Response): Promise<any> => {
  const { provider } = req.params;
  const VITE_APP_URL = process.env.VITE_APP_URL || 'http://localhost:3000';
  
  if (provider === 'facebook' || provider === 'instagram') {
    if (!process.env.META_CLIENT_ID) {
       return res.status(401).send("OAuth BLOCKED: META_CLIENT_ID is missing from .env");
    }
    const redirectUri = encodeURIComponent(`${VITE_APP_URL}/api/integrations/callback/${provider}`);
    const scope = encodeURIComponent('pages_messaging,instagram_basic,instagram_manage_messages,public_profile,email');
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.META_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}`;
    return res.redirect(authUrl);
  }
  
  return res.status(400).send('OAuth logic not fully mapped for provider: ' + provider);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. OAUTH CALLBACK (Exchanges code -> permanent database token)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/callback/:provider', async (req: Request, res: Response): Promise<any> => {
  const { provider } = req.params;
  const { code, error } = req.query;

  if (error) return res.status(401).send(`OAuth Error: ${error}`);
  if (!code) return res.status(400).send('No authorization code provided by provider');

  const VITE_APP_URL = process.env.VITE_APP_URL || 'http://localhost:3000';

  try {
    let accessToken = '';
    let accountId: string | null = null;
    
    if (provider === 'facebook' || provider === 'instagram') {
      // 1. Exchange code for Short-Lived User Token
      const tokenRes = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token`, {
        params: {
          client_id: process.env.META_CLIENT_ID,
          redirect_uri: `${VITE_APP_URL}/api/integrations/callback/${provider}`,
          client_secret: process.env.META_CLIENT_SECRET,
          code
        }
      });
      
      const shortLivedToken = tokenRes.data.access_token;
      
      // 2. Exchange Short-Lived for Long-Lived Token
      const longLivedRes = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: process.env.META_CLIENT_ID,
          client_secret: process.env.META_CLIENT_SECRET,
          fb_exchange_token: shortLivedToken
        }
      });
      
      accessToken = longLivedRes.data.access_token;
      
      // 3. Call /me/accounts to get the Page ID for the connected account.
      //    This is critical — the webhook payload includes entry.id (the Page ID),
      //    and we need to resolve the correct workspace by matching this ID.
      const accountsRes = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
        params: { access_token: accessToken }
      });
      const pages = accountsRes.data?.data ?? [];
      accountId = pages.length > 0 ? pages[0].id : null;
    }

    if (!accessToken) throw new Error("Token exchange yielded empty token");

    await db.integration.upsert({
      where: { workspaceId_provider: { workspaceId: req.workspaceId, provider } },
      update: { accessToken, accountId: accountId ?? undefined, updatedAt: new Date() },
      create: { workspaceId: req.workspaceId, provider, accessToken, accountId: accountId ?? undefined }
    });

    res.redirect('/business/conversations/chat?integration_success=true');
  } catch (err: any) {
    console.error(`Callback error for ${provider}:`, err.response?.data || err.message);
    res.status(500).send('Network error communicating with OAuth provider. See terminal.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. DISCONNECT INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:provider', async (req, res) => {
  const { provider } = req.params;
  try {
    await db.integration.delete({ where: { workspaceId_provider: { workspaceId: req.workspaceId, provider } } });
    res.json({ success: true });
  } catch (err) {
    res.json({ success: true }); // Ignore if not exists
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. TRUE NETWORK MESSAGING OUTBOUND
// ─────────────────────────────────────────────────────────────────────────────
router.post('/messages/send', async (req: Request, res: Response): Promise<any> => {
  const { channel, to, body } = req.body;
  if (!channel || !body) return res.status(400).json({ error: 'Missing channel or body' });
  
  try {
    // SMS VIA TWILIO SDK
    if (channel === 'sms') {
       if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
          return res.status(401).json({ error: 'Missing Twilio environment variables' });
       }
       // Needs actual contact phone number. Since "to" is Contact ID, fetch from DB
       const contact = await db.contact.findUnique({ where: { id: to } });
       if (!contact || !contact.phone) return res.status(400).json({ error: 'Contact has no phone number.' });
       
       const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
       await client.messages.create({
         body: body,
         from: process.env.TWILIO_PHONE_NUMBER,
         to: contact.phone
       });
       return res.json({ success: true, messageId: `msg_${Date.now()}` });
    }
    
    // GRAPH API (Facebook / Instagram) VIA AXIOS
    if (channel === 'facebook' || channel === 'instagram') {
      const integration = await db.integration.findUnique({
        where: { workspaceId_provider: { workspaceId: req.workspaceId, provider: channel } }
      });
      if (!integration || !integration.accessToken) {
        return res.status(403).json({ error: `You must connect your ${channel} account first.` });
      }

      // Exact production payload structure for Meta Graph Send API
      const payload = {
        recipient: { id: to }, // Facebook demands the user's specific Page-Scoped ID (PSID)
        message: { text: body },
        messaging_type: "RESPONSE"
      };

      // Axios external HTTP execution
      // NOTE: Using "me" assumes the token is a Page Access Token mapped to the Page
      const response = await axios.post(`https://graph.facebook.com/v18.0/me/messages`, payload, {
        headers: { Authorization: `Bearer ${integration.accessToken}` }
      });

      return res.json({ success: true, messageId: response.data.message_id });
    }

    return res.status(400).json({ error: 'Unsupported channel for outbound routing' });
  } catch (err: any) {
    console.error('Send Error:', err.response?.data || err.message);
    const metaError = err.response?.data?.error?.message;
    res.status(500).json({ error: metaError || 'Failed to dispatch physical message.' });
  }
});

export default router;
