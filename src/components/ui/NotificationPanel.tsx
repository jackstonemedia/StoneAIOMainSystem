import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, AlertCircle, Info, BellRing } from 'lucide-react';
import { db, StorageKey } from '../../lib/storage';

export default function NotificationPanel({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    fetchNotifs();
  }, [isOpen]);

  const fetchNotifs = async () => {
    const data = await db.get<any>(StorageKey.NOTIFICATIONS);
    setNotifications(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const markAllRead = async () => {
    for (const n of notifications.filter(x => !x.isRead)) {
      await db.update(StorageKey.NOTIFICATIONS, n.id, { isRead: true });
    }
    fetchNotifs();
  };

  const handleNotifClick = async (n: any) => {
    if (!n.isRead) {
      await db.update(StorageKey.NOTIFICATIONS, n.id, { isRead: true });
    }
    if (n.link) {
      navigate(n.link);
      onClose();
    } else {
      fetchNotifs();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div 
        className="fixed top-0 right-0 h-full w-full sm:w-[400px] z-50 flex flex-col shadow-2xl transition-transform"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5" style={{ color: 'var(--text-main)' }} />
            <h2 className="font-semibold" style={{ color: 'var(--text-main)' }}>Notifications</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={markAllRead}
              className="text-xs font-medium px-2 py-1 rounded hover:bg-black/5"
              style={{ color: 'var(--primary)' }}
            >
              Mark all read
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-black/10 transition-colors">
              <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              No new notifications.
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`text-left p-4 border-b transition-colors ${!n.isRead ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-black/5'}`}
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 mt-0.5">
                      {n.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> :
                       n.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500" /> :
                       n.type === 'warning' ? <AlertCircle className="w-5 h-5 text-yellow-500" /> :
                       <Info className="w-5 h-5 text-blue-500" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-main)' }}>{n.title}</div>
                      {n.body && <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{n.body}</div>}
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
