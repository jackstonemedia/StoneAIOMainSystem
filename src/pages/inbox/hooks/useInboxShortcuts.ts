import { useEffect } from 'react';
import { useInbox } from '../context/InboxContext';

export function useInboxShortcuts() {
  const { setActiveView } = useInbox();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Command/Ctrl + K for search (mock action for now)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        console.log('Command Bar triggered');
        // TODO: Open command bar modal
      }

      // 'M' for Mine view
      if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'm') {
        setActiveView('mine');
      }

      // 'U' for Unassigned view
      if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'u') {
        setActiveView('unassigned');
      }

      // 'A' for All view
      if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'a') {
        setActiveView('all');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveView]);
}
