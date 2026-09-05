import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { ReactNode } from 'react';

export interface SlideOverPanelProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export function SlideOverPanel({ isOpen, open, onClose, title, children, footer, width = 'w-[420px] sm:w-[480px]' }: SlideOverPanelProps) {
  const visible = Boolean(isOpen ?? open);

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[998]"
            onClick={onClose} 
          />
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className={`fixed right-0 top-0 bottom-0 ${width} max-w-[95vw] bg-surface border-l border-border shadow-2xl z-[999] flex flex-col`}
          >
            <div className="px-6 py-5 flex items-center justify-between bg-surface-hover/50 shrink-0">
              <h2 className="text-[16px] font-bold text-text-main">{title}</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-auto bg-surface relative">
              {children}
            </div>

            {footer && (
              <div className="p-6 border-t border-border flex items-center justify-end gap-3 bg-surface-hover/50 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
