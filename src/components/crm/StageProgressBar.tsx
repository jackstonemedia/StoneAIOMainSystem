interface StageProgressBarProps {
  stages: { name: string; color: string }[];
  currentStage: string;
  className?: string;
}

export default function StageProgressBar({ stages, currentStage, className = '' }: StageProgressBarProps) {
  const currentIdx = stages.findIndex(s => s.name.toLowerCase() === currentStage.toLowerCase());
  const progress = currentIdx >= 0 ? ((currentIdx + 1) / stages.length) * 100 : 0;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {stages.map((stage, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        return (
          <div
            key={stage.name}
            title={stage.name}
            className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${
              isDone
                ? 'bg-primary opacity-60'
                : isActive
                ? 'bg-primary shadow-[0_0_6px_var(--color-primary)]'
                : 'bg-border/50'
            }`}
          />
        );
      })}
    </div>
  );
}
