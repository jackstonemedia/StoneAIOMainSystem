import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, X, Maximize2, ArrowRight
} from 'lucide-react';
import { AssistantThread } from './AssistantThread';
import {
  AssistantComposer,
  type AccessMode,
  type ComposerAttachment,
} from './AssistantComposer';
import {
  assistantApi,
  type AssistantConversation,
  type AssistantMessage,
} from '../../lib/api/assistant';
import type { ActionCardProps } from './ActionCards';

export interface AssistantEntityContext {
  type: 'contact' | 'deal' | 'company' | 'conversation' | 'campaign' | 'workflow';
  id: string;
  name?: string;
}

export interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  surface: 'dashboard' | 'crm' | 'conversations' | 'email_marketing' | 'business' | 'calendar' | 'automations' | 'ads';
  entity?: AssistantEntityContext;
  initialAction?: {
    prompt: string;
    mode?: AccessMode;
  };
  onApplyDraft?: (draftContent: string) => void;
}

export function AssistantPanel({
  isOpen,
  onClose,
  surface,
  entity,
  initialAction,
  onApplyDraft,
}: AssistantPanelProps) {
  const navigate = useNavigate();

  const [conversation, setConversation] = useState<AssistantConversation | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<AccessMode>(initialAction?.mode || 'read_only');
  const [thinking, setThinking] = useState<'auto' | 'extended'>('auto');

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [lastError, setLastError] = useState<{ code: string; message: string; retryable: boolean } | null>(null);
  const [actionCards, setActionCards] = useState<ActionCardProps[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const initialActionSentRef = useRef<boolean>(false);

  // Initialize or fetch conversation when opening
  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    async function init() {
      try {
        const title = entity?.name
          ? `${entity.type}: ${entity.name}`
          : `Side panel (${surface})`;

        const convo = await assistantApi.createConversation({
          title,
          mode: initialAction?.mode || mode,
          thinking,
        });

        if (!active) return;
        setConversation(convo);
        setMessages([]);

        if (initialAction?.prompt && !initialActionSentRef.current) {
          initialActionSentRef.current = true;
          // Auto-trigger the page action
          setTimeout(() => {
            handleSend(initialAction.prompt, undefined, convo.id);
          }, 100);
        }
      } catch (err) {
        console.error('[AssistantPanel] Failed to init conversation:', err);
      }
    }

    init();

    return () => {
      active = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen, surface, entity?.id]);

  const handleSend = async (content: string, attachments?: ComposerAttachment[], targetConvoId?: string) => {
    const convoId = targetConvoId || conversation?.id;
    if (!convoId || (!content.trim() && (!attachments || attachments.length === 0)) || isStreaming) return;

    setInput('');
    setLastError(null);
    setIsStreaming(true);
    setIsThinking(true);
    setStreamingText('');

    abortControllerRef.current = new AbortController();

    // Optimistic user message
    const tempUserMsg: AssistantMessage = {
      id: `temp-${Date.now()}`,
      conversationId: convoId,
      userId: 'me',
      role: 'user',
      parts: [{ type: 'text', text: content }],
      searchableText: content,
      status: 'complete',
      inputTokens: 0,
      outputTokens: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      await assistantApi.sendMessageStream(
        convoId,
        content,
        {
          mode,
          thinking,
          attachments,
          surface,
          entity: entity ? { type: entity.type, id: entity.id, name: entity.name } : undefined,
          signal: abortControllerRef.current.signal,
        },
        (evt) => {
          if (evt.type === 'delta') {
            setIsThinking(false);
            setStreamingText((prev) => prev + (evt.data.text || ''));
          } else if (evt.type === 'tool_call') {
            setActionCards((prev) => {
              const tc = evt.data.toolCall;
              const cardProps: ActionCardProps = {
                cardType: 'needs_approval',
                toolName: tc.toolName,
                toolCallId: tc.id,
                args: tc.args,
                result: tc.result,
                onActionComplete: () => refreshMessages(convoId),
              };
              return [...prev, cardProps];
            });
          } else if (evt.type === 'done') {
            refreshMessages(convoId);
          } else if (evt.type === 'error') {
            setLastError({
              code: evt.data.code,
              message: evt.data.message,
              retryable: evt.data.retryable,
            });
          }
        }
      );
    } catch {
      setLastError({
        code: 'stream_error',
        message: 'Connection disrupted. Please try again.',
        retryable: true,
      });
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
      setStreamingText('');
    }
  };

  const refreshMessages = async (convoId: string) => {
    try {
      const updated = await assistantApi.getConversation(convoId);
      if (updated?.messages && updated.messages.length > 0) {
        setMessages(updated.messages);
      }
    } catch {
      // ignore
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
    setIsThinking(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="w-full sm:w-[420px] h-full bg-bg-main border-l border-border shadow-2xl flex flex-col text-text-main animate-in slide-in-from-right duration-200">
        {/* Header */}
        <header className="h-14 px-4 border-b border-border/60 flex items-center justify-between shrink-0 bg-bg-card/70 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="font-semibold text-xs text-text-main flex items-center gap-1.5">
                <span>Stone AI</span>
                {surface && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-bg-secondary text-text-muted font-normal capitalize">
                    {surface.replace('_', ' ')}
                  </span>
                )}
              </div>
              {entity && (
                <div className="text-[10px] text-text-muted truncate">
                  Viewing {entity.type}: {entity.name || entity.id}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {conversation && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/assistant/c/${conversation.id}`);
                }}
                className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text-main transition-colors"
                title="Open full page chat"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text-main transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !isStreaming ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-text-muted">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-semibold text-text-main">Ask Stone AI</h3>
              <p className="text-[11px] text-text-muted mt-1 max-w-[240px]">
                Ask questions about this {entity?.type || surface}, draft replies, or take actions directly.
              </p>
            </div>
          ) : (
            <AssistantThread
              messages={messages}
              isStreaming={isStreaming}
              streamingText={streamingText}
              isThinking={isThinking}
              actionCards={actionCards}
              onSelectMode={(newMode) => {
                setMode(newMode as AccessMode);
                if (conversation) {
                  assistantApi.updateConversation(conversation.id, { mode: newMode });
                }
              }}
              onActionComplete={() => {
                if (conversation) refreshMessages(conversation.id);
              }}
              onFeedback={(id, rating, comment) => assistantApi.sendFeedback(id, rating, comment)}
              onRegenerate={() => {
                const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                if (lastUser) {
                  const text = lastUser.parts.find((p) => p.type === 'text')?.text || '';
                  handleSend(text);
                }
              }}
              onEditMessage={async (msgId, newContent) => {
                if (!conversation) return;
                await assistantApi.editMessageStream(conversation.id, msgId, newContent, undefined, () => {});
                refreshMessages(conversation.id);
              }}
              lastError={lastError}
              onRetryError={() => {
                const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                if (lastUser) {
                  const text = lastUser.parts.find((p) => p.type === 'text')?.text || '';
                  handleSend(text);
                }
              }}
            />
          )}

          {/* Quick Apply Draft Banner if host page accepts draft callback */}
          {onApplyDraft && messages.length > 0 && (
            <div className="p-3 bg-primary/5 border-t border-primary/20 flex items-center justify-between text-xs">
              <span className="text-text-muted text-[11px]">Ready to use response?</span>
              <button
                type="button"
                onClick={() => {
                  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
                  const text = lastAssistant?.parts.find((p) => p.type === 'text')?.text;
                  if (text) {
                    onApplyDraft(text);
                    onClose();
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-[11px] font-medium hover:bg-primary/90 transition-colors"
              >
                <span>Use this draft</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Composer */}
        <AssistantComposer
          input={input}
          setInput={setInput}
          onSend={(text, atts) => handleSend(text, atts)}
          onStop={handleStop}
          isStreaming={isStreaming}
          mode={mode}
          onModeChange={setMode}
          thinking={thinking}
          onThinkingChange={setThinking}
        />
      </div>
    </div>
  );
}
