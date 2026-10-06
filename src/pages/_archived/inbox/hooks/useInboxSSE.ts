import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { InboxSSEEvent, InboxMessage, InboxConversation } from '../types/inbox';

export function useInboxSSE() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource('/api/inbox/sse');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as InboxSSEEvent;
        const { type, conversationId, payload } = data;

        if (type === 'conversation.created') {
          queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
        } 
        else if (type === 'conversation.updated') {
          queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
          if (conversationId) {
            queryClient.invalidateQueries({ queryKey: ['inbox', 'conversation', conversationId] });
          }
        } 
        else if (type === 'message.created' || type === 'message.created.private') {
          if (conversationId) {
            queryClient.invalidateQueries({ queryKey: ['inbox', 'messages', conversationId] });
            // Also invalidate conversation list to update unread count / last activity
            queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
          }
        }
        else if (type === 'agent.typing') {
          // Could dispatch a custom DOM event or update a separate store
          window.dispatchEvent(new CustomEvent('inbox-agent-typing', { detail: { conversationId, userId: (payload as any).userId } }));
        }
      } catch (err) {
        console.error('Error parsing inbox SSE:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);
}
