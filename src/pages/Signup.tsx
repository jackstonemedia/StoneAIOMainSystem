import React, { useState } from 'react';
import { useSignUp, useClerk } from '@clerk/clerk-react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import EnterpriseAuthLayout from '../components/layout/EnterpriseAuthLayout';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function Signup() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const clerk = useClerk();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    if (!isLoaded || !signUp) return;
    setOauthLoading(true);
    setError('');
    try {
      // Sign out any existing session so Google always shows account picker
      await clerk.signOut();
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/crm`,
        // @ts-ignore
        additionalData: {
          prompt: 'select_account'
        }
      });
    } catch (err: any) {
      setOauthLoading(false);
      setError(err?.errors?.[0]?.longMessage || err?.message || 'Google sign-up failed. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      const result = await signUp!.create({ firstName, lastName, emailAddress: email, password });
      if (result.status === 'complete') {
        await setActive!({ session: result.createdSessionId });
        navigate('/crm');
        return;
      }
      // Email verification required
      await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('verify');
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      const result = await signUp!.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await setActive!({ session: result.createdSessionId });
        navigate('/crm');
      } else {
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: OTP Verification ──────────────────────────────────────────────
  if (step === 'verify') {
    return (
      <EnterpriseAuthLayout>
        <div className="w-full max-w-[380px]">
          <button
            type="button"
            onClick={() => { setStep('form'); setError(''); }}
            className="flex items-center gap-1.5 text-[13px] text-[#555] hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          <div className="mb-8">
            <h1 className="text-[26px] font-bold tracking-tight text-white mb-1.5">Check your email</h1>
            <p className="text-[14px] text-[#737373]">
              We sent a 6-digit code to <span className="text-white font-medium">{email}</span>
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 mb-5 rounded-lg bg-red-950/40 border border-red-900/50">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-300 leading-snug">{error}</p>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label htmlFor="signup-otp" className="block text-[12px] font-medium text-[#888] mb-1.5">
                Verification code
              </label>
              <input
                id="signup-otp"
                type="text"
                inputMode="numeric"
                required
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full h-14 px-3.5 rounded-lg bg-[#141414] border border-[#2a2a2a] text-[22px] font-mono text-white text-center tracking-[0.4em] placeholder-[#333] focus:outline-none focus:border-[#444] transition-colors"
              />
            </div>
            <button
              id="signup-verify-btn"
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full h-11 rounded-lg bg-white text-[#0a0a0a] text-[14px] font-semibold hover:bg-[#e5e5e5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-black/60" /> : 'Verify & Continue'}
            </button>
          </form>
        </div>
      </EnterpriseAuthLayout>
    );
  }

  // ── Step 1: Registration Form ─────────────────────────────────────────────
  return (
    <EnterpriseAuthLayout>
      <div className="w-full max-w-[380px]">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[26px] font-bold tracking-tight text-white mb-1.5">Create an account</h1>
          <p className="text-[14px] text-[#737373]">Start building your AI workforce today.</p>
        </div>

        {/*
          IMPORTANT: Required by Clerk SDK (v5+) for headless flows.
          Clerk auto-mounts the Cloudflare Turnstile bot-protection widget here.
          data-cl-theme="dark" styles it to match our dark UI.
        */}
        <div id="clerk-captcha" data-cl-theme="dark" />

        {/* Google OAuth */}
        <button
          id="signup-google-btn"
          type="button"
          onClick={handleGoogleSignUp}
          disabled={oauthLoading || !isLoaded}
          className="w-full flex items-center justify-center gap-2.5 h-11 px-4 mb-5 rounded-lg border border-[#2a2a2a] bg-[#141414] hover:bg-[#1e1e1e] text-[14px] font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {oauthLoading
            ? <Loader2 className="w-4 h-4 animate-spin text-white/60" />
            : <GoogleIcon />
          }
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-[#2a2a2a]" />
          <span className="text-[11px] uppercase tracking-[0.12em] font-medium text-[#555]">or</span>
          <div className="flex-1 h-px bg-[#2a2a2a]" />
        </div>

        {/* Error alert */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 mb-5 rounded-lg bg-red-950/40 border border-red-900/50">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-300 leading-snug">{error}</p>
          </div>
        )}

        {/* Registration form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="signup-first" className="block text-[12px] font-medium text-[#888] mb-1.5">
                First name
              </label>
              <input
                id="signup-first"
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full h-11 px-3.5 rounded-lg bg-[#141414] border border-[#2a2a2a] text-[14px] text-white placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors"
              />
            </div>
            <div>
              <label htmlFor="signup-last" className="block text-[12px] font-medium text-[#888] mb-1.5">
                Last name
              </label>
              <input
                id="signup-last"
                type="text"
                required
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full h-11 px-3.5 rounded-lg bg-[#141414] border border-[#2a2a2a] text-[14px] text-white placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors"
              />
            </div>
          </div>

          <div>
            <label htmlFor="signup-email" className="block text-[12px] font-medium text-[#888] mb-1.5">
              Email address
            </label>
            <input
              id="signup-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full h-11 px-3.5 rounded-lg bg-[#141414] border border-[#2a2a2a] text-[14px] text-white placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors"
            />
          </div>

          <div>
            <label htmlFor="signup-password" className="block text-[12px] font-medium text-[#888] mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full h-11 pl-3.5 pr-10 rounded-lg bg-[#141414] border border-[#2a2a2a] text-[14px] text-white placeholder-[#333] focus:outline-none focus:border-[#444] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#999] transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="signup-submit-btn"
            type="submit"
            disabled={loading || !isLoaded}
            className="w-full h-11 mt-1 rounded-lg bg-white text-[#0a0a0a] text-[14px] font-semibold hover:bg-[#e5e5e5] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-black/60" /> : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-[13px] text-[#555]">
          Already have an account?{' '}
          <Link to="/login" className="text-white font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </EnterpriseAuthLayout>
  );
}
