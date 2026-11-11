/**
 * Public invite accept page — Tier 1 Fix 9.
 * Opened from the invite email link (/invite/:token). The lookup is public
 * (the invitee may not have an account yet); accepting requires being
 * signed in, and the accept call creates the real WorkspaceMember.
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import { useUser } from '@clerk/clerk-react';

interface InviteInfo {
  email: string;
  role: string;
  workspaceName: string;
  expiresAt: string;
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'invite'; info: InviteInfo }
  | { kind: 'error'; message: string }
  | { kind: 'accepted' }
  | { kind: 'already-member' }
  | { kind: 'needs-signin' };

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { isSignedIn } = useUser();
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: 'error', message: 'This invite link is not valid.' });
      return;
    }
    apiFetch(`/api/invites/${token}`)
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok) throw new Error(d?.error || 'This invite link is not valid.');
        setState({ kind: 'invite', info: d as InviteInfo });
      })
      .catch((err: any) => setState({ kind: 'error', message: err?.message || 'This invite link is not valid.' }));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const r = await apiFetch(`/api/invites/${token}/accept`, { method: 'POST' });
      const d = await r.json().catch(() => null);
      if (r.status === 401) {
        setState({ kind: 'needs-signin' });
        return;
      }
      if (r.status === 409) {
        setState({ kind: 'already-member' });
        return;
      }
      if (!r.ok) throw new Error(d?.error || 'Could not accept this invite.');
      setState({ kind: 'accepted' });
    } catch (err: any) {
      setState({ kind: 'error', message: err?.message || 'Could not accept this invite.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-text-main p-4">
      <div className="bg-surface border border-border rounded-[16px] w-full max-w-md p-8 shadow-2xl text-center">
        <h1 className="text-[20px] font-black mb-1">Stone AIO</h1>
        {state.kind === 'loading' && <p className="text-[13px] text-text-muted mt-4">Checking your invite…</p>}

        {state.kind === 'error' && (
          <>
            <p className="text-[15px] font-bold mt-4">Invite unavailable</p>
            <p className="text-[13px] text-text-muted mt-2">{state.message}</p>
            <Link to="/" className="btn-primary mt-6 inline-block px-4 py-2 text-[13px]">Go to Stone AIO</Link>
          </>
        )}

        {state.kind === 'invite' && (
          <>
            <p className="text-[15px] font-bold mt-4">You've been invited to join</p>
            <p className="text-[18px] font-black mt-1">{state.info.workspaceName}</p>
            <p className="text-[13px] text-text-muted mt-2">
              Invited as <span className="font-semibold text-text-main">{state.info.email}</span> · role{' '}
              <span className="font-semibold text-text-main">{state.info.role}</span>
            </p>
            <p className="text-[11px] text-text-muted mt-1">
              Expires {new Date(state.info.expiresAt).toLocaleDateString()}
            </p>
            {!isSignedIn && (
              <p className="text-[12px] text-amber mt-4">
                You'll need a Stone AIO account — sign up, then open this link again to join.
              </p>
            )}
            <button onClick={handleAccept} disabled={busy} className="btn-primary mt-6 px-6 py-2.5 text-[13px] w-full">
              {busy ? 'Joining…' : `Accept invite & join ${state.info.workspaceName}`}
            </button>
            {!isSignedIn && (
              <Link to="/login" className="block mt-3 text-[13px] font-semibold text-primary hover:opacity-80">
                Sign in first
              </Link>
            )}
          </>
        )}

        {state.kind === 'needs-signin' && (
          <>
            <p className="text-[15px] font-bold mt-4">Sign in to accept</p>
            <p className="text-[13px] text-text-muted mt-2">
              You're not signed in. Sign in (or sign up), then open this invite link again to join.
            </p>
            <Link to="/login" className="btn-primary mt-6 inline-block px-4 py-2 text-[13px]">Sign in</Link>
          </>
        )}

        {state.kind === 'already-member' && (
          <>
            <p className="text-[15px] font-bold mt-4">You're already a member</p>
            <p className="text-[13px] text-text-muted mt-2">This account already belongs to the workspace.</p>
            <Link to="/crm" className="btn-primary mt-6 inline-block px-4 py-2 text-[13px]">Go to the workspace</Link>
          </>
        )}

        {state.kind === 'accepted' && (
          <>
            <p className="text-[15px] font-bold mt-4">Welcome aboard</p>
            <p className="text-[13px] text-text-muted mt-2">You've joined the workspace.</p>
            <Link to="/crm" className="btn-primary mt-6 inline-block px-4 py-2 text-[13px]">Open the workspace</Link>
          </>
        )}
      </div>
    </div>
  );
}
