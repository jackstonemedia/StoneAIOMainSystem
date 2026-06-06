import type { ReactNode } from 'react';
import { motion } from 'motion/react';

export const DASH_EASE = [0.32, 0.72, 0, 1] as const;

interface DashboardFadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function DashboardFadeIn({ children, delay = 0, className = '' }: DashboardFadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay, ease: DASH_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface DashboardPanelProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

/**
 * Glass panel — matches the contacts table container pattern:
 * frosted glass surface with subdued border, no decorative double-bezel.
 */
export function DashboardPanel({ children, className = '', innerClassName = '' }: DashboardPanelProps) {
  return (
    <div
      className={`rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 ${className}`}
    >
      <div className={innerClassName}>
        {children}
      </div>
    </div>
  );
}

interface DashboardSectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function DashboardSectionHeader({ eyebrow, title, subtitle, action }: DashboardSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
      <div>
        {eyebrow && (
          <span className="text-label-caps mb-1.5 block">
            {eyebrow}
          </span>
        )}
        <h3 className="text-[15px] font-semibold tracking-tight text-text-main">{title}</h3>
        {subtitle && <p className="mt-1 text-[12px] text-text-muted max-w-xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
