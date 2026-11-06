import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AssistantPanel, type AssistantEntityContext } from './AssistantPanel';
import type { AccessMode } from './AssistantComposer';

export interface AssistantLauncherProps {
  surface: 'dashboard' | 'crm' | 'conversations' | 'email_marketing' | 'business' | 'calendar' | 'automations' | 'ads';
  entity?: AssistantEntityContext;
  label?: string;
  variant?: 'button' | 'icon' | 'outline' | 'subtle';
  initialPrompt?: string;
  initialMode?: AccessMode;
  onApplyDraft?: (draftContent: string) => void;
  className?: string;
}

export function AssistantLauncher({
  surface,
  entity,
  label = 'Ask Stone AI',
  variant = 'button',
  initialPrompt,
  initialMode,
  onApplyDraft,
  className = '',
}: AssistantLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getButtonStyles = () => {
    switch (variant) {
      case 'icon':
        return 'p-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all';
      case 'outline':
        return 'flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/70 hover:bg-bg-secondary text-text-main text-xs font-medium transition-all';
      case 'subtle':
        return 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-secondary/60 hover:bg-bg-secondary text-text-muted hover:text-text-main text-xs transition-all';
      case 'button':
      default:
        return 'flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-medium shadow-xs transition-all';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`${getButtonStyles()} ${className}`}
        title={label}
      >
        <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
        {variant !== 'icon' && <span>{label}</span>}
      </button>

      <AssistantPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        surface={surface}
        entity={entity}
        initialAction={initialPrompt ? { prompt: initialPrompt, mode: initialMode } : undefined}
        onApplyDraft={onApplyDraft}
      />
    </>
  );
}
