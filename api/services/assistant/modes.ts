/**
 * Access Mode & Authorization Gate — Stone AIO
 * Spec Section 2.9
 */

export type ToolRisk = 'read' | 'write' | 'send' | 'destructive' | 'hardstop';
export type AccessMode = 'unset' | 'read_only' | 'draft' | 'full';

export interface GateEvaluationInput {
  chatMode: AccessMode;
  workspaceMaxMode?: AccessMode;
  userRole: string; // 'owner' | 'admin' | 'member'
  toolRisk: ToolRisk;
  minimumRole: string; // 'owner' | 'admin' | 'member'
  affectedRecordsCount?: number;
  bulkThreshold?: number;
  requiresExplicitApproval?: boolean;
  hasUntrustedContent?: boolean;
  isPaused?: boolean;
  capability?: string;
  capabilityEnabled?: boolean;
  dailyLimitExceeded?: boolean;
}

export type GateDecision =
  | { action: 'execute' }
  | { action: 'proposal'; reason?: string }
  | { action: 'needs_approval'; reason: string }
  | { action: 'blocked'; reason: string }
  | { action: 'no_permission'; requiredRole: string; currentRole: string }
  | { action: 'mode_prompt' };

/**
 * Checks role hierarchy: owner satisfies admin, admin satisfies member.
 */
export function hasMinimumRole(userRole: string, minimumRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    member: 1,
    admin: 2,
    owner: 3,
  };

  const userLevel = roleHierarchy[userRole.toLowerCase()] || 1;
  const minLevel = roleHierarchy[minimumRole.toLowerCase()] || 1;

  return userLevel >= minLevel;
}

/**
 * Computes effective mode: lowest of chatMode and workspaceMaxMode.
 */
export function getEffectiveMode(
  chatMode: AccessMode,
  workspaceMaxMode: AccessMode = 'full',
  isFullAutonomyAllowedForUser: boolean = true
): AccessMode {
  if (chatMode === 'unset') return 'unset';

  const modeRank: Record<AccessMode, number> = {
    unset: 0,
    read_only: 1,
    draft: 2,
    full: 3,
  };

  let maxAllowedRank = modeRank[workspaceMaxMode] || 3;
  if (!isFullAutonomyAllowedForUser && maxAllowedRank > 2) {
    maxAllowedRank = 2; // Capped at Draft if user not authorized for full autonomy
  }

  const chatRank = modeRank[chatMode] || 1;
  const effectiveRank = Math.min(chatRank, maxAllowedRank);

  for (const [mode, rank] of Object.entries(modeRank) as [AccessMode, number][]) {
    if (rank === effectiveRank) return mode;
  }

  return 'read_only';
}

/**
 * Evaluates whether a tool call may execute, must be proposed, requires hard stop approval, or is blocked.
 */
export function evaluateModeGate(input: GateEvaluationInput): GateDecision {
  const {
    chatMode,
    workspaceMaxMode = 'full',
    userRole,
    toolRisk,
    minimumRole,
    affectedRecordsCount = 1,
    bulkThreshold = 25,
    requiresExplicitApproval = false,
    hasUntrustedContent = false,
    isPaused = false,
    capability,
    capabilityEnabled = true,
    dailyLimitExceeded = false,
  } = input;

  // 1. Role verification
  if (!hasMinimumRole(userRole, minimumRole)) {
    return {
      action: 'no_permission',
      requiredRole: minimumRole,
      currentRole: userRole,
    };
  }

  // 2. Reads execute in all modes (even if paused)
  if (toolRisk === 'read') {
    return { action: 'execute' };
  }

  // 3. Paused assistant check (forced read-only by workspace administrator)
  if (isPaused) {
    return {
      action: 'blocked',
      reason: 'Assistant actions are currently paused by a workspace administrator.',
    };
  }

  // 4. Mode unset prompt: first non-read tool ends turn with mode prompt
  if (chatMode === 'unset') {
    return { action: 'mode_prompt' };
  }

  const isFullAutonomyAllowed = hasMinimumRole(userRole, 'admin'); // Default D6: admins/owners only
  const effectiveMode = getEffectiveMode(chatMode, workspaceMaxMode, isFullAutonomyAllowed);

  if (effectiveMode === 'read_only') {
    return {
      action: 'blocked',
      reason: 'I can’t do that in Read-only mode.',
    };
  }

  // 5. Untrusted-content rule (Prompt injection defense)
  // If the current turn read external or untrusted content, non-read tools MUST queue for approval
  if (hasUntrustedContent) {
    return {
      action: 'needs_approval',
      reason: 'Asked first because untrusted content (inbound message, web page, or uploaded file) was read in this conversation.',
    };
  }

  // 6. Hard stops & bulk threshold check
  const isBulkExceeded = affectedRecordsCount > bulkThreshold;
  const isHardStop = toolRisk === 'hardstop' || isBulkExceeded || requiresExplicitApproval;

  if (effectiveMode === 'draft') {
    if (isHardStop) {
      return {
        action: 'needs_approval',
        reason: isBulkExceeded
          ? `Touches ${affectedRecordsCount} records (exceeds threshold of ${bulkThreshold})`
          : 'High-risk action requiring your explicit approval',
      };
    }
    return {
      action: 'proposal',
      reason: 'Draft mode proposal',
    };
  }

  if (effectiveMode === 'full') {
    if (isHardStop) {
      return {
        action: 'needs_approval',
        reason: isBulkExceeded
          ? `Touches ${affectedRecordsCount} records (exceeds bulk threshold of ${bulkThreshold})`
          : 'Action requires explicit approval even in Full autonomy',
      };
    }

    // Capability switch check in autonomous mode
    if (capability && capabilityEnabled === false) {
      return {
        action: 'proposal',
        reason: `The "${capability}" capability is not enabled for autonomous execution in workspace settings.`,
      };
    }

    // Daily limit check in autonomous mode
    if (dailyLimitExceeded) {
      return {
        action: 'needs_approval',
        reason: 'Daily outreach limit reached for this capability; requires approval.',
      };
    }

    return { action: 'execute' };
  }

  return { action: 'blocked', reason: 'Action blocked by policy.' };
}
