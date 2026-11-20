/**
 * Data & Privacy settings — complete-platform item 5 (GDPR).
 *
 * Three actions, each honest about what it does:
 * - Export: downloads the whole workspace as one JSON file (all modules;
 *   credentials are never included).
 * - Delete workspace: owner only, type the workspace name exactly. The
 *   server enforces ownership; the UI shows its plain-words error.
 * - Delete account: type DELETE. Removes the person's account + personal
 *   data; workspaces they own with other members transfer ownership
 *   instead of being deleted. The server reports exactly what happened.
 */
import { useState } from 'react';
import { Download, Trash2, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { IS_DEV_AUTH_BYPASS } from '../../lib/clerkConfig';

export default function DataPrivacySettings({ workspaceName }: { workspaceName?: string | null }) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const [confirmName, setConfirmName] = useState('');
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [workspaceDeleted, setWorkspaceDeleted] = useState<{ name: string; counts: Record<string, number> } | null>(null);

  const [confirmDelete, setConfirmDelete] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState<any | null>(null);

  const downloadExport = async () => {
    setExporting(true);
    try {
      const r = await apiFetch('/api/gdpr/export');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'stone-aio-export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast('error', 'Export failed', err?.message || 'Could not export workspace data');
    } finally {
      setExporting(false);
    }
  };

  const deleteWorkspace = async () => {
    setDeletingWorkspace(true);
    try {
      const r = await apiFetch('/api/gdpr/workspace/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName }),
      });
      const d = await r.json();
      setWorkspaceDeleted({ name: d.workspaceName, counts: d.counts ?? {} });
    } catch (err: any) {
      toast('error', 'Workspace was not deleted', err?.message || 'Could not delete workspace');
    } finally {
      setDeletingWorkspace(false);
    }
  };

  const deleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const r = await apiFetch('/api/gdpr/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmDelete }),
      });
      const d = await r.json();
      setAccountDeleted(d);
    } catch (err: any) {
      toast('error', 'Account was not deleted', err?.message || 'Could not delete account');
    } finally {
      setDeletingAccount(false);
    }
  };

  const signOut = async () => {
    if (IS_DEV_AUTH_BYPASS) {
      window.location.href = '/login';
      return;
    }
    await (window as any).Clerk?.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-bold text-text-main mb-0.5">Data &amp; Privacy</h2>
        <p className="text-[13px] text-text-muted">Export your workspace data, or delete the workspace or your account.</p>
      </div>

      {/* Export */}
      <div className="bg-surface border border-border rounded-[12px] p-6">
        <div className="text-[13px] font-semibold text-text-main">Export workspace data</div>
        <p className="text-[11px] text-text-muted mt-0.5">
          Downloads everything in this workspace as one JSON file — contacts, deals, conversations,
          campaigns, automations, workflows, landing pages, and the rest. Sign-in credentials are never included.
        </p>
        <button
          onClick={downloadExport}
          disabled={exporting}
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-[6px] text-[12px] font-semibold text-text-main hover:border-primary/40 transition-colors disabled:opacity-50"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {exporting ? 'Preparing export…' : 'Download workspace data'}
        </button>
      </div>

      {/* Delete workspace */}
      <div className="bg-surface border border-red-500/30 rounded-[12px] p-6">
        <div className="text-[13px] font-semibold text-red-500">Delete this workspace</div>
        {workspaceDeleted ? (
          <p className="text-[12px] text-text-muted mt-1">
            “{workspaceDeleted.name}” and its data were deleted. Your next visit creates a fresh empty workspace.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-text-muted mt-0.5">
              Permanently deletes the workspace and everything in it — contacts, deals, conversations,
              campaigns, automations, and all the rest. Only the workspace owner can do this. This cannot be undone.
            </p>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={`Type ${workspaceName ?? 'the workspace name'} to confirm`}
              className="mt-3 w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] focus:outline-none focus:border-red-500"
            />
            <button
              onClick={deleteWorkspace}
              disabled={deletingWorkspace || !workspaceName || confirmName !== workspaceName}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
            >
              {deletingWorkspace ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {deletingWorkspace ? 'Deleting…' : 'Delete workspace'}
            </button>
          </>
        )}
      </div>

      {/* Delete account */}
      <div className="bg-surface border border-red-500/30 rounded-[12px] p-6">
        <div className="text-[13px] font-semibold text-red-500">Delete my account</div>
        {accountDeleted ? (
          <>
            <p className="text-[12px] text-text-muted mt-1">
              Your account and personal data were deleted
              {accountDeleted.workspacesDeleted?.length > 0 && `, including ${accountDeleted.workspacesDeleted.length} workspace${accountDeleted.workspacesDeleted.length === 1 ? '' : 's'} you solely owned`}
              {accountDeleted.workspacesTransferred?.length > 0 && `; ${accountDeleted.workspacesTransferred.length} shared workspace${accountDeleted.workspacesTransferred.length === 1 ? '' : 's'} transferred to another owner instead of being deleted`}
              . Shared business data (contacts, deals, campaigns) stays with the business.
            </p>
            {accountDeleted.clerkNote && (
              <p className="text-[12px] text-amber mt-2">{accountDeleted.clerkNote}</p>
            )}
            <button
              onClick={signOut}
              className="mt-3 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <p className="text-[11px] text-text-muted mt-0.5">
              Permanently deletes your account, your memberships, and your personal data (your AI
              conversations, memories, and projects). Workspaces you solely own are deleted with
              you; shared workspaces transfer to another owner. This cannot be undone.
            </p>
            <input
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="mt-3 w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] focus:outline-none focus:border-red-500"
            />
            <button
              onClick={deleteAccount}
              disabled={deletingAccount || confirmDelete !== 'DELETE'}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
            >
              {deletingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {deletingAccount ? 'Deleting…' : 'Delete my account'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
