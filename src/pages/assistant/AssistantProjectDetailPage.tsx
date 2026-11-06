import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Folder, Users, Lock, MoreVertical, Edit2,
  Trash2, Archive, Share2, Plus, FileText, Link as LinkIcon,
  MessageSquare, Brain, Upload, X, Check, AlertTriangle,
  Loader2, ExternalLink, Eye, RefreshCw, Send, Search,
  Building, User, DollarSign, Calendar
} from 'lucide-react';
import {
  assistantApi,
  type AssistantProject,
  type AssistantProjectFile,
  type AssistantProjectLink,
  type AssistantConversation,
} from '../../lib/api/assistant';
import { crmApi } from '../../lib/api/crm';

export default function AssistantProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<AssistantProject | null>(null);
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [loading, setLoading] = useState(true);

  // Instructions edit state
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [savingInstructions, setSavingInstructions] = useState(false);

  // Header inline edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');

  // Right sidebar active tab
  const [activeTab, setActiveTab] = useState<'instructions' | 'files' | 'links'>('instructions');

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filePreviewContent, setFilePreviewContent] = useState<{ title: string; text: string } | null>(null);

  // Link CRM entity modal state
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkTab, setLinkTab] = useState<'contact' | 'deal' | 'company'>('contact');
  const [crmSearchQuery, setCrmSearchQuery] = useState('');
  const [crmContacts, setCrmContacts] = useState<any[]>([]);
  const [crmDeals, setCrmDeals] = useState<any[]>([]);
  const [crmCompanies, setCrmCompanies] = useState<any[]>([]);
  const [loadingCrm, setLoadingCrm] = useState(false);
  const [linkingEntityId, setLinkingEntityId] = useState<string | null>(null);

  // Delete project confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingProject, setDeletingProject] = useState(false);

  // Toast feedback
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const loadProjectData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [proj, chats] = await Promise.all([
        assistantApi.getProject(id),
        assistantApi.listConversations({ projectId: id }),
      ]);
      setProject(proj);
      setInstructionsDraft(proj.instructions || '');
      setNameDraft(proj.name || '');
      setDescDraft(proj.description || '');
      setConversations(chats.items);
    } catch (err) {
      console.error('[ProjectDetail] Failed to load project:', err);
      showFeedback('Project not found or accessible.', 'error');
      navigate('/assistant/projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectData();
  }, [id]);

  // Load CRM data for link modal
  const openLinkPicker = async () => {
    setIsLinkModalOpen(true);
    setLoadingCrm(true);
    try {
      const [contacts, deals, companies] = await Promise.all([
        crmApi.getContacts().catch(() => []),
        crmApi.getDeals().catch(() => []),
        crmApi.getCompanies().catch(() => []),
      ]);
      setCrmContacts(contacts);
      setCrmDeals(deals);
      setCrmCompanies(companies);
    } catch (err) {
      console.error('[ProjectDetail] Failed to load CRM entities:', err);
    } finally {
      setLoadingCrm(false);
    }
  };

  const handleSaveName = async () => {
    if (!id || !nameDraft.trim()) return;
    try {
      await assistantApi.updateProject(id, { name: nameDraft.trim() });
      setProject((prev) => (prev ? { ...prev, name: nameDraft.trim() } : prev));
      setIsEditingName(false);
      showFeedback('Project name updated.');
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to update name.', 'error');
    }
  };

  const handleSaveDescription = async () => {
    if (!id) return;
    try {
      await assistantApi.updateProject(id, { description: descDraft.trim() });
      setProject((prev) => (prev ? { ...prev, description: descDraft.trim() } : prev));
      setIsEditingDesc(false);
      showFeedback('Description updated.');
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to update description.', 'error');
    }
  };

  const handleSaveInstructions = async () => {
    if (!id) return;
    setSavingInstructions(true);
    try {
      await assistantApi.updateProject(id, { instructions: instructionsDraft.trim() });
      setProject((prev) => (prev ? { ...prev, instructions: instructionsDraft.trim() } : prev));
      setIsEditingInstructions(false);
      showFeedback('Project instructions saved.');
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to save instructions.', 'error');
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleToggleShare = async () => {
    if (!project) return;
    const newVisibility = project.visibility === 'workspace' ? 'private' : 'workspace';
    try {
      await assistantApi.updateProject(project.id, { visibility: newVisibility });
      setProject((prev) => (prev ? { ...prev, visibility: newVisibility } : prev));
      showFeedback(newVisibility === 'workspace' ? 'Project shared with workspace.' : 'Project made private.');
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to update visibility.', 'error');
    }
  };

  const handleToggleArchive = async () => {
    if (!project) return;
    const shouldArchive = !project.archivedAt;
    try {
      await assistantApi.updateProject(project.id, { archived: shouldArchive });
      setProject((prev) => (prev ? { ...prev, archivedAt: shouldArchive ? new Date().toISOString() : null } : prev));
      showFeedback(shouldArchive ? 'Project archived.' : 'Project restored.');
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to update archive status.', 'error');
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    if (deleteConfirmText.trim().toLowerCase() !== project.name.trim().toLowerCase()) {
      showFeedback('Project name confirmation did not match.', 'error');
      return;
    }

    setDeletingProject(true);
    try {
      await assistantApi.deleteProject(project.id);
      showFeedback('Project deleted.');
      navigate('/assistant/projects');
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to delete project.', 'error');
    } finally {
      setDeletingProject(false);
    }
  };

  // Start new chat inside this project
  const handleStartProjectChat = async () => {
    if (!id) return;
    try {
      const newConvo = await assistantApi.createConversation({
        projectId: id,
        title: `${project?.name || 'Project'} Chat`,
      });
      navigate(`/assistant/c/${newConvo.id}`);
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to create chat in project.', 'error');
    }
  };

  // Upload file handler
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !id) return;
    const file = files[0];

    // Check size limit (25MB)
    if (file.size > 25 * 1024 * 1024) {
      showFeedback('File exceeds 25 MB limit.', 'error');
      return;
    }

    setUploadingFile(true);
    try {
      let extractedText = '';
      if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.json')
      ) {
        extractedText = await file.text();
      }

      const added = await assistantApi.addProjectFile(id, {
        fileName: file.name,
        mimeType: file.type || 'text/plain',
        size: file.size,
        status: 'ready',
        extractedText: extractedText || undefined,
      });

      setProject((prev) => (prev ? { ...prev, files: [...(prev.files || []), added] } : prev));
      showFeedback(`File "${file.name}" uploaded successfully.`);
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to upload file.', 'error');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!id) return;
    try {
      await assistantApi.deleteProjectFile(id, fileId);
      setProject((prev) => (prev ? { ...prev, files: prev.files?.filter((f) => f.id !== fileId) } : prev));
      showFeedback('File removed.');
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to delete file.', 'error');
    }
  };

  // Link entity handler
  const handleLinkEntity = async (entityType: string, entityId: string, label: string) => {
    if (!id) return;
    setLinkingEntityId(entityId);
    try {
      const added = await assistantApi.addProjectLink(id, {
        entityType,
        entityId,
        label,
      });
      setProject((prev) => (prev ? { ...prev, links: [...(prev.links || []), added] } : prev));
      showFeedback(`Linked ${entityType}: "${label}".`);
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to link item.', 'error');
    } finally {
      setLinkingEntityId(null);
    }
  };

  const handleUnlinkEntity = async (linkId: string) => {
    if (!id) return;
    try {
      await assistantApi.deleteProjectLink(id, linkId);
      setProject((prev) => (prev ? { ...prev, links: prev.links?.filter((l) => l.id !== linkId) } : prev));
      showFeedback('Unlinked CRM item.');
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to unlink item.', 'error');
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-2 text-xs text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span>Loading project...</span>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex flex-col h-full w-full bg-bg overflow-hidden">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium shadow-md transition-all ${
            feedback.type === 'error'
              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
          }`}
        >
          {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="h-14 border-b border-border/50 px-6 flex items-center justify-between shrink-0 bg-bg/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/assistant/projects')}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover/70 transition-colors"
            title="Back to Projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{ backgroundColor: project.color || '#2563eb' }}
          />

          {/* Inline Edit Title */}
          {isEditingName ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                autoFocus
                className="px-2 py-0.5 rounded text-sm font-semibold bg-surface-hover text-text-main border border-primary outline-none"
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="p-1 text-primary hover:bg-primary/10 rounded"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="text-sm font-semibold text-text-main hover:text-primary transition-colors flex items-center gap-1.5 group"
            >
              <span className="truncate max-w-xs">{project.name}</span>
              <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </button>
          )}

          {/* Visibility Toggle Badge */}
          <button
            type="button"
            onClick={handleToggleShare}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1 transition-colors ${
              project.visibility === 'workspace'
                ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                : 'bg-surface-hover text-text-muted border-border/50 hover:text-text-main'
            }`}
            title="Click to toggle sharing"
          >
            {project.visibility === 'workspace' ? (
              <>
                <Users className="w-2.5 h-2.5" />
                <span>Shared</span>
              </>
            ) : (
              <>
                <Lock className="w-2.5 h-2.5" />
                <span>Private</span>
              </>
            )}
          </button>

          {project.archivedAt && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
              Archived
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartProjectChat}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-xs shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New chat</span>
          </button>

          <button
            type="button"
            onClick={handleToggleArchive}
            className="p-1.5 rounded-lg border border-border/50 text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
            title={project.archivedAt ? 'Restore project' : 'Archive project'}
          >
            <Archive className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setDeleteConfirmText('');
              setDeleteModalOpen(true);
            }}
            className="p-1.5 rounded-lg border border-border/50 text-rose-500 hover:bg-rose-500/10 transition-colors"
            title="Delete project"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Layout: 2 Columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Chats in this Project (60%) */}
        <div className="flex-1 flex flex-col border-r border-border/50 bg-bg overflow-y-auto">
          {/* Project Sub-header / Description */}
          <div className="p-6 border-b border-border/40 space-y-2 bg-surface-hover/10">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Project Overview
              </h2>
              <span className="text-[11px] text-text-muted">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* Editable Description */}
            {isEditingDesc ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  placeholder="Enter project description..."
                  className="w-full px-2.5 py-1 rounded-lg bg-bg text-xs text-text-main border border-primary outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveDescription();
                    if (e.key === 'Escape') setIsEditingDesc(false);
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveDescription}
                  className="px-2 py-1 rounded bg-primary text-white text-xs"
                >
                  Save
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingDesc(true)}
                className="text-xs text-text-muted hover:text-text-main cursor-pointer flex items-center gap-1.5 group"
                title="Click to edit description"
              >
                <span>{project.description || 'Add a description for this project...'}</span>
                <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
              </div>
            )}
          </div>

          {/* Chats Section */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-main">
                  Project Chats ({conversations.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={handleStartProjectChat}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Start new chat</span>
              </button>
            </div>

            {conversations.length === 0 ? (
              <div className="py-12 border border-dashed border-border/60 rounded-xl text-center p-6 space-y-3 bg-surface-hover/10">
                <MessageSquare className="w-8 h-8 text-text-muted/60 mx-auto" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-text-main">No chats in this project yet</p>
                  <p className="text-[11px] text-text-muted max-w-sm mx-auto">
                    Any chats started here will automatically inherit the project’s custom instructions, attached files, and linked CRM context.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartProjectChat}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-xs shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start first chat</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {conversations.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => navigate(`/assistant/c/${chat.id}`)}
                    className="p-3.5 rounded-xl border border-border/50 bg-bg hover:border-primary/40 hover:bg-surface-hover/30 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-text-main truncate group-hover:text-primary transition-colors">
                          {chat.title}
                        </p>
                        {chat.mode && chat.mode !== 'unset' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-surface-hover text-text-muted border border-border/40 uppercase">
                            {chat.mode}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted">
                        Active {new Date(chat.updatedAt).toLocaleString()}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/assistant/c/${chat.id}`);
                      }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-surface-hover transition-colors"
                      title="Open conversation"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Context Tabs (Instructions, Files, Linked CRM Items) (40%) */}
        <div className="w-[380px] lg:w-[440px] flex flex-col bg-bg/50 shrink-0 overflow-y-auto">
          {/* Context Tabs Header */}
          <div className="flex border-b border-border/50 px-4 pt-2 gap-1 bg-bg sticky top-0 z-10">
            <button
              type="button"
              onClick={() => setActiveTab('instructions')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'instructions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-main'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Instructions</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'files'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-main'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Files ({project.files?.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('links')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'links'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-main'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>CRM Context ({project.links?.length || 0})</span>
            </button>
          </div>

          {/* Context Tab 1: Instructions */}
          {activeTab === 'instructions' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-text-main">Project Instructions</h3>
                  <p className="text-[11px] text-text-muted">
                    Custom rules applied to every prompt inside this project.
                  </p>
                </div>

                {!isEditingInstructions && (
                  <button
                    type="button"
                    onClick={() => setIsEditingInstructions(true)}
                    className="p-1 rounded-md text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                    title="Edit instructions"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isEditingInstructions ? (
                <div className="space-y-3">
                  <textarea
                    rows={12}
                    value={instructionsDraft}
                    onChange={(e) => setInstructionsDraft(e.target.value)}
                    placeholder="Enter instructions, tone preferences, or background knowledge..."
                    className="w-full p-3 rounded-lg bg-surface-hover/50 text-xs text-text-main border border-border/60 outline-none focus:border-primary resize-none leading-relaxed"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInstructionsDraft(project.instructions || '');
                        setIsEditingInstructions(false);
                      }}
                      disabled={savingInstructions}
                      className="px-3 py-1.5 rounded-lg border border-border/50 text-text-muted hover:text-text-main text-xs font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveInstructions}
                      disabled={savingInstructions}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-medium transition-colors"
                    >
                      {savingInstructions && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Save Instructions</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-border/50 bg-bg text-xs text-text-main leading-relaxed min-h-[140px] whitespace-pre-wrap font-mono">
                  {project.instructions || (
                    <span className="text-text-muted italic font-sans">
                      No instructions set. Click the edit icon to add custom guidelines for this project.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Context Tab 2: Files */}
          {activeTab === 'files' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-text-main">Project Files</h3>
                  <p className="text-[11px] text-text-muted">
                    Reference documents, specs, and data sheets (up to 25 MB).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="flex items-center gap-1 py-1 px-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-xs shadow-xs transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Upload</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
              </div>

              {/* Drag and Drop Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                  handleFileUpload(e.dataTransfer.files);
                }}
                className={`p-4 border-2 border-dashed rounded-xl text-center transition-colors cursor-pointer ${
                  isDraggingFile
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 hover:border-border bg-surface-hover/10'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingFile ? (
                  <div className="flex flex-col items-center gap-1.5 text-xs text-text-muted py-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span>Processing file...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-xs text-text-muted py-2">
                    <Upload className="w-5 h-5 opacity-70 mb-0.5" />
                    <span className="font-medium text-text-main">Click or drag files here</span>
                    <span className="text-[10px]">PDF, Word, Text, CSV, JSON</span>
                  </div>
                )}
              </div>

              {/* File List */}
              <div className="space-y-2">
                {(!project.files || project.files.length === 0) ? (
                  <p className="text-xs text-text-muted text-center py-4">No files uploaded yet.</p>
                ) : (
                  project.files.map((file) => (
                    <div
                      key={file.id}
                      className="p-2.5 rounded-lg border border-border/50 bg-bg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-text-main truncate max-w-[200px]">
                            {file.fileName}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-text-muted">
                            <span>{formatFileSize(file.size)}</span>
                            <span className="px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase font-medium">
                              {file.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {file.extractedText && (
                          <button
                            type="button"
                            onClick={() =>
                              setFilePreviewContent({
                                title: file.fileName,
                                text: file.extractedText || '',
                              })
                            }
                            className="p-1 rounded text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                            title="Preview extracted text"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteFile(file.id)}
                          className="p-1 rounded text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Remove file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Context Tab 3: Linked CRM Items */}
          {activeTab === 'links' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-text-main">Linked CRM Items</h3>
                  <p className="text-[11px] text-text-muted">
                    In-scope contacts, companies, and deals fetched live during chats.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openLinkPicker}
                  className="flex items-center gap-1 py-1 px-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-xs shadow-xs transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Link Item</span>
                </button>
              </div>

              {/* Linked Items List */}
              <div className="space-y-2">
                {(!project.links || project.links.length === 0) ? (
                  <div className="py-6 border border-dashed border-border/60 rounded-xl text-center p-4 space-y-2 bg-surface-hover/10">
                    <LinkIcon className="w-6 h-6 text-text-muted/60 mx-auto" />
                    <p className="text-xs text-text-muted">No CRM items linked yet.</p>
                    <button
                      type="button"
                      onClick={openLinkPicker}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Search & link contacts or deals
                    </button>
                  </div>
                ) : (
                  project.links.map((link) => (
                    <div
                      key={link.id}
                      className="p-2.5 rounded-lg border border-border/50 bg-bg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        {link.entityType === 'contact' ? (
                          <User className="w-4 h-4 text-primary shrink-0" />
                        ) : link.entityType === 'deal' ? (
                          <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Building className="w-4 h-4 text-amber-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-text-main truncate max-w-[200px]">
                            {link.label || link.entityId}
                          </p>
                          <span className="text-[10px] text-text-muted uppercase font-medium">
                            {link.entityType}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUnlinkEntity(link.id)}
                        className="p-1 rounded text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Unlink"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CRM Link Picker Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in"
            onClick={() => setIsLinkModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-xl border border-border/60 bg-bg shadow-xl p-5 z-10 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-sm font-semibold text-text-main">Link CRM Item to Project</h2>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="p-1 rounded-md text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Entity Tabs */}
            <div className="flex gap-2 border-b border-border/40 pb-2">
              <button
                type="button"
                onClick={() => setLinkTab('contact')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  linkTab === 'contact' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:text-text-main'
                }`}
              >
                Contacts
              </button>
              <button
                type="button"
                onClick={() => setLinkTab('deal')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  linkTab === 'deal' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:text-text-main'
                }`}
              >
                Deals
              </button>
              <button
                type="button"
                onClick={() => setLinkTab('company')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  linkTab === 'company' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-text-muted hover:text-text-main'
                }`}
              >
                Companies
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/80" />
              <input
                type="text"
                value={crmSearchQuery}
                onChange={(e) => setCrmSearchQuery(e.target.value)}
                placeholder={`Search ${linkTab}s...`}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-surface-hover/50 text-text-main placeholder:text-text-muted/70 border border-border/50 outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-border/40 border border-border/40 rounded-lg">
              {loadingCrm ? (
                <div className="py-8 flex flex-col items-center justify-center gap-1.5 text-xs text-text-muted">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Loading CRM items...</span>
                </div>
              ) : (
                (() => {
                  const query = crmSearchQuery.toLowerCase();
                  if (linkTab === 'contact') {
                    const filtered = crmContacts.filter(
                      (c) =>
                        `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(query) ||
                        (c.email && c.email.toLowerCase().includes(query))
                    );
                    if (filtered.length === 0) return <p className="text-xs text-text-muted p-4 text-center">No contacts found.</p>;
                    return filtered.map((c) => {
                      const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || 'Unnamed Contact';
                      const isLinked = project.links?.some((l) => l.entityId === c.id);
                      return (
                        <div key={c.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-surface-hover/40">
                          <div>
                            <p className="font-medium text-text-main">{name}</p>
                            <p className="text-[10px] text-text-muted">{c.email}</p>
                          </div>
                          <button
                            type="button"
                            disabled={isLinked || linkingEntityId === c.id}
                            onClick={() => handleLinkEntity('contact', c.id, name)}
                            className="px-2.5 py-1 rounded bg-primary/10 text-primary hover:bg-primary hover:text-white font-medium text-xs transition-colors disabled:opacity-50"
                          >
                            {isLinked ? 'Linked' : 'Link'}
                          </button>
                        </div>
                      );
                    });
                  } else if (linkTab === 'deal') {
                    const filtered = crmDeals.filter((d) => (d.name || d.title || '').toLowerCase().includes(query));
                    if (filtered.length === 0) return <p className="text-xs text-text-muted p-4 text-center">No deals found.</p>;
                    return filtered.map((d) => {
                      const name = d.name || d.title || 'Unnamed Deal';
                      const isLinked = project.links?.some((l) => l.entityId === d.id);
                      return (
                        <div key={d.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-surface-hover/40">
                          <div>
                            <p className="font-medium text-text-main">{name}</p>
                            <p className="text-[10px] text-text-muted">${d.value || 0}</p>
                          </div>
                          <button
                            type="button"
                            disabled={isLinked || linkingEntityId === d.id}
                            onClick={() => handleLinkEntity('deal', d.id, name)}
                            className="px-2.5 py-1 rounded bg-primary/10 text-primary hover:bg-primary hover:text-white font-medium text-xs transition-colors disabled:opacity-50"
                          >
                            {isLinked ? 'Linked' : 'Link'}
                          </button>
                        </div>
                      );
                    });
                  } else {
                    const filtered = crmCompanies.filter((comp) => (comp.name || '').toLowerCase().includes(query));
                    if (filtered.length === 0) return <p className="text-xs text-text-muted p-4 text-center">No companies found.</p>;
                    return filtered.map((comp) => {
                      const name = comp.name || 'Unnamed Company';
                      const isLinked = project.links?.some((l) => l.entityId === comp.id);
                      return (
                        <div key={comp.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-surface-hover/40">
                          <p className="font-medium text-text-main">{name}</p>
                          <button
                            type="button"
                            disabled={isLinked || linkingEntityId === comp.id}
                            onClick={() => handleLinkEntity('company', comp.id, name)}
                            className="px-2.5 py-1 rounded bg-primary/10 text-primary hover:bg-primary hover:text-white font-medium text-xs transition-colors disabled:opacity-50"
                          >
                            {isLinked ? 'Linked' : 'Link'}
                          </button>
                        </div>
                      );
                    });
                  }
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Text Preview Modal */}
      {filePreviewContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in"
            onClick={() => setFilePreviewContent(null)}
          />
          <div className="relative w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border border-border/60 bg-bg shadow-xl p-5 z-10 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-sm font-semibold text-text-main truncate pr-2">
                {filePreviewContent.title}
              </h2>
              <button
                type="button"
                onClick={() => setFilePreviewContent(null)}
                className="p-1 rounded-md text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 rounded-lg bg-surface-hover/30 text-xs font-mono text-text-main leading-relaxed whitespace-pre-wrap">
              {filePreviewContent.text || 'No text extracted.'}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in"
            onClick={() => !deletingProject && setDeleteModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-rose-500/30 bg-bg shadow-xl p-5 z-10 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-sm font-semibold">Delete Project</h2>
            </div>

            <div className="space-y-2 text-xs text-text-muted">
              <p>
                Are you sure you want to delete <strong className="text-text-main font-semibold">{project.name}</strong>?
              </p>
              <p className="p-2.5 rounded-lg bg-surface-hover/50 border border-border/40 text-[11px] leading-relaxed">
                Project files and instructions will be removed. Chats will remain intact as unfiled conversations.
              </p>
              <div className="space-y-1 pt-1">
                <label className="font-medium text-text-main">
                  Type <span className="font-semibold select-all text-text-main">{project.name}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={project.name}
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-surface-hover/50 text-text-main border border-border/50 outline-none focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deletingProject}
                className="px-3 py-1.5 rounded-lg border border-border/50 text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                disabled={deletingProject || deleteConfirmText.trim().toLowerCase() !== project.name.trim().toLowerCase()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors disabled:opacity-40"
              >
                {deletingProject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Project</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
