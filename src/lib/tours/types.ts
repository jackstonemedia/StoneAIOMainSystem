export type TourStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface TourStep {
  id: string;
  target: string;
  title: string;
  body: string;
  placement?: TooltipPlacement;
  route?: string;
  pointAndClick?: boolean;
  spotlightPadding?: number;
  action?: {
    label: string;
    onClick?: () => void;
  };
}

export interface Tour {
  key: string;
  title: string;
  description: string;
  section: string;
  iconName?: string;
  badge?: string;
  steps: TourStep[];
}

export interface TourProgressItem {
  status: TourStatus;
  stepIndex: number;
  completedAt?: string;
}

export interface GettingStartedMilestone {
  id: string;
  title: string;
  description: string;
  section: string;
  route: string;
  tourKey: string;
  icon: string;
}
