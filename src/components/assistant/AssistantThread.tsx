import React, { useState, useRef, useEffect } from 'react';
import {
  Copy, Check, RotateCcw, ThumbsUp, ThumbsDown,
  Edit2, ArrowDown, AlertTriangle, ShieldAlert, Volume2, VolumeX
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ActionCard, type ActionCardProps } from './ActionCards';
import type { AssistantMessage } from '../../lib/api/assistant';

interface AssistantThreadProps {
  messages: AssistantMessage[];
  isStreaming: boolean;
  streamingText: string;
  isThinking: boolean;
  actionCards?: ActionCardProps[];
  onSelectMode?: (mode: string) => void;
  onActionComplete?: () => void;
  onRegenerate: () => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onFeedback: (messageId: string, rating: 'up' | 'down', comment?: string) => void;
  onRetryError?: () => void;
  lastError?: { code: string; message: string; retryable: boolean } | null;
  isTemporary?: boolean;
}

export function AssistantThread({
  messages,
  isStreaming,
  streamingText,
  isThinking,
  actionCards = [],
  onSelectMode,
  onActionComplete,
  onRegenerate,
  onEditMessage,
  onFeedback,
  onRetryError,
  lastError,
  isTemporary = false,
}: AssistantThreadProps) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackPromptId, setFeedbackPromptId] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stop speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggleSpeak = (id: string, text: string) => {
    if (!('speechSynthesis' in window)) return;
    if (speakingMessageId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingMessageId(id);
    }
  };

  // Auto-scroll on new streaming text
  useEffect(() => {
    if (!showScrollBottom && typeof threadEndRef.current?.scrollIntoView === 'function') {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingText, isThinking, showScrollBottom]);

  // Track scroll position to show "Jump to latest"
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceToBottom > 250);
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore copy error
    }
  };

  const handleStartEdit = (msg: AssistantMessage) => {
    const text = msg.searchableText || (msg.parts?.[0]?.text as string) || '';
    setEditingMessageId(msg.id);
    setEditInput(text);
  };

  const handleConfirmEdit = (messageId: string) => {
    if (!editInput.trim()) return;
    if (window.confirm('Editing will remove the replies after this message.')) {
      onEditMessage(messageId, editInput.trim());
      setEditingMessageId(null);
    }
  };

  const scrollToBottom = () => {
    if (typeof threadEndRef.current?.scrollIntoView === 'function') {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    setShowScrollBottom(false);
  };

  const assistantMessages = messages.filter((m) => m.role === 'assistant');
  const lastAssistantMessageId = assistantMessages[assistantMessages.length - 1]?.id;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-6 relative custom-scrollbar select-text"
    >
      {/* Temporary Chat Notice Banner */}
      {isTemporary && (
        <div className="max-w-3xl mx-auto px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2 select-none shadow-sm">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Temporary chat. This conversation won’t be saved.</span>
        </div>
      )}

      {/* Messages List */}
      <div className="max-w-3xl mx-auto space-y-7">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const text = m.searchableText || (m.parts?.[0]?.text as string) || '';

          if (isUser) {
            return (
              <div key={m.id} className="flex justify-end w-full group">
                <div className="max-w-[80%] space-y-1.5">
                  {editingMessageId === m.id ? (
                    <div className="p-3 rounded-2xl bg-surface-hover/80 border border-border/60 space-y-2">
                      <textarea
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        className="w-full text-[14.5px] text-text-main bg-transparent outline-none resize-none"
                        rows={3}
                      />
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setEditingMessageId(null)}
                          className="px-2.5 py-1 rounded border border-border/50 text-text-muted hover:text-text-main"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmEdit(m.id)}
                          className="px-2.5 py-1 rounded bg-primary text-white hover:opacity-90 font-medium"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-2.5 rounded-2xl bg-[#2D2D2E] text-[#ECECEC] text-[14.5px] leading-relaxed shadow-sm space-y-2">
                        {Array.isArray(m.parts) &&
                          m.parts.map((p, idx) =>
                            p.type === 'image' && p.data ? (
                              <img
                                key={idx}
                                src={p.data as string}
                                alt={(p.name as string) || 'Attachment'}
                                className="max-w-[280px] max-h-[200px] object-cover rounded-lg border border-white/20"
                              />
                            ) : null
                          )}
                        {text && <div>{text}</div>}
                      </div>

                      {/* User message hover actions */}
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-text-muted">
                        <button
                          type="button"
                          onClick={() => handleCopy(m.id, text)}
                          aria-label="Copy message"
                          className="p-1 rounded hover:bg-surface-hover hover:text-text-main transition-colors"
                        >
                          {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(m)}
                          aria-label="Edit message"
                          className="p-1 rounded hover:bg-surface-hover hover:text-text-main transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          }

          // Assistant message
          const isLastAssistant = m.id === lastAssistantMessageId;
          const isStopped = m.status === 'stopped';

          return (
            <div key={m.id} className="w-full space-y-1.5 group">
              {isStopped && (
                <span className="text-[11px] font-normal text-text-muted px-1.5 py-0.5 rounded bg-surface-hover border border-border/40 inline-block mb-1">
                  Stopped
                </span>
              )}

              <div className="text-text-main text-[14px] leading-relaxed">
                <MarkdownRenderer content={text} />
              </div>

              {/* Assistant Actions Row */}
              <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-text-muted">
                <button
                  type="button"
                  onClick={() => handleCopy(m.id, text)}
                  aria-label="Copy message"
                  className="p-1.5 rounded-lg hover:bg-surface-hover hover:text-text-main transition-colors"
                >
                  {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleSpeak(m.id, text)}
                  aria-label={speakingMessageId === m.id ? 'Stop reading' : 'Read aloud'}
                  title={speakingMessageId === m.id ? 'Stop' : 'Read aloud'}
                  className={`p-1.5 rounded-lg hover:bg-surface-hover hover:text-text-main transition-colors ${
                    speakingMessageId === m.id ? 'text-primary animate-pulse' : ''
                  }`}
                >
                  {speakingMessageId === m.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                {isLastAssistant && !isStreaming && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    aria-label="Regenerate reply"
                    className="p-1.5 rounded-lg hover:bg-surface-hover hover:text-text-main transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onFeedback(m.id, 'up')}
                  aria-label="Thumbs up"
                  className={`p-1.5 rounded-lg hover:bg-surface-hover hover:text-text-main transition-colors ${
                    m.feedback?.rating === 'up' ? 'text-primary font-semibold' : ''
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (feedbackPromptId === m.id) {
                      setFeedbackPromptId(null);
                    } else {
                      setFeedbackPromptId(m.id);
                    }
                  }}
                  aria-label="Thumbs down"
                  className={`p-1.5 rounded-lg hover:bg-surface-hover hover:text-text-main transition-colors ${
                    m.feedback?.rating === 'down' ? 'text-rose-500 font-semibold' : ''
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Optional Feedback Comment Box */}
              {feedbackPromptId === m.id && (
                <div className="mt-2 p-2.5 rounded-xl border border-border bg-bg-card space-y-2 max-w-sm animate-in fade-in text-xs">
                  <p className="font-medium text-text-main">What could have been better?</p>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Optional feedback..."
                    rows={2}
                    className="w-full p-2 text-xs rounded-lg bg-surface-hover/50 border border-border/50 text-text-main outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setFeedbackPromptId(null)}
                      className="px-2.5 py-1 rounded text-text-muted hover:text-text-main"
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onFeedback(m.id, 'down', feedbackComment.trim());
                        setFeedbackPromptId(null);
                        setFeedbackComment('');
                      }}
                      className="px-2.5 py-1 rounded bg-primary text-white font-medium hover:opacity-90"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Live Streaming Message */}
        {isStreaming && (
          <div className="w-full space-y-1.5 animate-in fade-in">
            {streamingText ? (
              <div className="text-text-main text-[14px] leading-relaxed" aria-live="polite">
                <MarkdownRenderer content={streamingText} />
                <span className="inline-block w-1.5 h-4 ml-1 bg-text-muted/60 animate-pulse align-middle" />
              </div>
            ) : (
              <div className="text-xs text-text-muted/70 italic flex items-center gap-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-text-muted/60 animate-ping" />
                <span>Thinking...</span>
              </div>
            )}
          </div>
        )}

        {/* Inline Error Bubble */}
        {lastError && (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{lastError.message}</span>
            </div>
            {lastError.retryable && onRetryError && (
              <button
                type="button"
                onClick={onRetryError}
                className="px-2.5 py-1 rounded font-medium bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm shrink-0"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* Action Cards & Approvals */}
        {actionCards && actionCards.length > 0 && (
          <div className="space-y-3 pt-2">
            {actionCards.map((card, idx) => (
              <ActionCard
                key={card.toolCallId || idx}
                {...card}
                onModeSelected={onSelectMode}
                onActionComplete={onActionComplete}
              />
            ))}
          </div>
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Floating Jump to Latest Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Jump to latest"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#2A2A2B] border border-[#3E3E3E] shadow-lg flex items-center justify-center text-[#8E8E8E] hover:text-white hover:bg-[#343435] transition-all z-20 cursor-pointer"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
