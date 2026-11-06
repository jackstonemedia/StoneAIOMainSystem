import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, ShieldAlert,
  MoreHorizontal, Edit3, Pin, Trash2, Clock, ChevronDown, Share2,
  BarChart2, Mail, Users, FileText, ArrowRight
} from 'lucide-react';
import { AssistantSidebar } from '../../components/assistant/AssistantSidebar';
import { AssistantThread } from '../../components/assistant/AssistantThread';
import {
  AssistantComposer,
  type AccessMode,
  type ComposerAttachment,
} from '../../components/assistant/AssistantComposer';
import { AssistantActivityModal } from '../../components/assistant/AssistantActivityModal';
import type { ActionCardProps } from '../../components/assistant/ActionCards';
import {
  assistantApi,
  type AssistantConversation,
  type AssistantMessage,
  type AssistantSettings,
} from '../../lib/api/assistant';
import { FEATURES } from '../../config/features';

const PROMPT_SUGGESTIONS = [
  {
    icon: BarChart2,
    title: 'Pipeline Deal Summary',
    description: 'Summarize active opportunities closing this quarter and list next steps.',
    prompt: 'Summarize our active pipeline deals closing this quarter and highlight the highest-priority action items.',
  },
  {
    icon: Mail,
    title: 'Draft Client Check-In',
    description: 'Compose a personalized, professional email to an engaged lead.',
    prompt: 'Draft a personalized follow-up email to a warm lead checking in on their project status.',
  },
  {
    icon: Users,
    title: 'Find Uncontacted Leads',
    description: 'Scan new contacts with no outreach logged in the last 7 days.',
    prompt: 'Show me any contacts created recently that haven’t been reached out to in the past 7 days.',
  },
  {
    icon: FileText,
    title: 'Weekly Performance Audit',
    description: 'Review closed deals, pending approvals, and scheduled automations.',
    prompt: 'Generate an executive summary of this week’s closed deals, open tasks, and system activity.',
  },
];

export default function AssistantPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<AssistantConversation | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [settings, setSettings] = useState<AssistantSettings | null>(null);

  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<AccessMode>('read_only');
  const [thinking, setThinking] = useState<'auto' | 'extended'>('auto');
  const [isTemporary, setIsTemporary] = useState(false);
  const [temporaryMessages, setTemporaryMessages] = useState<Array<{ role: 'user' | 'assistant'; parts: Array<{ type: string; text?: string }> }>>([]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [streamingConvoId, setStreamingConvoId] = useState<string | undefined>();
  const [lastError, setLastError] = useState<{ code: string; message: string; retryable: boolean } | null>(null);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [isRenamingHeader, setIsRenamingHeader] = useState(false);
  const [headerTitleInput, setHeaderTitleInput] = useState('');
  const [actionCards, setActionCards] = useState<ActionCardProps[]>([]);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [copyToast, setCopyToast] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const createdConvoIdRef = useRef<string | null>(null);

  // Redirect if assistant feature flag is off
  useEffect(() => {
    if (!FEATURES.assistant) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  // Load conversations list and settings
  const loadConversations = async (q?: string) => {
    try {
      const data = await assistantApi.listConversations({ q });
      setConversations(data.items);
    } catch (err) {
      console.error('[Assistant] Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    loadConversations(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    assistantApi.getSettings().then((s) => {
      setSettings(s);
      if (s.defaultMode && s.defaultMode !== 'ask') {
        setMode(s.defaultMode as AccessMode);
      }
    }).catch(() => {
      // Ignore settings fetch failure
    });
  }, []);

  useEffect(() => {
    if (location.state && (location.state as any).initialPrompt) {
      setInput((location.state as any).initialPrompt);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  const loadPendingApprovals = async () => {
    try {
      const pending = await assistantApi.listToolCalls({ status: 'pending' });
      setPendingApprovalsCount(pending.length);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadPendingApprovals();
  }, [conversationId]);

  // Load active conversation
  useEffect(() => {
    setActionCards([]);
    if (!conversationId) {
      setCurrentConversation(null);
      setMessages([]);
      setIsTemporary(false);
      return;
    }

    // If this conversation was just created during handleSend, keep existing messages
    if (createdConvoIdRef.current === conversationId) {
      createdConvoIdRef.current = null;
      return;
    }

    assistantApi.getConversation(conversationId).then((convo) => {
      setCurrentConversation(convo);
      setMessages(convo.messages || []);
      setHeaderTitleInput(convo.title);
      if (convo.mode && convo.mode !== 'unset') {
        setMode(convo.mode as AccessMode);
      }
      if (convo.thinking) {
        setThinking(convo.thinking as 'auto' | 'extended');
      }
      setLastError(null);
    }).catch(() => {
      // Conversation not found or cross-tenant forbidden -> go to /assistant
      navigate('/assistant', { replace: true });
    });
  }, [conversationId, navigate]);

  // Handle New Chat button
  const handleNewChat = () => {
    navigate('/assistant');
    setCurrentConversation(null);
    setMessages([]);
    setTemporaryMessages([]);
    setIsTemporary(false);
    setLastError(null);
    setMobileSidebarOpen(false);
  };

  // Handle Message Sending
  const handleSend = async (content: string, attachments?: ComposerAttachment[]) => {
    if ((!content.trim() && (!attachments || attachments.length === 0)) || isStreaming) return;

    setInput('');
    setLastError(null);
    setIsStreaming(true);
    setIsThinking(true);
    setStreamingText('');

    abortControllerRef.current = new AbortController();

    // 1. Temporary Chat Flow
    if (isTemporary || !conversationId) {
      if (isTemporary) {
        const nextTempMessages = [
          ...temporaryMessages,
          { role: 'user' as const, parts: [{ type: 'text', text: content }] },
        ];
        setTemporaryMessages(nextTempMessages);

        let tempAccumulatedText = '';
        try {
          await assistantApi.sendTemporaryMessageStream(
            nextTempMessages,
            settings?.thinking || 'auto',
            abortControllerRef.current.signal,
            (evt) => {
              if (evt.type === 'delta') {
                setIsThinking(false);
                tempAccumulatedText += (evt.data.text || '');
                setStreamingText(tempAccumulatedText);
              } else if (evt.type === 'done') {
                setTemporaryMessages((prev) => [
                  ...prev,
                  { role: 'assistant' as const, parts: [{ type: 'text', text: evt.data.fullText || tempAccumulatedText }] },
                ]);
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
            code: 'provider_error',
            message: 'Connection failed. Please try again.',
            retryable: true,
          });
        } finally {
          setIsStreaming(false);
          setIsThinking(false);
          setStreamingText('');
        }
        return;
      }

      // 2. First Message in New Saved Chat: Create conversation on server first
      try {
        const newConvo = await assistantApi.createConversation({
          title: 'New Conversation',
          mode,
          thinking,
        });
        createdConvoIdRef.current = newConvo.id;
        setCurrentConversation(newConvo);
        setConversations((prev) => [newConvo, ...prev]);
        navigate(`/assistant/c/${newConvo.id}`, { replace: true });

        setStreamingConvoId(newConvo.id);
        await streamTurn(newConvo.id, content, attachments);
      } catch (err: any) {
        setLastError({
          code: 'provider_error',
          message: err.message || 'Failed to start conversation',
          retryable: true,
        });
        setIsStreaming(false);
        setIsThinking(false);
      }
      return;
    }

    // 3. Existing Conversation
    setStreamingConvoId(conversationId);
    await streamTurn(conversationId, content, attachments);
  };

  const streamTurn = async (targetConvoId: string, content: string, attachments?: ComposerAttachment[]) => {
    // Optimistic user message in UI
    const userParts: any[] = [{ type: 'text', text: content }];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        userParts.push({
          type: 'image',
          mimeType: att.mimeType,
          data: att.data,
          name: att.name,
        });
      }
    }

    const tempUserMsg: AssistantMessage = {
      id: `temp-${Date.now()}`,
      conversationId: targetConvoId,
      userId: 'current',
      role: 'user',
      parts: userParts,
      searchableText: content,
      status: 'complete',
      inputTokens: 0,
      outputTokens: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      let accumulatedText = '';
      await assistantApi.sendMessageStream(
        targetConvoId,
        content,
        {
          mode,
          thinking,
          attachments,
          signal: abortControllerRef.current?.signal,
        },
        (evt) => {
          if (evt.type === 'delta') {
            setIsThinking(false);
            accumulatedText += evt.data.text || '';
            setStreamingText(accumulatedText);
          } else if (evt.type === 'title') {
            // Update title inline
            setCurrentConversation((prev) => prev ? { ...prev, title: evt.data.title } : null);
            setConversations((prev) =>
              prev.map((c) => (c.id === targetConvoId ? { ...c, title: evt.data.title } : c))
            );
            setHeaderTitleInput(evt.data.title);
          } else if (evt.type === 'done') {
            const assistantMsg: AssistantMessage = {
              id: evt.data.assistantMessageId,
              conversationId: targetConvoId,
              userId: 'assistant',
              role: 'assistant',
              parts: [{ type: 'text', text: accumulatedText }],
              searchableText: accumulatedText,
              status: 'complete',
              inputTokens: evt.data.inputTokens || 0,
              outputTokens: evt.data.outputTokens || 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            setMessages((prev) => {
              const hasUser = prev.some((m) => m.id === tempUserMsg.id || (m.role === 'user' && m.searchableText === content));
              const base = hasUser ? prev : [...prev, tempUserMsg];
              return [...base, assistantMsg];
            });
            loadConversations();
          } else if (evt.type === 'proposal') {
            setIsThinking(false);
            setActionCards((prev) => [
              ...prev,
              {
                cardType: 'proposal',
                toolCallId: evt.data.toolCallId,
                toolName: evt.data.toolName,
                args: evt.data.args,
                reason: evt.data.reason,
              },
            ]);
            loadPendingApprovals();
          } else if (evt.type === 'needs_approval') {
            setIsThinking(false);
            setActionCards((prev) => [
              ...prev,
              {
                cardType: 'needs_approval',
                toolCallId: evt.data.toolCallId,
                toolName: evt.data.toolName,
                args: evt.data.args,
                reason: evt.data.reason,
              },
            ]);
            loadPendingApprovals();
          } else if (evt.type === 'mode_prompt') {
            setIsThinking(false);
            setActionCards((prev) => [
              ...prev,
              {
                cardType: 'mode_prompt',
                toolName: evt.data.toolName,
              },
            ]);
          } else if (evt.type === 'blocked') {
            setIsThinking(false);
            setActionCards((prev) => [
              ...prev,
              {
                cardType: 'blocked',
                toolName: evt.data.toolName,
                reason: evt.data.reason,
              },
            ]);
          } else if (evt.type === 'no_permission') {
            setIsThinking(false);
            setActionCards((prev) => [
              ...prev,
              {
                cardType: 'no_permission',
                toolName: evt.data.toolName,
                requiredRole: evt.data.requiredRole,
                currentRole: evt.data.currentRole,
              },
            ]);
          } else if (evt.type === 'tool_result') {
            if (evt.data.result) {
              setActionCards((prev) => [
                ...prev,
                {
                  cardType: 'lookup',
                  toolCallId: evt.data.toolCallId,
                  toolName: evt.data.toolName,
                  result: evt.data.result,
                },
              ]);
            }
          } else if (evt.type === 'error') {
            setLastError({
              code: evt.data.code,
              message: evt.data.message,
              retryable: evt.data.retryable,
            });
          }
        }
      );
    } catch (err: any) {
      setLastError({
        code: 'provider_error',
        message: err.message || 'Stream interrupted',
        retryable: true,
      });
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
      setStreamingText('');
      setStreamingConvoId(undefined);
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleRegenerate = async () => {
    if (!conversationId || isStreaming) return;
    setIsStreaming(true);
    setIsThinking(true);
    setStreamingText('');
    setLastError(null);

    abortControllerRef.current = new AbortController();

    // Drop last assistant message from UI
    setMessages((prev) => {
      const lastIndex = prev.map((m) => m.role).lastIndexOf('assistant');
      if (lastIndex >= 0) {
        return prev.filter((_, idx) => idx !== lastIndex);
      }
      return prev;
    });

    try {
      let accumulatedText = '';
      await assistantApi.regenerateStream(
        conversationId,
        abortControllerRef.current.signal,
        (evt) => {
          if (evt.type === 'delta') {
            setIsThinking(false);
            accumulatedText += evt.data.text || '';
            setStreamingText(accumulatedText);
          } else if (evt.type === 'done') {
            const assistantMsg: AssistantMessage = {
              id: evt.data.assistantMessageId,
              conversationId,
              userId: 'assistant',
              role: 'assistant',
              parts: [{ type: 'text', text: accumulatedText }],
              searchableText: accumulatedText,
              status: 'complete',
              inputTokens: evt.data.inputTokens || 0,
              outputTokens: evt.data.outputTokens || 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
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
        code: 'provider_error',
        message: 'Regeneration failed',
        retryable: true,
      });
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
      setStreamingText('');
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!conversationId || isStreaming) return;
    setIsStreaming(true);
    setIsThinking(true);
    setStreamingText('');
    setLastError(null);

    abortControllerRef.current = new AbortController();

    try {
      let accumulatedText = '';
      await assistantApi.editMessageStream(
        conversationId,
        messageId,
        newContent,
        abortControllerRef.current.signal,
        (evt) => {
          if (evt.type === 'delta') {
            setIsThinking(false);
            accumulatedText += evt.data.text || '';
            setStreamingText(accumulatedText);
          } else if (evt.type === 'done') {
            // Reload full conversation messages
            assistantApi.getConversation(conversationId).then((c) => setMessages(c.messages || []));
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
        code: 'provider_error',
        message: 'Failed to edit message',
        retryable: true,
      });
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
      setStreamingText('');
    }
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    try {
      await assistantApi.updateConversation(id, { title: newTitle });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
      );
      if (currentConversation?.id === id) {
        setCurrentConversation((prev) => prev ? { ...prev, title: newTitle } : null);
        setHeaderTitleInput(newTitle);
      }
    } catch (err) {
      console.error('Rename failed:', err);
    }
  };

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    try {
      await assistantApi.updateConversation(id, { pinnedAt: isPinned ? null : new Date().toISOString() });
      loadConversations();
    } catch (err) {
      console.error('Pin toggle failed:', err);
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await assistantApi.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversation?.id === id) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSaveHeaderRename = async () => {
    if (!currentConversation) return;
    const title = headerTitleInput.trim();
    if (title && title.length <= 120) {
      await handleRenameChat(currentConversation.id, title);
    }
    setIsRenamingHeader(false);
  };

  const displayMessages = isTemporary
    ? temporaryMessages.map((m, idx) => ({
        id: `temp-${idx}`,
        conversationId: 'temp',
        userId: m.role === 'user' ? 'user' : 'assistant',
        role: m.role,
        parts: m.parts,
        searchableText: m.parts?.[0]?.text || '',
        status: 'complete',
        inputTokens: 0,
        outputTokens: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
    : messages;

  const isThreadEmpty = displayMessages.length === 0 && !isStreaming;

  if (!FEATURES.assistant) {
    return null;
  }

  return (
    <div className="flex h-full w-full text-sm font-sans relative z-0 bg-bg overflow-hidden">
      {/* Toast */}
      {copyToast && (
        <div className="fixed top-4 right-4 z-50 px-3.5 py-2 rounded-xl bg-surface-hover/90 backdrop-blur-md border border-border/60 text-xs font-semibold text-text-main shadow-luxury animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
          <span>Chat link copied to clipboard</span>
        </div>
      )}

      {/* Mobile Slide-over Drawer (< 1024px) */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-[240px] h-full bg-surface border-r border-border/60 z-10 animate-in slide-in-from-left">
            <AssistantSidebar
              conversations={conversations}
              activeConversationId={conversationId}
              streamingConversationId={streamingConvoId}
              onNewChat={handleNewChat}
              onRenameChat={handleRenameChat}
              onTogglePin={handleTogglePin}
              onDeleteChat={handleDeleteChat}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          </div>
        </div>
      )}

      {/* ── Main Full-Bleed Split View ── */}
      <div className="flex-1 flex overflow-hidden w-full relative z-10">
        {/* Left Master Sidebar on Desktop */}
        <div className="hidden lg:flex h-full shrink-0">
          <AssistantSidebar
            conversations={conversations}
            activeConversationId={conversationId}
            streamingConversationId={streamingConvoId}
            onNewChat={handleNewChat}
            onRenameChat={handleRenameChat}
            onTogglePin={handleTogglePin}
            onDeleteChat={handleDeleteChat}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </div>

        {/* Right Detail Chat Thread & Composer Canvas */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-bg overflow-hidden relative">
          {/* Subtle floating controls in top right (borderless, no heavy top bar) */}
          <div className="absolute top-3 right-4 z-20 flex items-center gap-2">
            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open conversation menu"
              className="lg:hidden p-1.5 rounded-lg bg-surface/80 border border-border/50 text-text-muted hover:text-text-main shadow-xs"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Access Mode indicator pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface/60 border border-border/40 text-[11px] font-medium text-text-muted backdrop-blur-sm">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  mode === 'full'
                    ? 'bg-amber-400'
                    : mode === 'draft'
                    ? 'bg-blue-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span className="capitalize">
                {mode === 'full' ? 'Autonomous' : mode === 'draft' ? 'Ask first' : 'Read-only'}
              </span>
            </div>

            {/* Activity & Approvals Button */}
            <button
              type="button"
              onClick={() => setActivityModalOpen(true)}
              aria-label="Activity and approvals"
              title="Approvals & Activity Audit"
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-border/40 bg-surface/60 hover:bg-surface-hover/80 text-text-muted hover:text-text-main backdrop-blur-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Activity</span>
              {pendingApprovalsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>

            {/* Share Button */}
            {currentConversation && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  setCopyToast(true);
                  setTimeout(() => setCopyToast(false), 2000);
                }}
                aria-label="Share chat link"
                title="Copy link to chat"
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-text-muted hover:text-text-main bg-surface/60 hover:bg-surface-hover/80 backdrop-blur-sm transition-colors flex items-center gap-1.5 border border-border/40 cursor-pointer shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share</span>
              </button>
            )}

            {/* Temporary Chat Toggle */}
            {!conversationId && (
              <button
                type="button"
                onClick={() => setIsTemporary(!isTemporary)}
                aria-label="Temporary chat"
                title="Temporary chat"
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border backdrop-blur-sm transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  isTemporary
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'text-text-muted hover:text-text-main bg-surface/60 hover:bg-surface-hover/80 border-border/40'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Temporary</span>
              </button>
            )}
          </div>

          {/* Thread messages or Enterprise Welcome Screen */}
          {isThreadEmpty ? (
            <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-center text-center select-none animate-in fade-in custom-scrollbar">
              <h2 className="text-xl md:text-2xl font-bold text-text-main tracking-tight mb-2">
                How can Stone AI assist your business today?
              </h2>
              <p className="text-xs md:text-sm text-text-muted max-w-lg mb-8 leading-relaxed">
                Draft client follow-ups, summarize pipeline deals, audit pending approvals, or find uncontacted contacts across your CRM.
              </p>

              {/* 4 Enterprise Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full text-left">
                {PROMPT_SUGGESTIONS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(item.prompt)}
                      className="p-3.5 rounded-xl bg-surface/60 hover:bg-surface-hover/80 border border-border/50 hover:border-primary/40 transition-all text-left group cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-primary group-hover:text-primary-hover border border-border/40">
                          <Icon className="w-4 h-4" />
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-text-main group-hover:text-white transition-colors">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <AssistantThread
              messages={displayMessages}
              isStreaming={isStreaming}
              streamingText={streamingText}
              isThinking={isThinking}
              actionCards={actionCards}
              onSelectMode={async (newMode) => {
                setMode(newMode as AccessMode);
                if (conversationId) {
                  await assistantApi.updateConversation(conversationId, { mode: newMode });
                }
                setActionCards((prev) => prev.filter((c) => c.cardType !== 'mode_prompt'));
              }}
              onActionComplete={() => {
                loadPendingApprovals();
                if (conversationId) {
                  assistantApi.getConversation(conversationId).then((c) => setMessages(c.messages || []));
                }
              }}
              onRegenerate={handleRegenerate}
              onEditMessage={handleEditMessage}
              onFeedback={(id, rating, comment) => assistantApi.sendFeedback(id, rating, comment)}
              onRetryError={handleRegenerate}
              lastError={lastError}
              isTemporary={isTemporary}
            />
          )}

          {/* Composer at Bottom */}
          <AssistantComposer
            input={input}
            setInput={setInput}
            onSend={handleSend}
            onStop={handleStop}
            isStreaming={isStreaming}
            mode={mode}
            onModeChange={setMode}
            thinking={thinking}
            onThinkingChange={(newThinking) => {
              setThinking(newThinking);
              if (conversationId) {
                assistantApi.updateConversation(conversationId, { thinking: newThinking });
              }
            }}
          />
        </div>
      </div>

      {/* Activity & Approvals Modal */}
      <AssistantActivityModal
        isOpen={activityModalOpen}
        onClose={() => {
          setActivityModalOpen(false);
          loadPendingApprovals();
        }}
      />
    </div>
  );
}
