import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssistantComposer } from '../AssistantComposer';
import { AssistantThread } from '../AssistantThread';
import { MarkdownRenderer } from '../MarkdownRenderer';

describe('Assistant Frontend Components Suite', () => {
  it('renders AssistantComposer with input, mode chip, model chip, and disclaimer', () => {
    const handleSend = vi.fn();
    const handleModeChange = vi.fn();

    render(
      <MemoryRouter>
        <AssistantComposer
          input=""
          setInput={vi.fn()}
          onSend={handleSend}
          isStreaming={false}
          mode="read_only"
          onModeChange={handleModeChange}
        />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText('Reply')).toBeInTheDocument();
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(screen.getByText('Sonnet 5.5')).toBeInTheDocument();
    expect(screen.getByText(/Stone AI can make mistakes/)).toBeInTheDocument();
  });

  it('shows character counter when input is within 1,000 characters of the limit', () => {
    const longInput = 'A'.repeat(19500);

    render(
      <MemoryRouter>
        <AssistantComposer
          input={longInput}
          setInput={vi.fn()}
          onSend={vi.fn()}
          isStreaming={false}
          mode="read_only"
          onModeChange={vi.fn()}
          maxChars={20000}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/19,500 \/ 20,000/)).toBeInTheDocument();
  });

  it('renders AssistantThread with user bubble and Stone AI markdown response', () => {
    const mockMessages = [
      {
        id: 'msg-1',
        conversationId: 'c-1',
        userId: 'user-1',
        role: 'user' as const,
        parts: [{ type: 'text', text: 'What is our revenue target?' }],
        searchableText: 'What is our revenue target?',
        status: 'complete',
        inputTokens: 10,
        outputTokens: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        conversationId: 'c-1',
        userId: 'assistant',
        role: 'assistant' as const,
        parts: [{ type: 'text', text: 'Our revenue target is **$500,000** this quarter.' }],
        searchableText: 'Our revenue target is **$500,000** this quarter.',
        status: 'complete',
        inputTokens: 10,
        outputTokens: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    render(
      <AssistantThread
        messages={mockMessages}
        isStreaming={false}
        streamingText=""
        isThinking={false}
        onRegenerate={vi.fn()}
        onEditMessage={vi.fn()}
        onFeedback={vi.fn()}
      />
    );

    expect(screen.getByText('What is our revenue target?')).toBeInTheDocument();
    expect(screen.getByText('Stone AI')).toBeInTheDocument();
    expect(screen.getByText('$500,000')).toBeInTheDocument();
  });

  it('displays temporary chat notice when isTemporary is true', () => {
    render(
      <AssistantThread
        messages={[]}
        isStreaming={false}
        streamingText=""
        isThinking={false}
        onRegenerate={vi.fn()}
        onEditMessage={vi.fn()}
        onFeedback={vi.fn()}
        isTemporary={true}
      />
    );

    expect(screen.getByText('Temporary chat. This conversation won’t be saved.')).toBeInTheDocument();
  });

  it('MarkdownRenderer safely displays remote images as plain links with visible domain', () => {
    const markdown = 'Here is an image: ![Cat](https://example.com/cat.png)';
    render(<MarkdownRenderer content={markdown} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com/cat.png');
    expect(screen.getByText(/example\.com/)).toBeInTheDocument();
  });
});
