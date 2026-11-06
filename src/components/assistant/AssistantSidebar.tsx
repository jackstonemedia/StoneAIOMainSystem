import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, Pin, Trash2, Edit3, MoreHorizontal,
  Settings, Loader2, Folder, Archive,
  Brain, CalendarClock, ShieldCheck, ChevronDown, Check
} from 'lucide-react';
import type { AssistantConversation } from '../../lib/api/assistant';

export type AccessMode = 'read_only' | 'draft' | 'full';

interface AssistantSidebarProps {
  mode?: AccessMode;
  onModeChange?: (mode: AccessMode) => void;
  conversations: AssistantConversation[];
  activeConversationId?: string;
  streamingConversationId?: string;
  onNewChat: () => void;
  onRenameChat: (id: string, newTitle: string) => Promise<void>;
  onTogglePin: (id: string, isPinned: boolean) => Promise<void>;
  onDeleteChat: (id: string) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function AssistantSidebar({
  conversations,
  activeConversationId,
  streamingConversationId,
  onNewChat,
  onRenameChat,
  onTogglePin,
  onDeleteChat,
  searchQuery,
  setSearchQuery,
  onLoadMore,
  hasMore,
  mode,
  onModeChange,
}: AssistantSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setModeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const editInputRef = useRef<HTMLInputElement>(null);
  const deleteCancelBtnRef = useRef<HTMLButtonElement>(null);

  // Focus delete dialog cancel button when modal opens
  useEffect(() => {
    if (deleteDialogId && deleteCancelBtnRef.current) {
      deleteCancelBtnRef.current.focus();
    }
  }, [deleteDialogId]);

  // Focus inline edit input
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Start inline rename
  const handleStartRename = (convo: AssistantConversation) => {
    setEditingId(convo.id);
    setEditTitle(convo.title);
    setMenuOpenId(null);
  };

  // Submit rename
  const handleSaveRename = async () => {
    if (!editingId) return;
    const finalTitle = editTitle.trim();
    if (finalTitle && finalTitle.length <= 120) {
      await onRenameChat(editingId, finalTitle);
    }
    setEditingId(null);
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  // Group conversations
  const pinnedList = conversations.filter((c) => !!c.pinnedAt);
  const unpinnedList = conversations.filter((c) => !c.pinnedAt);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const sevenDaysStart = todayStart - 7 * 86400000;

  const groups: Record<string, AssistantConversation[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    Older: [],
  };

  for (const convo of unpinnedList) {
    const time = new Date(convo.updatedAt).getTime();
    if (time >= todayStart) {
      groups.Today.push(convo);
    } else if (time >= yesterdayStart) {
      groups.Yesterday.push(convo);
    } else if (time >= sevenDaysStart) {
      groups['Previous 7 days'].push(convo);
    } else {
      groups.Older.push(convo);
    }
  }

  return (
    <aside className="w-[220px] md:w-[240px] h-full flex flex-col border-r border-[#242830] bg-[#16191D] shrink-0 select-none font-inter overflow-hidden">
      {/* Top Header: Search Chats at the very top */}
      <div className="p-2.5 border-b border-[#242830]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A909A]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchQuery('');
            }}
            placeholder="Search chats..."
            aria-label="Search chats"
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg text-[12px] bg-[#131519] text-white placeholder-[#8A909A] border border-[#242830] outline-none focus:border-[#3E4452] transition-colors"
          />
        </div>
      </div>

      {/* Nav List: Projects, Scheduled Tasks, Activity & Approvals (Exactly 3 items) */}
      <div className="px-2 py-1.5 border-b border-[#242830] space-y-0.5 text-[11.5px]">
        <button
          type="button"
          onClick={() => navigate('/assistant/projects')}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-left ${
            location.pathname.startsWith('/assistant/projects')
              ? 'bg-[#22252B] text-white font-semibold'
              : 'text-[#CBD5E1] hover:text-white hover:bg-[#1E2026]'
          }`}
        >
          <Folder className="w-3.5 h-3.5 opacity-80" />
          <span>Projects</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/assistant/scheduled')}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-left ${
            location.pathname.startsWith('/assistant/scheduled')
              ? 'bg-[#22252B] text-white font-semibold'
              : 'text-[#CBD5E1] hover:text-white hover:bg-[#1E2026]'
          }`}
        >
          <CalendarClock className="w-3.5 h-3.5 opacity-80" />
          <span>Scheduled Tasks</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/assistant/activity')}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-left ${
            location.pathname.startsWith('/assistant/activity')
              ? 'bg-[#22252B] text-white font-semibold'
              : 'text-[#CBD5E1] hover:text-white hover:bg-[#1E2026]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 opacity-80" />
          <span>Activity & Approvals</span>
        </button>
      </div>
      {/* Conversations Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2.5 custom-scrollbar text-xs">
        {/* Pinned Section */}
        {pinnedList.length > 0 && (
          <div>
            <div className="px-2 pb-0.5 pt-1 font-medium text-[10px] uppercase tracking-wider text-text-muted/60 flex items-center gap-1.5">
              <Pin className="w-2.5 h-2.5 text-primary/70" />
              <span>Pinned</span>
            </div>
            <div className="space-y-0.5">
              {pinnedList.map((convo) => (
                <ConversationRow
                  key={convo.id}
                  convo={convo}
                  isActive={convo.id === activeConversationId}
                  isStreaming={convo.id === streamingConversationId}
                  isEditing={editingId === convo.id}
                  editTitle={editTitle}
                  setEditTitle={setEditTitle}
                  onEditSave={handleSaveRename}
                  onEditKeyDown={handleEditKeyDown}
                  editInputRef={editInputRef}
                  menuOpen={menuOpenId === convo.id}
                  setMenuOpen={(open) => setMenuOpenId(open ? convo.id : null)}
                  onStartRename={() => handleStartRename(convo)}
                  onTogglePin={() => onTogglePin(convo.id, true)}
                  onOpenDelete={() => setDeleteDialogId(convo.id)}
                  onClick={() => navigate(`/assistant/c/${convo.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recent Sections */}
        {Object.entries(groups).map(([groupTitle, list]) => {
          if (list.length === 0) return null;
          return (
            <div key={groupTitle}>
              <div className="px-2 pb-0.5 pt-1 font-medium text-[10px] uppercase tracking-wider text-text-muted/60">
                {groupTitle}
              </div>
              <div className="space-y-0.5">
                {list.map((convo) => (
                  <ConversationRow
                    key={convo.id}
                    convo={convo}
                    isActive={convo.id === activeConversationId}
                    isStreaming={convo.id === streamingConversationId}
                    isEditing={editingId === convo.id}
                    editTitle={editTitle}
                    setEditTitle={setEditTitle}
                    onEditSave={handleSaveRename}
                    onEditKeyDown={handleEditKeyDown}
                    editInputRef={editInputRef}
                    menuOpen={menuOpenId === convo.id}
                    setMenuOpen={(open) => setMenuOpenId(open ? convo.id : null)}
                    onStartRename={() => handleStartRename(convo)}
                    onTogglePin={() => onTogglePin(convo.id, false)}
                    onOpenDelete={() => setDeleteDialogId(convo.id)}
                    onClick={() => navigate(`/assistant/c/${convo.id}`)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {hasMore && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onLoadMore}
              className="text-xs text-primary hover:underline px-2 py-1 font-medium"
            >
              Load more
            </button>
          </div>
        )}
      </div>

      {/* Bottom Hub Navigation: Mode Selector, Memory, Settings */}
      <div className="p-1.5 border-t border-[#242830] space-y-0.5">
        {/* Access Mode Selector Click-in */}
        {mode && onModeChange && (
          <div ref={modeDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setModeDropdownOpen(!modeDropdownOpen)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium text-[#CBD5E1] hover:text-white hover:bg-[#1E2026] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    mode === 'full'
                      ? 'bg-amber-400'
                      : mode === 'draft'
                      ? 'bg-blue-400'
                      : 'bg-emerald-400'
                  }`}
                />
                <span className="truncate capitalize">{mode === 'full' ? 'Full Autonomy' : mode === 'draft' ? 'Draft Mode' : 'Read-Only'}</span>
              </div>
              <ChevronDown className={`w-3 h-3 text-[#8A909A] transition-transform ${modeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {modeDropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl bg-[#16191D] border border-[#242830] shadow-xl p-1 z-50 text-[11px] animate-in fade-in zoom-in-95">
                {(['read_only', 'draft', 'full'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onModeChange(m);
                      setModeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      mode === m ? 'bg-[#22252B] text-white font-semibold' : 'text-[#CBD5E1] hover:text-white hover:bg-[#1E2026]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          m === 'full' ? 'bg-amber-400' : m === 'draft' ? 'bg-blue-400' : 'bg-emerald-400'
                        }`}
                      />
                      <span>{m === 'full' ? 'Full Autonomy' : m === 'draft' ? 'Draft' : 'Read-Only'}</span>
                    </div>
                    {mode === m && <Check className="w-3 h-3 text-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Memory Item */}
        <button
          type="button"
          onClick={() => navigate('/assistant/memory')}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
            location.pathname.startsWith('/assistant/memory')
              ? 'bg-[#22252B] text-white font-semibold'
              : 'text-[#CBD5E1] hover:text-white hover:bg-[#1E2026]'
          }`}
        >
          <Brain className="w-3.5 h-3.5 opacity-80" />
          <span>Memory</span>
        </button>

        {/* Settings Item */}
        <button
          type="button"
          onClick={() => navigate('/assistant/settings')}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
            location.pathname.startsWith('/assistant/settings')
              ? 'bg-[#22252B] text-white font-semibold'
              : 'text-[#CBD5E1] hover:text-white hover:bg-[#1E2026]'
          }`}
        >
          <Settings className="w-3.5 h-3.5 opacity-80" />
          <span>Settings</span>
        </button>
      </div>

      {/* Delete Confirmation Dialog (Spec Section 1.2) */}
      {deleteDialogId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="w-full max-w-sm rounded-2xl bg-[#181A20] border border-[#262A32] p-5 shadow-xl space-y-4"
          >
            <h3 id="delete-dialog-title" className="text-base font-semibold text-white">
              Delete this chat?
            </h3>
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              This permanently deletes the conversation and all its messages. This can’t be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                ref={deleteCancelBtnRef}
                type="button"
                onClick={() => setDeleteDialogId(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-[#262A32] text-[#CBD5E1] hover:text-white hover:bg-[#22252B] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const idToDelete = deleteDialogId;
                  setDeleteDialogId(null);
                  await onDeleteChat(idToDelete);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

interface ConversationRowProps {
  convo: AssistantConversation;
  isActive: boolean;
  isStreaming?: boolean;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (t: string) => void;
  onEditSave: () => void;
  onEditKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  onStartRename: () => void;
  onTogglePin: () => void;
  onOpenDelete: () => void;
  onClick: () => void;
}

function ConversationRow({
  convo,
  isActive,
  isStreaming,
  isEditing,
  editTitle,
  setEditTitle,
  onEditSave,
  onEditKeyDown,
  editInputRef,
  menuOpen,
  setMenuOpen,
  onStartRename,
  onTogglePin,
  onOpenDelete,
  onClick,
}: ConversationRowProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen, setMenuOpen]);

  if (isEditing) {
    return (
      <div className="px-2 py-1">
        <input
          ref={editInputRef}
          type="text"
          maxLength={120}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={onEditSave}
          onKeyDown={onEditKeyDown}
          className="w-full px-2 py-1 text-xs rounded bg-[#131519] border border-primary text-white outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-[#22252B] text-white font-medium border border-[#30353F] shadow-xs'
          : 'text-[#CBD5E1] hover:text-white hover:bg-[#1E2026] border border-transparent'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 truncate pr-2">
        {isStreaming ? (
          <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
        ) : convo.pinnedAt ? (
          <Pin className="w-2.5 h-2.5 text-text-muted/60 shrink-0 rotate-45" />
        ) : null}
        <span className="truncate text-[11.5px] leading-tight">{convo.title}</span>
      </div>

      <div
        ref={menuRef}
        className="relative shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Conversation options"
          onClick={() => setMenuOpen(!menuOpen)}
          className={`w-5 h-5 rounded flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors ${
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
        >
          <MoreHorizontal className="w-3 h-3" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-[#181A20] border border-[#262A32] shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 text-xs">
            <button
              type="button"
              onClick={onStartRename}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#22252B] text-left text-[#CBD5E1] hover:text-white"
            >
              <Edit3 className="w-3.5 h-3.5 opacity-70" />
              <span>Rename</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onTogglePin();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#22252B] text-left text-[#CBD5E1] hover:text-white"
            >
              <Pin className="w-3.5 h-3.5 opacity-70" />
              <span>{convo.pinnedAt ? 'Unpin' : 'Pin'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenDelete();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
