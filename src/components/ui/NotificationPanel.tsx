import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Check, CheckCheck, Trash2, AlertCircle, Info, CheckCircle2, Zap } from 'lucide-react';

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

const TYPE_ICON: Record<string, { icon: any; color: string; bg: string }> = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  error:   { icon: AlertCircle,  color: 'text-red-400',     bg: 'bg-red-400/10' },
  warning: { icon: AlertCircle,  color: 'text-amber-400',   bg: 'bg-amber-400/10' },
  info:    { icon: Info,         color: 'text-blue-400',    bg: 'bg-blue-400/10' },
  default: { icon: Zap,          color: 'text-primary',     bg: 'bg-primary/10' },
};

export function NotificationPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: count = { count: 0 } } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => fetch('/api/notifications/unread-count').then(r => r.ok ? r.json() : { count: 0 }),
    refetchInterval: 30000,
  });

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/notifications').then(r => r.ok ? r.json() : []),
    refetchInterval: 30000,
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => fetch(`/api/notifications/${id}/read`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  const markAll = useMutation({
    mutationFn: () => fetch('/api/notifications/read-all', { method: 'POST' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/notifications/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unread = count.count || 0;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover transition-all"
      >
        <Bell className="w-4 h-4" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-[calc(100%+8px)] w-[380px] bg-surface border border-border rounded-[12px] shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-hover/30">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <span className="text-[13px] font-bold text-text-main">Notifications</span>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 bg-primary/15 text-primary text-[10px] font-bold rounded-full">{unread} new</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={() => markAll.mutate()}
                    className="flex items-center gap-1 text-[11px] text-text-muted hover:text-primary px-2 py-1 rounded-[5px] hover:bg-primary/10 transition-colors"
                  >
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="w-6 h-6 flex items-center justify-center rounded-[5px] text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center">
                    <Bell className="w-5 h-5 text-text-muted" />
                  </div>
                  <p className="text-[13px] font-semibold text-text-main">All caught up!</p>
                  <p className="text-[12px] text-text-muted">No notifications right now.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {notifications.map((n: any) => {
                    const cfg = TYPE_ICON[n.type] || TYPE_ICON.default;
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 px-4 py-3 group hover:bg-surface-hover/40 transition-colors cursor-pointer ${!n.read ? 'bg-primary/[0.03]' : ''}`}
                        onClick={() => { if (!n.read) markRead.mutate(n.id); if (n.link) { setOpen(false); window.location.href = n.link; } }}
                      >
                        <div className={`w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] leading-snug ${n.read ? 'text-text-muted' : 'text-text-main font-medium'}`}>{n.title}</p>
                          {n.body && <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{n.body}</p>}
                          <p className="text-[10px] text-text-muted/60 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {!n.read && (
                            <button onClick={e => { e.stopPropagation(); markRead.mutate(n.id); }}
                              className="w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors">
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); del.mutate(n.id); }}
                            className="w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border bg-surface-hover/20 text-center">
                <button className="text-[11px] text-primary hover:opacity-80 font-semibold transition-opacity">
                  View all notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
