import { describe, it, expect } from 'vitest';
import { grapesjsToBlockJson } from '../grapesjsToBlockJson';
import { blockJsonToGrapesjs } from '../blockJsonToGrapesjs';
import type { BlockJson } from '../grapesjsToBlockJson';

describe('Email Builder Adapters', () => {
  it('converts basic BlockJson to HTML for GrapesJS editor', () => {
    const input: BlockJson = {
      blocks: [
        {
          id: 'b-1',
          type: 'HEADER_LOGO',
          props: { logoUrl: 'https://example.com/logo.png', altText: 'Logo', align: 'center', width: '120px' },
        },
        {
          id: 'b-2',
          type: 'TEXT',
          props: { text: 'Hello {{contact.first_name}}!' },
        },
        {
          id: 'b-3',
          type: 'BUTTON',
          props: { label: 'Click Me', href: 'https://example.com', buttonColor: '#6366f1' },
        },
        {
          id: 'b-4',
          type: 'DIVIDER',
          props: { color: '#e5e7eb' },
        },
      ],
    };

    const result = blockJsonToGrapesjs(input);
    expect(result.html).toContain('https://example.com/logo.png');
    expect(result.html).toContain('Hello {{contact.first_name}}!');
    expect(result.html).toContain('Click Me');
  });

  it('converts raw HTML string to BlockJson TEXT block', () => {
    const html = '<p>Simple paragraph with <a href="#">link</a></p>';
    const result = grapesjsToBlockJson(html);
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.blocks[0].type).toBe('TEXT');
    expect(result.blocks[0].props.html).toBe(html);
  });

  it('parses structured HTML components back into typed EmailBlocks', () => {
    const html = `
      <div data-gjs-type="image" src="https://example.com/hero.jpg" alt="Hero"></div>
      <div data-gjs-type="text"><p>Paragraph content</p></div>
      <a data-gjs-type="link" href="https://stoneaio.com" class="button">Visit Us</a>
      <hr />
    `;
    const result = grapesjsToBlockJson(html);
    expect(result.blocks.length).toBe(4);
    expect(result.blocks[0].type).toBe('IMAGE');
    expect(result.blocks[1].type).toBe('TEXT');
    expect(result.blocks[2].type).toBe('BUTTON');
    expect(result.blocks[3].type).toBe('DIVIDER');
  });
});
