import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Brain, Search, Plus, Trash2, Edit3, X,
  Save, AlertTriangle, Check, Loader2, Sparkles, Building2,
  User
} from 'lucide-react';
import {
  assistantApi,
  type AssistantMemory,
  type AssistantSettings
} from '../../lib/api/assistant';

export default function AssistantMemoryPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'personal' | 'business'>('personal');
  const [memories, setMemories] = useState<AssistantMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Settings for memory toggles
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Add memory form state
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  // Edit / View modal state
  const [selectedNote, setSelectedNote] = useState<AssistantMemory | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Confirm delete dialogs
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Confirm reset dialog
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Toast / notification feedback
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [allMemories, userSettings] = await Promise.all([
        assistantApi.listMemories('all'),
        assistantApi.getSettings(),
      ]);
      setMemories(allMemories);
      setSettings(userSettings);

      // Check if user is admin by attempting to read workspace settings
      try {
        await assistantApi.getWorkspaceSettings();
        setIsAdmin(true);
      } catch {
        setIsAdmin(false);
      }
    } catch {
      showFeedback('Failed to load memory data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleMemorySetting = async (field: 'memoryEnabled' | 'pastChatSearch') => {
    if (!settings || savingSettings) return;
    const updated = { ...settings, [field]: !settings[field] };
    setSettings(updated);
    setSavingSettings(true);
    try {
      await assistantApi.updateSettings({ [field]: updated[field] });
      showFeedback('Preferences updated.');
    } catch {
      showFeedback('Failed to update preference.', 'error');
      // rollback
      setSettings(settings);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim() || savingNew) return;

    setSavingNew(true);
    try {
      const created = await assistantApi.saveMemory({
        key: newKey.trim(),
        value: newValue.trim(),
        category: activeTab === 'business' ? 'business' : 'personal',
      });
      setMemories((prev) => [created, ...prev.filter((m) => m.id !== created.id)]);
      setNewKey('');
      setNewValue('');
      setIsAdding(false);
      showFeedback('Memory saved to Stone AI.');
    } catch (err: any) {
      showFeedback(err?.response?.data?.error || 'Failed to save memory.', 'error');
    } finally {
      setSavingNew(false);
    }
  };

  const handleOpenNote = (note: AssistantMemory) => {
    setSelectedNote(note);
    setEditKey(note.key);
    setEditValue(note.value);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedNote || !editKey.trim() || !editValue.trim() || savingEdit) return;

    setSavingEdit(true);
    try {
      const updated = await assistantApi.updateMemory(selectedNote.id, {
        key: editKey.trim(),
        value: editValue.trim(),
      });
      setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setSelectedNote(updated);
      setIsEditing(false);
      showFeedback('Memory note updated.');
    } catch (err: any) {
      showFeedback(err?.response?.data?.error || 'Failed to update note.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    setDeletingId(id);
    try {
      await assistantApi.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      if (selectedNote?.id === id) {
        setSelectedNote(null);
      }
      setDeleteConfirmId(null);
      showFeedback('Memory note deleted.');
    } catch (err: any) {
      showFeedback(err?.response?.data?.error || 'Failed to delete note.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetMemories = async () => {
    setResetting(true);
    try {
      await assistantApi.clearAllMemories(activeTab);
      setMemories((prev) =>
        prev.filter((m) => (activeTab === 'business' ? m.category !== 'business' : m.category === 'business'))
      );
      setResetModalOpen(false);
      showFeedback(
        activeTab === 'business' ? 'Business shared memory reset.' : 'Personal memory reset.'
      );
    } catch (err: any) {
      showFeedback(err?.response?.data?.error || 'Failed to reset memory.', 'error');
    } finally {
      setResetting(false);
    }
  };

  // Filter memories by current tab and query
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const matchesTab = activeTab === 'business' ? m.category === 'business' : m.category !== 'business';
      if (!matchesTab) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q);
    });
  }, [memories, activeTab, searchQuery]);

  const personalCount = memories.filter((m) => m.category !== 'business').length;
  const businessCount = memories.filter((m) => m.category === 'business').length;

  return (
    <div className="min-h-screen bg-bg text-text-main flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-border/60 bg-bg-card/40 backdrop-blur sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/assistant')}
            className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-bg-secondary transition"
            aria-label="Back to Assistant"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Assistant Memory</h1>
            <p className="text-xs text-text-muted">
              Facts, style rules, and workspace knowledge Stone AI recalls across chats
            </p>
          </div>
        </div>

        {feedback && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium animate-in fade-in ${
              feedback.type === 'error'
                ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
            }`}
          >
            {feedback.type === 'error' ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        {/* Governance & Toggle Controls Card (Spec Section 1.11) */}
        {settings && (
          <div className="p-5 rounded-2xl bg-bg-card border border-border/80 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start justify-between p-3.5 rounded-xl bg-bg/60 border border-border/40">
              <div className="space-y-0.5 pr-3">
                <span className="text-sm font-medium text-text-main">Use memory in chats</span>
                <p className="text-xs text-text-muted">
                  Stone AI references your saved memory notes and automatically notes new instructions.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.memoryEnabled}
                disabled={savingSettings}
                onClick={() => handleToggleMemorySetting('memoryEnabled')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.memoryEnabled ? 'bg-primary' : 'bg-border'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings.memoryEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-start justify-between p-3.5 rounded-xl bg-bg/60 border border-border/40">
              <div className="space-y-0.5 pr-3">
                <span className="text-sm font-medium text-text-main">Search past chats</span>
                <p className="text-xs text-text-muted">
                  Allows Stone AI to search earlier conversation threads when answering questions.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.pastChatSearch}
                disabled={savingSettings}
                onClick={() => handleToggleMemorySetting('pastChatSearch')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.pastChatSearch ? 'bg-primary' : 'bg-border'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings.pastChatSearch ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('personal');
                setIsAdding(false);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === 'personal'
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-bg-secondary'
              }`}
            >
              <User className="w-4 h-4" />
              <span>About you</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-bg-secondary text-text-muted font-normal">
                {personalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('business');
                setIsAdding(false);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === 'business'
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-bg-secondary'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Business</span>
              <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-bg-secondary text-text-muted font-normal">
                {businessCount}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === 'personal' ? 'personal' : 'business'} notes...`}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-bg-secondary border border-border text-xs text-text-main placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Add Memory Button */}
            {(activeTab === 'personal' || isAdmin) && (
              <button
                type="button"
                onClick={() => setIsAdding(!isAdding)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add memory</span>
              </button>
            )}

            {/* Reset Memory Button */}
            <button
              type="button"
              disabled={activeTab === 'business' && !isAdmin}
              onClick={() => setResetModalOpen(true)}
              className="p-2 rounded-xl text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition border border-transparent hover:border-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                activeTab === 'business' && !isAdmin
                  ? 'Only admins can reset business memory'
                  : `Reset ${activeTab} memory`
              }
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Add Memory Inline Box */}
        {isAdding && (
          <form
            onSubmit={handleAddMemory}
            className="p-5 rounded-2xl bg-bg-card border border-primary/30 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Tell Stone AI something to remember</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-text-muted hover:text-text-main"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  Title / Subject
                </label>
                <input
                  type="text"
                  required
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. Tone preference, Refund policy"
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border text-xs text-text-main placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  Note details
                </label>
                <input
                  type="text"
                  required
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={
                    activeTab === 'personal'
                      ? 'e.g. I prefer concise bullet-point answers without small talk'
                      : 'e.g. All invoices must include PO number and Net-30 payment terms'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border text-xs text-text-main placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-text-muted">
                {activeTab === 'business'
                  ? 'This fact will be available to all teammates across this workspace.'
                  : 'This fact is private to your personal user account.'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-secondary transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNew || !newKey.trim() || !newValue.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition shadow-xs disabled:opacity-50"
                >
                  {savingNew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save note</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs">Loading assistant memory notes...</p>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border border-dashed border-border p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-bg-secondary text-text-muted mx-auto flex items-center justify-center">
              {activeTab === 'business' ? <Building2 className="w-6 h-6" /> : <Brain className="w-6 h-6" />}
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text-main">
                {searchQuery ? 'No matching notes found' : `No ${activeTab} memories yet`}
              </h3>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                {searchQuery
                  ? 'Try adjusting your search terms or clearing the filter.'
                  : activeTab === 'personal'
                  ? 'Tell Stone AI preferences like "I prefer concise bullet-point answers" and they will appear here.'
                  : 'Workspace shared memories store company policies, brand voice, and facts shared with all team members.'}
              </p>
            </div>
            {!searchQuery && (activeTab === 'personal' || isAdmin) && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add first memory</span>
              </button>
            )}
          </div>
        ) : (
          /* Memory Notes Grid (Spec Section 1.11: Title, preview, last updated) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredMemories.map((note) => (
              <div
                key={note.id}
                onClick={() => handleOpenNote(note)}
                className="group relative p-4 rounded-2xl bg-bg-card border border-border/80 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-text-main group-hover:text-primary transition truncate">
                      {note.key}
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase shrink-0 ${
                        note.category === 'business'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : 'bg-primary/10 text-primary border border-primary/20'
                      }`}
                    >
                      {note.category === 'business' ? 'Business' : 'Personal'}
                    </span>
                  </div>

                  <p className="text-xs text-text-muted line-clamp-3 leading-relaxed">
                    {note.value}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/40 text-[11px] text-text-muted">
                  <span>
                    Updated {new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      aria-label="Edit note"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenNote(note);
                        setIsEditing(true);
                      }}
                      className="p-1 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text-main"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {(note.category !== 'business' || isAdmin) && (
                      <button
                        type="button"
                        aria-label="Delete note"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(note.id);
                        }}
                        className="p-1 rounded-lg hover:bg-rose-500/10 text-text-muted hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Note View / Edit Modal (Spec Section 1.11) */}
      {selectedNote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-bg-card border border-border p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    selectedNote.category === 'business'
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-primary/10 text-primary'
                  }`}
                >
                  {selectedNote.category === 'business' ? (
                    <Building2 className="w-4 h-4" />
                  ) : (
                    <Brain className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-main">
                    {isEditing ? 'Edit Memory Note' : selectedNote.key}
                  </h3>
                  <span className="text-[11px] text-text-muted">
                    {selectedNote.category === 'business' ? 'Business shared memory' : 'Personal user memory'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedNote(null);
                  setIsEditing(false);
                }}
                className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-bg border border-border text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                    Note Text
                  </label>
                  <textarea
                    rows={5}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-bg border border-border text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-bg/60 border border-border/40 text-xs text-text-main leading-relaxed whitespace-pre-wrap">
                  {selectedNote.value}
                </div>

                {selectedNote.category === 'business' && !isAdmin && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-500 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Business memory notes are managed by workspace admins.</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-border/60">
              {(selectedNote.category !== 'business' || isAdmin) ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(selectedNote.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-500 hover:bg-rose-500/10 text-xs font-medium transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-secondary transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={savingEdit || !editKey.trim() || !editValue.trim()}
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition shadow-xs disabled:opacity-50"
                    >
                      {savingEdit ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Save changes</span>
                    </button>
                  </>
                ) : (
                  (selectedNote.category !== 'business' || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition shadow-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit note</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Note Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-bg-card border border-border p-5 shadow-xl space-y-3"
          >
            <h3 className="text-sm font-semibold text-text-main">Delete this memory note?</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Stone AI will no longer use this fact or instruction in future conversations.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-secondary transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!deletingId}
                onClick={() => handleDeleteNote(deleteConfirmId)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition shadow-xs flex items-center gap-1.5"
              >
                {deletingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Memory Confirmation Dialog (Spec Section 1.11) */}
      {resetModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-bg-card border border-rose-500/30 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-2.5 text-rose-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-semibold text-text-main">
                Reset {activeTab === 'business' ? 'Business' : 'Personal'} Memory?
              </h3>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {activeTab === 'business'
                ? 'This permanently deletes all shared workspace memory notes. All teammates will lose shared assistant recall. This action cannot be undone.'
                : 'This permanently deletes all personal facts and instructions Stone AI remembers about you. Your chats will remain, but memory notes will be cleared.'}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-secondary transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={handleResetMemories}
                className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition shadow-xs flex items-center gap-1.5"
              >
                {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Reset all {activeTab} memory</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
