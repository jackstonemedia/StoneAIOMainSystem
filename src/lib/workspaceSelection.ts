/**
 * Client-side workspace selection (complete-platform item 4).
 *
 * The selected workspace id lives in localStorage and is sent to the API as
 * an `x-workspace-id` header (apiFetch + the axios interceptor) and as a
 * `?workspaceId=` query param on the EventSource streams (which cannot set
 * headers). The server only honours a selection the user is a member of —
 * anything else fails loudly with 400, never a silent wrong-workspace
 * landing. No selection = first membership (today's behaviour).
 */

export const WORKSPACE_SELECTION_KEY = 'stone-aio-workspace';
export const WORKSPACE_HEADER = 'x-workspace-id';

export function getSelectedWorkspaceId(): string | null {
  try {
    return localStorage.getItem(WORKSPACE_SELECTION_KEY);
  } catch {
    return null;
  }
}

export function setSelectedWorkspaceId(id: string): void {
  try {
    localStorage.setItem(WORKSPACE_SELECTION_KEY, id);
  } catch {
    // Selection is a preference, not data — a failed write just means the
    // next load falls back to the first membership.
  }
}

export function clearSelectedWorkspaceId(): void {
  try {
    localStorage.removeItem(WORKSPACE_SELECTION_KEY);
  } catch {}
}
