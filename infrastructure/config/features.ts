/**
 * Stone AIO — Feature Flags & Scope Parking
 * Controls active vs. parked modules across the backend (routes, workers, crons).
 * Parked modules are disabled for the paying-customer launch scope.
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

export const FEATURES: FeatureFlags = {
  ads: process.env.FEATURE_ADS === 'true',
  sdr: process.env.FEATURE_SDR === 'true',
  leads: process.env.FEATURE_LEADS === 'true',
  agents: process.env.FEATURE_AGENTS === 'true',
  marketplace: process.env.FEATURE_MARKETPLACE === 'true',
  assistant: process.env.FEATURE_ASSISTANT === 'true',
  projects: process.env.FEATURE_PROJECTS === 'true',
  reputation: process.env.FEATURE_REPUTATION === 'true',
  inboxHelpCenter: process.env.FEATURE_HELP_CENTER === 'true',
};
