import { Outlet } from 'react-router-dom';
import { InboxProvider } from './context/InboxContext';
import { useInboxShortcuts } from './hooks/useInboxShortcuts';
import InboxNavigation from './components/InboxNavigation';

// NOTE: useInboxSSE must be inside InboxProvider to access context
export default function InboxLayout() {
  return (
    <InboxProvider>
      <InboxLayoutInner />
    </InboxProvider>
  );
}

function InboxLayoutInner() {
  useInboxShortcuts();
  
  return (
    <div className="flex h-[calc(100vh-57px)] bg-[#1B1D22] overflow-hidden">
      <InboxNavigation />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
