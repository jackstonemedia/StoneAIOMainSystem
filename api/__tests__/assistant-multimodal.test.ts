/**
 * Stage S5: Multi-Modal Vision & Voice Tests
 * Spec Section 2.5 & Stage S5
 */

import { describe, it, expect } from 'vitest';
import { chatEngine } from '../../packages/ai/engine/chat-engine.js';

describe('Multimodal Vision Payload Formatting', () => {
  it('formats image parts into Gemini inlineData structure stripping data URI prefix', () => {
    const rawBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const dataUri = `data:image/png;base64,${rawBase64}`;

    const messages = [
      {
        role: 'user' as const,
        parts: [
          { type: 'text', text: 'What is inside this screenshot?' },
          { type: 'image', mimeType: 'image/png', data: dataUri, name: 'screenshot.png' },
        ],
      },
    ];

    // Access formatContents via chatEngine internal test
    const formatted = (chatEngine as any).formatContents(messages);

    expect(formatted.length).toBe(1);
    expect(formatted[0].role).toBe('user');
    expect(formatted[0].parts.length).toBe(2);
    expect(formatted[0].parts[0]).toEqual({ text: 'What is inside this screenshot?' });
    expect(formatted[0].parts[1]).toEqual({
      inlineData: {
        mimeType: 'image/png',
        data: rawBase64,
      },
    });
  });

  it('handles multiple attachments including PDF or CSV documents', () => {
    const messages = [
      {
        role: 'user' as const,
        parts: [
          { type: 'text', text: 'Review these documents' },
          { type: 'image', mimeType: 'application/pdf', data: 'JVBERi0xLjQK...', name: 'doc.pdf' },
        ],
      },
    ];

    const formatted = (chatEngine as any).formatContents(messages);
    expect(formatted[0].parts[1].inlineData.mimeType).toBe('application/pdf');
    expect(formatted[0].parts[1].inlineData.data).toBe('JVBERi0xLjQK...');
  });
});
