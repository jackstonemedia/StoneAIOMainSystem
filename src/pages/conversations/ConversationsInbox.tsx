import React from 'react';
import { useParams } from 'react-router-dom';
import UnifiedInbox from './components/UnifiedInbox';

/**
 * Conversations page — one unified inbox (complete-platform item 2).
 *
 * The old Messages / Live-chat toggle is gone: legacy email/SMS/Meta
 * threads and website-widget live chats now share one list, ordered
 * by last activity, with replies routed to the owning store's real
 * path. The legacy list/thread panes and the LiveChatInbox tab stay
 * in the repo for now (their template/AI/bulk extras are a follow-up
 * to re-attach); they are no longer rendered here.
 */
export default function ConversationsInbox() {
  const { id } = useParams<{ id?: string }>();

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden z-0">
      <UnifiedInbox initialId={id ?? null} />
    </div>
  );
}
