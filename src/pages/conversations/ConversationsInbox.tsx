import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ConversationListPane from './components/ConversationListPane';
import ThreadPane from './components/ThreadPane';
import { useConversationsCtx } from './context/ConversationsContext';

export default function ConversationsInbox() {
  const { id } = useParams<{ id?: string }>();
  const { selectedId, setSelectedId } = useConversationsCtx();

  // Open thread when navigating to /conversations/:id directly
  useEffect(() => {
    if (id && id !== selectedId) {
      setSelectedId(id);
    }
  }, [id]);

  return (
    <div className="flex-1 overflow-hidden mx-8 mt-6 mb-6 rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10 flex">
      <ConversationListPane />
      <ThreadPane />
    </div>
  );
}
