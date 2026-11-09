/**
 * Create with AI — interview thread (round 2, 2026-11-08).
 *
 * Shared message list for the interview chat and for the artifact step's
 * left pane (history only). Styled like the AI assistant's active thread:
 * #1E1E1E background, user messages as right-aligned #2D2D2E bubbles,
 * assistant messages as plain text with no bubble, system notes centered
 * and muted, and a small serif-italic "Thinking…" pill while the AI works.
 */

import React, { useEffect, useRef } from 'react';
import type { ChatMessageState } from '../../lib/createWithAiApi';

export default function InterviewThread({
  messages,
  sending = false,
}: {
  messages: ChatMessageState[];
  sending?: boolean;
}) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages.length, sending]);

  return (
    <div className="max-w-3xl mx-auto w-full space-y-7" data-testid="interview-thread">
      {messages
        .filter((m) => m.kind !== 'brief')
        .map((m: ChatMessageState, i: number) => {
          if (m.kind === 'system') {
            return (
              <p key={i} className="text-[11px] text-center text-[#8A8A8D] py-1 font-medium">
                {m.text}
              </p>
            );
          }
          const isUser = m.role === 'user';
          if (isUser) {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] px-4 py-2.5 text-[14.5px] rounded-2xl leading-relaxed whitespace-pre-wrap bg-[#2D2D2E] text-[#ECECEC]">
                  {m.text}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="text-[14px] leading-relaxed whitespace-pre-wrap text-[#ECECEC]">
              {m.text}
            </div>
          );
        })}

      {sending && (
        <p className="text-[12px] italic font-serif text-[#8E8E93]">
          <span className="inline-flex items-center rounded-full border border-[#343437] px-2.5 py-1">
            Thinking…
          </span>
        </p>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
