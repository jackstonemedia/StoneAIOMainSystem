import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ContactHealthScoreProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  activityBreakdown?: {
    recency: number;
    emailOpens: number;
    calls: number;
    meetings: number;
  };
}

function getScoreColor(score: number) {
  if (score >= 70) return { stroke: '#00c875', text: '#00c875', bg: 'bg-emerald-50', label: 'Hot', ring: '#00c875' };
  if (score >= 40) return { stroke: '#ffcb00', text: '#d97706', bg: 'bg-primary/10', label: 'Warm', ring: '#ffcb00' };
  return { stroke: '#e2445c', text: '#e2445c', bg: 'bg-rose-50', label: 'Cold', ring: '#e2445c' };
}

export default function ContactHealthScore({ score, size = 'md', showLabel = false, activityBreakdown }: ContactHealthScoreProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const clr = getScoreColor(score);

  const dims = { sm: 32, md: 40, lg: 56 }[size];
  const strokeW = { sm: 3, md: 3.5, lg: 4 }[size];
  const r = (dims - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const fontSize = { sm: 8, md: 10, lg: 13 }[size];

  return (
    <div className="relative inline-flex flex-col items-center" onMouseEnter={() => setTooltipOpen(true)} onMouseLeave={() => setTooltipOpen(false)}>
      <svg width={dims} height={dims} viewBox={`0 0 ${dims} ${dims}`} className="rotate-[-90deg]">
        <circle cx={dims / 2} cy={dims / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeW} />
        <motion.circle
          cx={dims / 2} cy={dims / 2} r={r}
          fill="none"
          stroke={clr.stroke}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-bold" style={{ fontSize, color: clr.text, transform: 'none' }}>
        {score}
      </span>

      {showLabel && (
        <span className="mt-1 text-[10px] font-semibold" style={{ color: clr.text }}>{clr.label}</span>
      )}

      <AnimatePresence>
        {tooltipOpen && activityBreakdown && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-surface border border-border rounded-xl shadow-xl p-3 min-w-[180px] pointer-events-none"
          >
            <p className="text-[11px] font-bold text-text-main mb-2 flex items-center justify-between">
              Health Score
              <span className="font-black" style={{ color: clr.text }}>{score}/100</span>
            </p>
            {[
              { label: 'Recency', value: activityBreakdown.recency, max: 30 },
              { label: 'Email Opens', value: activityBreakdown.emailOpens, max: 25 },
              { label: 'Calls', value: activityBreakdown.calls, max: 25 },
              { label: 'Meetings', value: activityBreakdown.meetings, max: 20 },
            ].map(item => (
              <div key={item.label} className="mb-1.5">
                <div className="flex justify-between text-[10px] text-text-muted0 mb-0.5">
                  <span>{item.label}</span>
                  <span className="font-semibold">{item.value}/{item.max}</span>
                </div>
                <div className="h-1 bg-surface-hover rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(item.value / item.max) * 100}%`, background: clr.stroke }} />
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
