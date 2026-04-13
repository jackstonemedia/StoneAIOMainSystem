interface LeadScoreRingProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export default function LeadScoreRing({ score = 0, size = 36, strokeWidth = 3, showLabel = true }: LeadScoreRingProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedScore / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 75) return '#52677D'; // green
    if (s >= 50) return '#52677D'; // amber
    if (s >= 25) return '#52677D'; // blue
    return '#52677D'; // gray
  };

  const color = getColor(clampedScore);

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border opacity-40"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease', filter: `drop-shadow(0 0 4px ${color}66)` }}
        />
      </svg>
      {showLabel && (
        <span
          className="absolute text-[9px] font-bold leading-none"
          style={{ color }}
        >
          {clampedScore}
        </span>
      )}
    </div>
  );
}
