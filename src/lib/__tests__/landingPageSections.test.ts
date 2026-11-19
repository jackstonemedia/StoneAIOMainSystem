/**
 * Landing page section helpers — Wave 1 item 1.1, Slice 2.
 * Pure list operations the builder depends on: add / move / remove / edit.
 */
import { describe, it, expect } from 'vitest';
import {
  createSection,
  moveSection,
  removeSection,
  updateSectionConfig,
  hasFormSection,
  SECTION_LABELS,
} from '../../lib/landingPageSections';
import type { PageSection } from '../../types';

function section(id: string, type: PageSection['type'] = 'text'): PageSection {
  return { id, type, config: { heading: id } };
}

describe('landingPageSections', () => {
  it('createSection gives a fresh id and the type default config', () => {
    const a = createSection('hero');
    const b = createSection('hero');
    expect(a.id).not.toBe(b.id);
    expect(a.config.heading).toBe('Your headline here');
    expect(SECTION_LABELS.form).toBe('Form');
  });

  it('moveSection swaps neighbours and refuses to move past the ends', () => {
    const list = [section('a'), section('b'), section('c')];
    expect(moveSection(list, 'b', 'up').map((s) => s.id)).toEqual(['b', 'a', 'c']);
    expect(moveSection(list, 'b', 'down').map((s) => s.id)).toEqual(['a', 'c', 'b']);
    expect(moveSection(list, 'a', 'up')).toEqual(list);
    expect(moveSection(list, 'c', 'down')).toEqual(list);
    expect(moveSection(list, 'nope', 'up')).toEqual(list);
  });

  it('removeSection drops only the named section', () => {
    const list = [section('a'), section('b')];
    expect(removeSection(list, 'a').map((s) => s.id)).toEqual(['b']);
  });

  it('updateSectionConfig patches one section and leaves the rest alone', () => {
    const list = [section('a'), section('b')];
    const next = updateSectionConfig(list, 'a', { heading: 'New' });
    expect(next[0].config.heading).toBe('New');
    expect(next[1].config.heading).toBe('b');
    expect(list[0].config.heading).toBe('a');
  });

  it('hasFormSection detects a form anywhere in the list', () => {
    expect(hasFormSection([section('a'), section('b', 'form')])).toBe(true);
    expect(hasFormSection([section('a')])).toBe(false);
  });
});
