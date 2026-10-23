import { describe, it, expect } from 'vitest';
import {
  PHASE_DEFINITIONS,
  getPhaseDefinition,
  isPhaseComplete,
  mergeBriefFacts,
  initCampaignBrief,
  type PhaseId,
} from '../phase-definitions.js';
import type { CampaignBrief } from '../campaign-brief.types.js';

describe('Phase Definitions & Campaign Brief Architecture', () => {
  it('defines all 8 phases in correct order with objectives and completion criteria', () => {
    const phases: PhaseId[] = [
      'goal',
      'audience',
      'cta',
      'sequence',
      'reactions',
      'ab_testing',
      'draft_refine',
      'review_send',
    ];

    expect(Object.keys(PHASE_DEFINITIONS)).toHaveLength(8);

    for (const phase of phases) {
      const def = getPhaseDefinition(phase);
      expect(def).toBeDefined();
      expect(def.id).toBe(phase);
      expect(def.title).toBeTruthy();
      expect(def.objective).toBeTruthy();
      expect(Array.isArray(def.requiredFields)).toBe(true);
      expect(Array.isArray(def.niceToHaveFields)).toBe(true);
    }
  });

  it('prioritizes business context and discovery in Phase 1 (goal)', () => {
    const goalDef = getPhaseDefinition('goal');
    expect(goalDef.requiredFields).toContain('goal');
    expect(goalDef.niceToHaveFields).toContain('customerPainPoints');
  });

  it('correctly assesses phase completion based on brief contents', () => {
    const brief: CampaignBrief = {
      version: 1,
      goal: 'Get more clients using cold outreach',
      businessDescription: 'B2B Lead Generation Agency for Roofing Contractors',
    };

    expect(isPhaseComplete('goal', brief)).toBe(true);

    const incompleteBrief: CampaignBrief = {
      version: 1,
    };
    expect(isPhaseComplete('goal', incompleteBrief)).toBe(false);
  });

  it('merges new facts into CampaignBrief and increments version', () => {
    const initial = initCampaignBrief();

    expect(initial.version).toBe(1);

    const updated = mergeBriefFacts(initial, {
      goal: 'Get 5 new commercial maintenance contracts',
      customerPainPoints: ['Roof leaks disrupting tenant business'],
      targetCustomer: 'Commercial property managers',
    });

    expect(updated.version).toBe(2);
    expect(updated.goal).toBe('Get 5 new commercial maintenance contracts');
    expect(updated.customerPainPoints).toEqual(['Roof leaks disrupting tenant business']);
    expect(updated.targetCustomer).toBe('Commercial property managers');
  });

  it('captures facts volunteered for later phases without losing them', () => {
    const initial = initCampaignBrief({});
    const updated = mergeBriefFacts(initial, {
      goal: 'Re-engage lost accounts',
      cta: { action: 'Reply with your availability for a 10-min review' },
    });

    expect(updated.goal).toBe('Re-engage lost accounts');
    expect(updated.cta?.action).toBe('Reply with your availability for a 10-min review');
  });
});
