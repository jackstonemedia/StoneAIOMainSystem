import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Plus, Folder, LayoutGrid, List,
  MoreVertical, Edit2, Copy, Share2, Archive, Trash2,
  FileText, MessageSquare, Link as LinkIcon, Lock, Users,
  Clock, AlertTriangle, Check, Loader2, Sparkles, X, RefreshCw
} from 'lucide-react';
import {
  assistantApi,
  type AssistantProject,
} from '../../lib/api/assistant';

const COLOR_OPTIONS = [
  { label: 'Blue', value: '#2563eb' },
  { label: 'Slate', value: '#475569' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Rose', value: '#e11d48' },
  { label: 'Cyan', value: '#0891b2' },
];

const STARTER_PROJECTS = [
  {
    name: 'Q4 win-back',
    description: 'Re-engage lost accounts and stale opportunities with tailored value propositions and special offers.',
    instructions: 'Focus on understanding past churn reasons. Always maintain an empathetic, consultative tone and emphasize recent product enhancements.',
    color: '#2563eb',
  },
  {
    name: 'Weekly pipeline review',
    description: 'Analyze open deals, inspect stage progression, and flag stalled opportunities requiring escalation.',
    instructions: 'Prioritize deals with no recent touchpoints. Prepare structured bullet points summarizing deal size, decision makers, and next milestones.',
    color: '#059669',
  },
  {
    name: 'New client onboarding',
    description: 'Track onboarding checklists, welcome sequences, and initial kickoff milestones for newly closed accounts.',
    instructions: 'Ensure all onboarding tasks are scheduled. Reference account team contacts and verify that welcome packages have been delivered.',
    color: '#0891b2',
  },
];

export default function AssistantProjectsPage() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<AssistantProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'mine' | 'shared' | 'archived'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<AssistantProject | null>(null);
  const [deleteTargetProject, setDeleteTargetProject] = useState<AssistantProject | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formColor, setFormColor] = useState(COLOR_OPTIONS[0].value);
  const [formVisibility, setFormVisibility] = useState<'private' | 'workspace'>('private');
  const [savingForm, setSavingForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Toast feedback
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await assistantApi.listProjects({
        filter: activeFilter,
        search: searchQuery,
      });
      setProjects(data);
    } catch (err) {
      console.error('[Projects] Failed to load projects:', err);
      showFeedback('Failed to load projects.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [activeFilter, searchQuery]);

  // Close open menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const openCreateModal = (starter?: typeof STARTER_PROJECTS[0]) => {
    setEditingProject(null);
    if (starter) {
      setFormName(starter.name);
      setFormDescription(starter.description);
      setFormInstructions(starter.instructions);
      setFormColor(starter.color);
    } else {
      setFormName('');
      setFormDescription('');
      setFormInstructions('');
      setFormColor(COLOR_OPTIONS[0].value);
    }
    setFormVisibility('private');
    setIsCreateModalOpen(true);
  };

  const openEditModal = (project: AssistantProject) => {
    setEditingProject(project);
    setFormName(project.name);
    setFormDescription(project.description || '');
    setFormInstructions(project.instructions || '');
    setFormColor(project.color || COLOR_OPTIONS[0].value);
    setFormVisibility((project.visibility as 'private' | 'workspace') || 'private');
    setIsCreateModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showFeedback('Project name is required.', 'error');
      return;
    }

    setSavingForm(true);
    try {
      if (editingProject) {
        await assistantApi.updateProject(editingProject.id, {
          name: formName.trim(),
          description: formDescription.trim(),
          instructions: formInstructions.trim(),
          color: formColor,
          visibility: formVisibility,
        });
        showFeedback('Project updated successfully.');
      } else {
        await assistantApi.createProject({
          name: formName.trim(),
          description: formDescription.trim(),
          instructions: formInstructions.trim(),
          color: formColor,
          visibility: formVisibility,
        });
        showFeedback('Project created successfully.');
      }
      setIsCreateModalOpen(false);
      loadProjects();
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to save project.', 'error');
    } finally {
      setSavingForm(false);
    }
  };

  const handleToggleShare = async (project: AssistantProject) => {
    const newVisibility = project.visibility === 'workspace' ? 'private' : 'workspace';
    try {
      await assistantApi.updateProject(project.id, { visibility: newVisibility });
      showFeedback(newVisibility === 'workspace' ? 'Project shared with workspace.' : 'Project made private.');
      loadProjects();
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to update visibility.', 'error');
    }
  };

  const handleToggleArchive = async (project: AssistantProject) => {
    const shouldArchive = !project.archivedAt;
    try {
      await assistantApi.updateProject(project.id, { archived: shouldArchive });
      showFeedback(shouldArchive ? 'Project archived.' : 'Project restored.');
      loadProjects();
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to archive/restore project.', 'error');
    }
  };

  const handleDuplicate = async (project: AssistantProject) => {
    try {
      await assistantApi.createProject({
        name: `${project.name} (Copy)`,
        description: project.description,
        instructions: project.instructions,
        color: project.color,
        visibility: 'private',
      });
      showFeedback('Project duplicated.');
      loadProjects();
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to duplicate project.', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetProject) return;
    if (deleteConfirmText.trim().toLowerCase() !== deleteTargetProject.name.trim().toLowerCase()) {
      showFeedback('Project name confirmation did not match.', 'error');
      return;
    }

    setDeleting(true);
    try {
      await assistantApi.deleteProject(deleteTargetProject.id);
      showFeedback('Project deleted. Associated chats were unfiled.');
      setDeleteTargetProject(null);
      setDeleteConfirmText('');
      loadProjects();
    } catch (err: any) {
      showFeedback(err?.message || 'Failed to delete project.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Sorted list
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [projects, sortBy]);

  return (
    <div className="flex flex-col h-full w-full bg-bg overflow-y-auto">
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
      <header className="h-14 border-b border-border/50 px-6 flex items-center justify-between shrink-0 bg-bg/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/assistant')}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover/70 transition-colors"
            title="Back to Assistant"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text-main leading-tight">Projects</h1>
              <p className="text-[11px] text-text-muted leading-none">
                Dedicated spaces with custom instructions, files, and linked CRM records.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-xs shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New project</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Controls Bar: Search, Filters, Sort, View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between border-b border-border/40 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Tabs */}
            {(['all', 'mine', 'shared', 'archived'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  activeFilter === filter
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover/70 border border-transparent'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/80" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg text-xs bg-surface-hover/50 text-text-main placeholder:text-text-muted/70 border border-border/40 outline-none focus:border-primary/60 transition-colors"
              />
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'name')}
              aria-label="Sort projects"
              className="py-1.5 px-2 rounded-lg text-xs bg-surface-hover/50 text-text-main border border-border/40 outline-none focus:border-primary/60 transition-colors cursor-pointer"
            >
              <option value="recent">Recent activity</option>
              <option value="name">Name (A-Z)</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border/40 p-0.5 bg-surface-hover/30">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded-md transition-colors ${
                  viewMode === 'grid' ? 'bg-bg text-text-main shadow-xs' : 'text-text-muted hover:text-text-main'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-bg text-text-main shadow-xs' : 'text-text-muted hover:text-text-main'
                }`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-text-muted text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Loading projects...</span>
          </div>
        ) : sortedProjects.length === 0 ? (
          /* Empty State */
          <div className="py-12 border border-border/40 rounded-xl bg-surface-hover/20 text-center px-4 max-w-2xl mx-auto space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto">
              <Folder className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-text-main">No projects found</h2>
              <p className="text-xs text-text-muted max-w-md mx-auto">
                Projects keep your chats organized with dedicated instructions, documents, and CRM records.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-1.5 py-2 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-xs shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create project</span>
            </button>

            {/* Three Starter Templates */}
            <div className="pt-4 border-t border-border/40 text-left space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Or start with a template
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {STARTER_PROJECTS.map((starter) => (
                  <button
                    key={starter.name}
                    type="button"
                    onClick={() => openCreateModal(starter)}
                    className="p-3.5 rounded-xl border border-border/50 bg-bg hover:border-primary/40 hover:bg-surface-hover/30 text-left transition-all space-y-1.5 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: starter.color }} />
                      <span className="text-xs font-semibold text-text-main group-hover:text-primary transition-colors">
                        {starter.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
                      {starter.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/assistant/projects/${project.id}`)}
                className="group p-4 rounded-xl border border-border/50 bg-bg hover:border-border hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between relative"
              >
                <div className="space-y-2.5">
                  {/* Top Bar: Color Accent & Action Menu */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: project.color || '#2563eb' }}
                      />
                      <h2 className="text-xs font-semibold text-text-main truncate max-w-[180px] group-hover:text-primary transition-colors">
                        {project.name}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {project.visibility === 'workspace' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" />
                          <span>Shared</span>
                        </span>
                      )}

                      {project.archivedAt && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Archived
                        </span>
                      )}

                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === project.id ? null : project.id);
                          }}
                          className="p-1 rounded-md text-text-muted hover:text-text-main hover:bg-surface-hover/70 transition-colors"
                          title="More options"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuId === project.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border/60 bg-bg shadow-lg py-1 z-20 text-[11px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                navigate(`/assistant/projects/${project.id}`);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-text-main hover:bg-surface-hover text-left transition-colors"
                            >
                              <Folder className="w-3 h-3 text-text-muted" />
                              <span>Open project</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                openEditModal(project);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-text-main hover:bg-surface-hover text-left transition-colors"
                            >
                              <Edit2 className="w-3 h-3 text-text-muted" />
                              <span>Rename & settings</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                handleDuplicate(project);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-text-main hover:bg-surface-hover text-left transition-colors"
                            >
                              <Copy className="w-3 h-3 text-text-muted" />
                              <span>Duplicate</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                handleToggleShare(project);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-text-main hover:bg-surface-hover text-left transition-colors"
                            >
                              <Share2 className="w-3 h-3 text-text-muted" />
                              <span>{project.visibility === 'workspace' ? 'Make private' : 'Share with workspace'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                handleToggleArchive(project);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-text-main hover:bg-surface-hover text-left transition-colors"
                            >
                              <Archive className="w-3 h-3 text-text-muted" />
                              <span>{project.archivedAt ? 'Restore project' : 'Archive project'}</span>
                            </button>
                            <div className="my-1 border-t border-border/40" />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setDeleteTargetProject(project);
                                setDeleteConfirmText('');
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-500 hover:bg-rose-500/10 text-left transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete project</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed min-h-[32px]">
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                {/* Footer Metadata */}
                <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between text-[10px] text-text-muted">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1" title="Chats">
                      <MessageSquare className="w-3 h-3 opacity-70" />
                      <span>{project.chatCount || 0}</span>
                    </span>
                    <span className="flex items-center gap-1" title="Files">
                      <FileText className="w-3 h-3 opacity-70" />
                      <span>{project.files?.length || 0}</span>
                    </span>
                    <span className="flex items-center gap-1" title="Linked CRM items">
                      <LinkIcon className="w-3 h-3 opacity-70" />
                      <span>{project.links?.length || 0}</span>
                    </span>
                  </div>

                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 opacity-70" />
                    <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="border border-border/40 rounded-xl bg-bg divide-y divide-border/40 overflow-hidden">
            {sortedProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/assistant/projects/${project.id}`)}
                className="group px-4 py-3 flex items-center justify-between hover:bg-surface-hover/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: project.color || '#2563eb' }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-main truncate group-hover:text-primary transition-colors">
                        {project.name}
                      </span>
                      {project.visibility === 'workspace' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-primary/10 text-primary border border-primary/20">
                          Shared
                        </span>
                      )}
                      {project.archivedAt && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Archived
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-[11px] text-text-muted truncate max-w-md">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-text-muted text-[11px]">
                  <span className="hidden sm:inline">{project.chatCount || 0} chats</span>
                  <span className="hidden sm:inline">{project.files?.length || 0} files</span>
                  <span className="text-[10px]">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>

                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === project.id ? null : project.id);
                      }}
                      className="p-1 rounded-md text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {activeMenuId === project.id && (
                      <div
                        className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border/60 bg-bg shadow-lg py-1 z-20 text-[11px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            navigate(`/assistant/projects/${project.id}`);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-text-main hover:bg-surface-hover text-left transition-colors"
                        >
                          <Folder className="w-3 h-3 text-text-muted" />
                          <span>Open project</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            openEditModal(project);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-text-main hover:bg-surface-hover text-left transition-colors"
                        >
                          <Edit2 className="w-3 h-3 text-text-muted" />
                          <span>Rename & settings</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            handleDuplicate(project);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-text-main hover:bg-surface-hover text-left transition-colors"
                        >
                          <Copy className="w-3 h-3 text-text-muted" />
                          <span>Duplicate</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            handleToggleShare(project);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-text-main hover:bg-surface-hover text-left transition-colors"
                        >
                          <Share2 className="w-3 h-3 text-text-muted" />
                          <span>{project.visibility === 'workspace' ? 'Make private' : 'Share with workspace'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            handleToggleArchive(project);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-text-main hover:bg-surface-hover text-left transition-colors"
                        >
                          <Archive className="w-3 h-3 text-text-muted" />
                          <span>{project.archivedAt ? 'Restore project' : 'Archive project'}</span>
                        </button>
                        <div className="my-1 border-t border-border/40" />
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            setDeleteTargetProject(project);
                            setDeleteConfirmText('');
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-500 hover:bg-rose-500/10 text-left transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete project</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in"
            onClick={() => !savingForm && setIsCreateModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-xl border border-border/60 bg-bg shadow-xl p-5 z-10 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="text-sm font-semibold text-text-main">
                {editingProject ? 'Edit Project' : 'New Project'}
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-md text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
              {/* Project Name */}
              <div className="space-y-1">
                <label className="font-medium text-text-main">Project Name *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Q4 Growth Initiatives"
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-surface-hover/50 text-text-main placeholder:text-text-muted/70 border border-border/50 outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-medium text-text-main">Description (optional)</label>
                <input
                  type="text"
                  maxLength={250}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief summary of what this project covers..."
                  className="w-full px-3 py-2 rounded-lg bg-surface-hover/50 text-text-main placeholder:text-text-muted/70 border border-border/50 outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Instructions */}
              <div className="space-y-1">
                <label className="font-medium text-text-main">Project Instructions (optional)</label>
                <p className="text-[11px] text-text-muted">
                  These instructions are automatically included in every chat created inside this project.
                </p>
                <textarea
                  rows={4}
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  placeholder="e.g. Focus on concise executive summaries. Always format outreach with bullet points..."
                  className="w-full px-3 py-2 rounded-lg bg-surface-hover/50 text-text-main placeholder:text-text-muted/70 border border-border/50 outline-none focus:border-primary transition-colors resize-none leading-relaxed"
                />
              </div>

              {/* Color Swatches */}
              <div className="space-y-1.5">
                <label className="font-medium text-text-main">Project Color</label>
                <div className="flex items-center gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormColor(c.value)}
                      className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center ${
                        formColor === c.value ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-bg' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Visibility Setting */}
              <div className="space-y-1.5 pt-1">
                <label className="font-medium text-text-main">Visibility & Sharing</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormVisibility('private')}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition-colors ${
                      formVisibility === 'private'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border/50 hover:bg-surface-hover/50 text-text-muted'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-text-main leading-tight">Private</p>
                      <p className="text-[10px] text-text-muted leading-tight mt-0.5">Only you can view and use</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormVisibility('workspace')}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition-colors ${
                      formVisibility === 'workspace'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border/50 hover:bg-surface-hover/50 text-text-muted'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-text-main leading-tight">Workspace</p>
                      <p className="text-[10px] text-text-muted leading-tight mt-0.5">Visible to workspace members</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={savingForm}
                  className="px-3 py-1.5 rounded-lg border border-border/50 text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-xs transition-colors disabled:opacity-50"
                >
                  {savingForm && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingProject ? 'Save Changes' : 'Create Project'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal (Type to confirm as in Spec 9.3) */}
      {deleteTargetProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in"
            onClick={() => !deleting && setDeleteTargetProject(null)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-rose-500/30 bg-bg shadow-xl p-5 z-10 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-sm font-semibold">Delete Project</h2>
            </div>

            <div className="space-y-2 text-xs text-text-muted">
              <p>
                Are you sure you want to delete <strong className="text-text-main font-semibold">{deleteTargetProject.name}</strong>?
              </p>
              <p className="p-2.5 rounded-lg bg-surface-hover/50 border border-border/40 text-[11px] leading-relaxed">
                Project files and instructions will be deleted. Any chats filed in this project will remain intact and become unfiled conversations.
              </p>
              <div className="space-y-1 pt-1">
                <label className="font-medium text-text-main">
                  Type <span className="font-semibold select-all text-text-main">{deleteTargetProject.name}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteTargetProject.name}
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-surface-hover/50 text-text-main border border-border/50 outline-none focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setDeleteTargetProject(null)}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg border border-border/50 text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting || deleteConfirmText.trim().toLowerCase() !== deleteTargetProject.name.trim().toLowerCase()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors disabled:opacity-40"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Project</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
