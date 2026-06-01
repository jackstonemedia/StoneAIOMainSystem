import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_URL: z.string().default('file:./prisma/dev.db'),

  // AI
  GOOGLE_AI_API_KEY: z.string().optional(),

  // Voice
  RETELL_API_KEY: z.string().optional(),

  // Messaging
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Meta (Facebook/Instagram)
  META_CLIENT_ID: z.string().optional(),
  META_CLIENT_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // App
  VITE_APP_URL: z.string().default('http://localhost:3000'),

  // Auth (Clerk)
  CLERK_SECRET_KEY: z.string().optional(),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),

  // TikTok OAuth
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),

  // LinkedIn OAuth
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Gmail OAuth
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REDIRECT_URI: z.string().optional(),

  // Outlook / Microsoft OAuth
  OUTLOOK_CLIENT_ID: z.string().optional(),
  OUTLOOK_CLIENT_SECRET: z.string().optional(),
  OUTLOOK_REDIRECT_URI: z.string().optional(),

  // Token encryption — generate with:
  // node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  CHANNEL_ENCRYPTION_KEY: z.string().optional(),

  // Redis — already consumed by queue.service.ts via process.env directly;
  // adding here makes it typed and validated at startup
  REDIS_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env: Env = parsed.data;
