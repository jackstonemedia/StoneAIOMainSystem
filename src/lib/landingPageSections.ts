/**
 * Pure section-list helpers for the landing page builder (Wave 1 item 1.1).
 * Kept pure so they are unit-testable without rendering the builder.
 */
import type { LandingPageSectionType, PageSection } from '../types';

export const SECTION_TYPES: LandingPageSectionType[] = ['hero', 'text', 'image', 'form', 'cta'];

export const SECTION_LABELS: Record<LandingPageSectionType, string> = {
  hero: 'Hero',
  text: 'Text',
  image: 'Image',
  form: 'Form',
  cta: 'Call to action',
};

export function defaultConfig(type: LandingPageSectionType): Record<string, unknown> {
  switch (type) {
    case 'hero':
      return { heading: 'Your headline here', subheading: '', buttonText: 'Get started' };
    case 'text':
      return { heading: '', body: 'Write something useful here.' };
    case 'image':
      return { src: '', alt: '', caption: '' };
    case 'form':
      return { heading: 'Get in touch', buttonText: 'Submit' };
    case 'cta':
      return { heading: 'Ready to start?', buttonText: 'Get started' };
  }
}

let idCounter = 0;
export function newSectionId(): string {
  idCounter += 1;
  return `sec-${Date.now().toString(36)}-${idCounter}`;
}

export function createSection(type: LandingPageSectionType): PageSection {
  return { id: newSectionId(), type, config: defaultConfig(type) };
}

export function moveSection(sections: PageSection[], id: string, direction: 'up' | 'down'): PageSection[] {
  const i = sections.findIndex((s) => s.id === id);
  if (i === -1) return sections;
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= sections.length) return sections;
  const next = [...sections];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function removeSection(sections: PageSection[], id: string): PageSection[] {
  return sections.filter((s) => s.id !== id);
}

export function updateSectionConfig(
  sections: PageSection[],
  id: string,
  patch: Record<string, unknown>,
): PageSection[] {
  return sections.map((s) => (s.id === id ? { ...s, config: { ...s.config, ...patch } } : s));
}

export function hasFormSection(sections: PageSection[]): boolean {
  return sections.some((s) => s.type === 'form');
}
