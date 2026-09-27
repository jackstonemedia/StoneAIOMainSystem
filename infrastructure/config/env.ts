import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

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
  VITE_APP_URL: z.string().default('http://localhost:5173'),
  PUBLIC_APP_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // Auth (Clerk)
  CLERK_SECRET_KEY: z.string().optional(),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  RESEND_RATE_LIMIT_PER_SECOND: z.coerce.number().default(10),

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

  // Redis — consumed by bullmq and workflow queue
  REDIS_URL: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    // P0.2 & P0.3: Database in production MUST be PostgreSQL, never SQLite
    if (!data.DATABASE_URL || data.DATABASE_URL.startsWith('file:') || data.DATABASE_URL.includes('sqlite') || data.DATABASE_URL.includes('dev.db')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'Production DATABASE_URL must be a PostgreSQL connection string (postgresql:// or postgres://), not SQLite or file:.'
      });
    }

    // P0.1: Clerk secret key is required in production to prevent dev-bypass
    if (!data.CLERK_SECRET_KEY || data.CLERK_SECRET_KEY.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CLERK_SECRET_KEY'],
        message: 'CLERK_SECRET_KEY is strictly required in production mode.'
      });
    }

    // P0.7: Channel encryption key is required in production and must be 64-char hex
    if (!data.CHANNEL_ENCRYPTION_KEY || data.CHANNEL_ENCRYPTION_KEY.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(data.CHANNEL_ENCRYPTION_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CHANNEL_ENCRYPTION_KEY'],
        message: 'CHANNEL_ENCRYPTION_KEY is required in production and must be a 64-character hex string (32 bytes AES-256).'
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ [FATAL] Invalid environment configuration:');
  parsed.error.issues.forEach(issue => {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env: Env = parsed.data;
