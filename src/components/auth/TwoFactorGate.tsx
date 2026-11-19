import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';

// Two-factor gate — Tier 3 Tranche A, Fix 17.
//
// Enabling 2FA used to change nothing: nothing consulted UserTwoFactor at
// sign-in. Now the API blocks unverified sessions (403 2FA_REQUIRED, or
// 2FA_SETUP_REQUIRED when the workspace requires 2FA and the user has none),
// and this gate — wrapped around the app shell's Outlet — shows the
// challenge / setup screen instead of the app until the session is verified.
//
// The gate never blocks sign-in itself (it renders after Clerk sign-in) and
// never blocks the login page (it only wraps the protected shell). If the
// status fetch fails (e.g. not signed in), it renders children and lets the
// normal SignedIn/SignedOut redirect handle auth.
interface TwoFactorStatus {
  enabled: boolean;
  configured: boolean;
  verified: boolean;
  requireTwoFactor: boolean;
}

async function fetchStatus(): Promise<TwoFactorStatus | null> {
  try {
    const r = await apiFetch('/api/settings/2fa/status');
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export default function TwoFactorGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);

  const refresh = async () => {
    const s = await fetchStatus();
    setStatus(s);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // A 403 2FA_REQUIRED / 2FA_SETUP_REQUIRED from any API call (e.g. the
    // verification expired mid-session) re-checks status and re-shows the
    // gate. Dispatched by apiFetch / the apiClient response interceptor.
    const onRequired = () => { setLoading(true); refresh(); };
    window.addEventListener('stone-2fa-required', onRequired);
    return () => window.removeEventListener('stone-2fa-required', onRequired);
  }, []);

  const submitChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await apiFetch('/api/settings/2fa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        setError(d?.error || 'Invalid code. Check your authenticator app and try again.');
        return;
      }
      setCode('');
      await refresh();
    } catch {
      setError('Could not verify the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const startSetup = async () => {
    setSetupBusy(true);
    setError('');
    try {
      const r = await apiFetch('/api/settings/2fa/setup');
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.qrCodeUrl) {
        setError('Could not start 2FA setup. Please try again.');
        return;
      }
      setSetup(d);
    } catch {
      setError('Could not start 2FA setup. Please try again.');
    } finally {
      setSetupBusy(false);
    }
  };

  const submitSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await apiFetch('/api/settings/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        setError(d?.error || 'Invalid code. Check your authenticator app and try again.');
        return;
      }
      // Enabling 2FA in this session also marks it verified server-side.
      setCode('');
      setSetup(null);
      await refresh();
    } catch {
      setError('Could not verify the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  // Status unavailable (not signed in, network error) — let the normal auth
  // redirect handle it instead of trapping the user on this screen.
  if (!status) return <>{children}</>;
  // Nothing to enforce for this session.
  if (status.verified || (!status.enabled && !status.requireTwoFactor)) return <>{children}</>;

  const needsSetup = status.requireTwoFactor && !status.configured;

  return (
    <div className="flex h-screen items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[400px] bg-surface border border-border rounded-2xl p-8 shadow-xl">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        {needsSetup ? (
          <>
            <h1 className="text-[20px] font-bold text-text-main mb-1.5">Two-factor authentication required</h1>
            <p className="text-[13px] text-text-muted leading-relaxed mb-6">
              Your workspace requires two-factor authentication. Set it up with your authenticator
              app to continue — it takes about a minute.
            </p>
            {!setup ? (
              <button
                onClick={startSetup}
                disabled={setupBusy}
                className="w-full h-11 rounded-lg bg-primary hover:bg-primary-hover text-white text-[14px] font-semibold transition-colors disabled:opacity-60"
              >
                {setupBusy ? 'Starting setup…' : 'Set up two-factor authentication'}
              </button>
            ) : (
              <form onSubmit={submitSetup} className="space-y-4">
                <div className="flex justify-center">
                  <img src={setup.qrCodeUrl} alt="2FA QR Code" className="w-44 h-44 rounded-lg border border-border" />
                </div>
                <p className="text-[12px] text-text-muted text-center">
                  Scan the code with your authenticator app, or enter this key manually:{' '}
                  <code className="font-mono text-text-main break-all">{setup.secret}</code>
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full h-11 px-3 bg-bg border border-border rounded-lg text-[15px] text-center tracking-[0.3em] font-mono text-text-main focus:outline-none focus:border-primary"
                />
                {error && <p className="text-[12px] text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={code.length !== 6 || busy}
                  className="w-full h-11 rounded-lg bg-primary hover:bg-primary-hover text-white text-[14px] font-semibold transition-colors disabled:opacity-60"
                >
                  {busy ? 'Verifying…' : 'Verify and continue'}
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="text-[20px] font-bold text-text-main mb-1.5">Verify it&apos;s you</h1>
            <p className="text-[13px] text-text-muted leading-relaxed mb-6">
              Two-factor authentication is on for your account. Enter the 6-digit code from your
              authenticator app to continue.
            </p>
            <form onSubmit={submitChallenge} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6-digit code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full h-11 px-3 bg-bg border border-border rounded-lg text-[15px] text-center tracking-[0.3em] font-mono text-text-main focus:outline-none focus:border-primary"
              />
              {error && <p className="text-[12px] text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={code.length !== 6 || busy}
                className="w-full h-11 rounded-lg bg-primary hover:bg-primary-hover text-white text-[14px] font-semibold transition-colors disabled:opacity-60"
              >
                {busy ? 'Verifying…' : 'Verify and continue'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
