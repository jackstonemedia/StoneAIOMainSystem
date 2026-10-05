/**
 * Stone AIO — Frontend Feature Flags & Scope Parking
 * Controls visibility of launch modules vs. parked modules in Sidebar, Routes, and Command Palette.
 */

export interface FeatureFlags {
  ads: boolean;
  sdr: boolean;
  leads: boolean;
  agents: boolean;
  marketplace: boolean;
  assistant: boolean;
  projects: boolean;
  reputation: boolean;
  inboxHelpCenter: boolean;
}

const env = ((import.meta as any).env || {}) as Record<string, string | undefined>;

export const FEATURES: FeatureFlags = {
  ads: env.VITE_FEATURE_ADS === 'true',
  sdr: env.VITE_FEATURE_SDR === 'true',
  leads: env.VITE_FEATURE_LEADS === 'true',
  agents: env.VITE_FEATURE_AGENTS === 'true',
  marketplace: env.VITE_FEATURE_MARKETPLACE === 'true',
  assistant: env.VITE_FEATURE_ASSISTANT === 'true',
  projects: env.VITE_FEATURE_PROJECTS === 'true',
  reputation: env.VITE_FEATURE_REPUTATION === 'true',
  inboxHelpCenter: env.VITE_FEATURE_HELP_CENTER === 'true',
};
