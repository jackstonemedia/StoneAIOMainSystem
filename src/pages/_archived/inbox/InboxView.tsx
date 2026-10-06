import InboxSidebar from './components/InboxSidebar';
import ConversationList from './components/ConversationList';
import ConversationDetail from './components/ConversationDetail';

export default function InboxView() {
  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <InboxSidebar />
      <ConversationList />
      <ConversationDetail />
    </div>
  );
}
