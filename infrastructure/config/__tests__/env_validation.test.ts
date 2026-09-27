import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirroring the env schema superRefine logic
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('file:./prisma/dev.db'),
  CLERK_SECRET_KEY: z.string().optional(),
  CHANNEL_ENCRYPTION_KEY: z.string().optional(),
  VITE_APP_URL: z.string().default('http://localhost:5173'),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (!data.DATABASE_URL || data.DATABASE_URL.startsWith('file:') || data.DATABASE_URL.includes('sqlite') || data.DATABASE_URL.includes('dev.db')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'Production DATABASE_URL must be a PostgreSQL connection string (postgresql:// or postgres://), not SQLite or file:.'
      });
    }

    if (!data.CLERK_SECRET_KEY || data.CLERK_SECRET_KEY.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CLERK_SECRET_KEY'],
        message: 'CLERK_SECRET_KEY is strictly required in production mode.'
      });
    }

    if (!data.CHANNEL_ENCRYPTION_KEY || data.CHANNEL_ENCRYPTION_KEY.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(data.CHANNEL_ENCRYPTION_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CHANNEL_ENCRYPTION_KEY'],
        message: 'CHANNEL_ENCRYPTION_KEY is required in production and must be a 64-character hex string (32 bytes AES-256).'
      });
    }
  }
});

describe('Production Environment Validation Rules', () => {
  it('allows SQLite and missing keys in development/test mode', () => {
    const devEnv = {
      NODE_ENV: 'development',
      DATABASE_URL: 'file:./prisma/dev.db',
    };
    const result = envSchema.safeParse(devEnv);
    expect(result.success).toBe(true);
  });

  it('rejects SQLite in production mode', () => {
    const prodEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'file:./prisma/dev.db',
      CLERK_SECRET_KEY: 'sk_live_123456789',
      CHANNEL_ENCRYPTION_KEY: 'a'.repeat(64),
    };
    const result = envSchema.safeParse(prodEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      const dbIssue = result.error.issues.find(i => i.path.includes('DATABASE_URL'));
      expect(dbIssue?.message).toContain('must be a PostgreSQL connection string');
    }
  });

  it('rejects missing CLERK_SECRET_KEY in production mode', () => {
    const prodEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/stone_aio',
      CHANNEL_ENCRYPTION_KEY: 'a'.repeat(64),
    };
    const result = envSchema.safeParse(prodEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      const clerkIssue = result.error.issues.find(i => i.path.includes('CLERK_SECRET_KEY'));
      expect(clerkIssue?.message).toContain('CLERK_SECRET_KEY is strictly required');
    }
  });

  it('rejects invalid or missing CHANNEL_ENCRYPTION_KEY in production mode', () => {
    const prodEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/stone_aio',
      CLERK_SECRET_KEY: 'sk_live_123456789',
      CHANNEL_ENCRYPTION_KEY: 'too-short-key',
    };
    const result = envSchema.safeParse(prodEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      const keyIssue = result.error.issues.find(i => i.path.includes('CHANNEL_ENCRYPTION_KEY'));
      expect(keyIssue?.message).toContain('64-character hex string');
    }
  });

  it('accepts valid production configuration with PostgreSQL', () => {
    const prodEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:secret@db.supabase.co:5432/postgres?pgbouncer=true',
      CLERK_SECRET_KEY: 'sk_live_valid_clerk_key_99999',
      CHANNEL_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };
    const result = envSchema.safeParse(prodEnv);
    expect(result.success).toBe(true);
  });
});
