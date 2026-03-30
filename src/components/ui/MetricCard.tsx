import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface SparkPoint { value: number }

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  subtitle?: string;
  sparkline?: number[];
  delay?: number;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const pathD = `M ${pts.join(' L ')}`;
  const areaD = `M 0,${h} L ${pts.join(' L ')} L ${w},${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sg-${color})`} />
      <path d={pathD} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MetricCard({
  label, value, change, trend = 'neutral', icon: Icon,
  iconColor = 'text-primary', iconBg = 'bg-primary/10',
  subtitle, sparkline, delay = 0
}: MetricCardProps) {
  const [displayed, setDisplayed] = useState(0);
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
  const prefix = typeof value === 'string' ? String(value).match(/^[^0-9]*/)?.[0] || '' : '';
  const suffix = typeof value === 'string' ? String(value).match(/[^0-9.]+$/)?.[0] || '' : '';
  const isNumeric = !isNaN(numericValue) && numericValue > 0;

  useEffect(() => {
    if (!isNumeric) return;
    const timer = setTimeout(() => {
      const duration = 900;
      const start = performance.now();
      const animate = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayed(Math.round(eased * numericValue));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timer);
  }, [numericValue, delay, isNumeric]);

  const displayValue = isNumeric
    ? `${prefix}${displayed.toLocaleString()}${suffix}`
    : value;

  const sparkColor = trend === 'up' ? '#34d399' : trend === 'down' ? '#fb7185' : '#818cf8';

  return (
    <div
      className="card-surface metric-card-glow p-5 transition-all duration-300 hover:shadow-[var(--shadow-interactive)] group animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} shrink-0 transition-transform duration-300 group-hover:scale-110`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {change && trend !== 'neutral' && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend === 'up'
              ? 'text-emerald-500 bg-emerald-500/10'
              : 'text-red-400 bg-red-500/10'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {change}
          </span>
        )}
      </div>

      <div className="animate-count-up" style={{ animationDelay: `${delay + 100}ms` }}>
        <div className="text-2xl font-bold text-text-main tracking-tight mb-0.5">
          {displayValue}
        </div>
        <div className="text-label-caps text-text-muted mb-1">{label}</div>
        {subtitle && <div className="text-xs text-text-muted/70">{subtitle}</div>}
      </div>

      {sparkline && sparkline.length > 0 && (
        <div className="mt-3 opacity-70 group-hover:opacity-100 transition-opacity">
          <Sparkline data={sparkline} color={sparkColor} />
        </div>
      )}
    </div>
  );
}
