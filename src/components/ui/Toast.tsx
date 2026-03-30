import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: string; type: ToastType; title: string; message?: string; }
interface ToastContextValue { toast: (type: ToastType, title: string, message?: string) => void; }

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

const icons = {
  success: { Icon: CheckCircle, cls: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  error:   { Icon: XCircle,     cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  warning: { Icon: AlertTriangle,cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  info:    { Icon: Info,         cls: 'text-primary bg-primary/10 border-primary/20' },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const { Icon, cls } = icons[toast.type];
  return (
    <div
      className="flex items-start gap-3 p-4 bg-surface border border-border rounded-xl shadow-[var(--shadow-luxury)] w-80 animate-toast-in"
      role="alert"
    >
      <div className={`p-1.5 rounded-lg border ${cls} shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-main">{toast.title}</div>
        {toast.message && <div className="text-xs text-text-muted mt-0.5 leading-relaxed">{toast.message}</div>}
      </div>
      <button onClick={() => onRemove(toast.id)} className="text-text-muted hover:text-text-main transition-colors shrink-0 mt-0.5">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const remove = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3" aria-live="polite">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={remove} />)}
      </div>
    </ToastContext.Provider>
  );
}
