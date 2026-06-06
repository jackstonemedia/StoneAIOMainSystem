import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Search, Plus, Bell, User, Command } from 'lucide-react';
import { db, StorageKey } from '../../lib/storage';

interface TopBarProps {
  onOpenCommandPalette: () => void;
  onOpenNotifications: () => void;
}

export default function TopBar({ onOpenCommandPalette, onOpenNotifications }: TopBarProps) {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Poll unread notifications using the storage db
    const fetchNotifications = async () => {
      try {
        const notifs = await db.get<any>(StorageKey.NOTIFICATIONS);
        const unread = notifs.filter(n => !n.isRead).length;
        setUnreadCount(unread);
      } catch (e) {
        // ignore
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  // Compute a simple page title and breadcrumbs
  const pathParts = location.pathname.split('/').filter(Boolean);
  const title = pathParts.length > 0 
    ? pathParts[pathParts.length - 1].charAt(0).toUpperCase() + pathParts[pathParts.length - 1].slice(1).replace(/-/g, ' ') 
    : 'Dashboard';

  return (
    <div 
      className="h-[60px] flex items-center justify-between px-6 shrink-0 border-b z-20"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-main)' }}>
          {title}
        </h1>
        {pathParts.length > 1 && (
          <div className="hidden sm:flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span className="opacity-50">/</span>
            <span className="opacity-70">{pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <Search className="w-4 h-4" />
          <span className="text-sm">Search</span>
          <div className="flex items-center gap-1 ml-4 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold" style={{ background: 'var(--surface-hover)' }}>
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        </button>

        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('open-new-dropdown'))} // Simplified for now
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--primary)' }}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New</span>
        </button>

        <button 
          onClick={onOpenNotifications}
          className="relative p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-main)' }}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-surface" />
          )}
        </button>

        <button className="w-8 h-8 rounded-full overflow-hidden border border-border ml-2 flex items-center justify-center bg-primary/10 text-primary font-bold text-sm">
          <User className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
