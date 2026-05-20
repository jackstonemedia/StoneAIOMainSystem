import React, { useState, useEffect } from 'react';
import { useSignIn, useUser } from '@clerk/clerk-react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
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

export default function Login() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useUser();
  const navigate = useNavigate();

  // Already logged in — go straight to dashboard
  useEffect(() => {
    if (isSignedIn) navigate('/crm', { replace: true });
  }, [isSignedIn]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!isLoaded || !signIn) return;
    setOauthLoading(true);
    setError('');
    try {
      await signIn.authenticateWithRedirect({
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
      const code = err?.errors?.[0]?.code;
      if (code === 'identifier_already_signed_in' || err?.status === 400) {
        navigate('/crm', { replace: true });
        return;
      }
      setError(err?.errors?.[0]?.longMessage || err?.message || 'Google sign-in failed.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn!.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setActive!({ session: result.createdSessionId });
        navigate('/crm');
      } else {
        setError('Sign in incomplete. Please try again.');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <EnterpriseAuthLayout>
      <div className="w-full max-w-[380px]">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[26px] font-bold tracking-tight text-white mb-1.5">Log in</h1>
          <p className="text-[14px] text-[#737373]">Access your Stone AIO workspace.</p>
        </div>

        {/*
          IMPORTANT: This invisible div is required by Clerk's SDK (v5+).
          When using headless hooks (useSignIn/useSignUp), Clerk automatically
          mounts the Cloudflare Turnstile bot-protection widget into this element.
          Without it, Google OAuth and email sign-in are blocked by Turnstile (error 600010).
        */}
        <div id="clerk-captcha" data-cl-theme="dark" />

        {/* Google OAuth button */}
        <button
          type="button"
          id="login-google-btn"
          onClick={handleGoogleSignIn}
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

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-[12px] font-medium text-[#888] mb-1.5">
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full h-11 px-3.5 rounded-lg bg-[#141414] border border-[#2a2a2a] text-[14px] text-white placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="text-[12px] font-medium text-[#888]">
                Password
              </label>
              <button type="button" className="text-[12px] text-[#666] hover:text-white transition-colors">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
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
            id="login-submit-btn"
            type="submit"
            disabled={loading || !isLoaded}
            className="w-full h-11 mt-1 rounded-lg bg-white text-[#0a0a0a] text-[14px] font-semibold hover:bg-[#e5e5e5] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-black/60" /> : 'Log In'}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-[13px] text-[#555]">
          Don't have an account?{' '}
          <Link to="/signup" className="text-white font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </EnterpriseAuthLayout>
  );
}
