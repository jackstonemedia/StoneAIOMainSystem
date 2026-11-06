import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarClock, Plus, Play, Trash2, Edit3,
  X, Check, AlertTriangle, Loader2, Clock,
  ChevronRight, Shield, RefreshCw
} from 'lucide-react';
import {
  assistantApi,
  type AssistantScheduledTask,
  type AssistantTaskRun
} from '../../lib/api/assistant';

// Helper to turn common cron expressions into natural language
function formatCronToWords(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;

  const [min, hour, dayOfMonth, month, dayOfWeek] = parts;

  const formatHourMin = (h: string, m: string) => {
    const numH = parseInt(h, 10);
    const numM = parseInt(m, 10);
    if (isNaN(numH) || isNaN(numM)) return `${h}:${m}`;
    const period = numH >= 12 ? 'PM' : 'AM';
    const displayH = numH % 12 === 0 ? 12 : numH % 12;
    const displayM = numM < 10 ? `0${numM}` : `${numM}`;
    return `${displayH}:${displayM} ${period}`;
  };

  const timeStr = formatHourMin(hour, min);

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Daily at ${timeStr}`;
  }
  if (dayOfWeek === '1-5') {
    return `Every weekday at ${timeStr}`;
  }
  const dayNames: Record<string, string> = {
    '0': 'Sunday',
    '1': 'Monday',
    '2': 'Tuesday',
    '3': 'Wednesday',
    '4': 'Thursday',
    '5': 'Friday',
    '6': 'Saturday',
    '7': 'Sunday',
  };
  if (dayNames[dayOfWeek]) {
    return `Every ${dayNames[dayOfWeek]} at ${timeStr}`;
  }
  if (dayOfMonth !== '*' && month === '*') {
    return `Monthly on day ${dayOfMonth} at ${timeStr}`;
  }

  return `${cron} (${timeStr})`;
}

export default function AssistantScheduledPage() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId?: string }>();

  const [tasks, setTasks] = useState<AssistantScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<AssistantScheduledTask | null>(null);
  const [runs, setRuns] = useState<AssistantTaskRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AssistantScheduledTask | null>(null);
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'weekly' | 'monthly'>('daily');
  const [timeStr, setTimeStr] = useState('09:00');
  const [dayOfWeek, setDayOfWeek] = useState('1'); // Monday
  const [mode, setMode] = useState<'read_only' | 'draft' | 'full'>('read_only');
  const [fullConfirm, setFullConfirm] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

  // Run now execution
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);

  // Selected run result modal
  const [selectedRunResult, setSelectedRunResult] = useState<AssistantTaskRun | null>(null);

  // Delete modal
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Feedback toast
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await assistantApi.listScheduledTasks();
      setTasks(data);

      if (taskId) {
        const found = data.find((t) => t.id === taskId);
        if (found) {
          handleSelectTask(found);
        }
      }
    } catch {
      showFeedback('Failed to load scheduled tasks.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [taskId]);

  const handleSelectTask = async (task: AssistantScheduledTask) => {
    setSelectedTask(task);
    setLoadingRuns(true);
    try {
      const taskDetail = await assistantApi.getScheduledTask(task.id);
      setSelectedTask(taskDetail);
      setRuns(taskDetail.runs || []);
    } catch {
      showFeedback('Failed to load task runs.', 'error');
    } finally {
      setLoadingRuns(false);
    }
  };

  const handleToggleActive = async (task: AssistantScheduledTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = task.status === 'active' ? 'paused' : 'active';
    try {
      const updated = await assistantApi.updateScheduledTask(task.id, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      if (selectedTask?.id === task.id) {
        setSelectedTask(updated);
      }
      showFeedback(`Task ${newStatus === 'active' ? 'resumed' : 'paused'}.`);
    } catch {
      showFeedback('Failed to update task status.', 'error');
    }
  };

  const handleOpenCreate = () => {
    setEditingTask(null);
    setTitle('');
    setPrompt('');
    setFrequency('daily');
    setTimeStr('09:00');
    setDayOfWeek('1');
    setMode('read_only');
    setFullConfirm(false);
    setFormOpen(true);
  };

  const handleOpenEdit = (task: AssistantScheduledTask, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTask(task);
    setTitle(task.title);
    setPrompt(task.prompt);
    setMode(task.mode as any);
    setFullConfirm(task.mode === 'full');
    setFormOpen(true);
  };

  const computeCron = (): string => {
    const [h, m] = timeStr.split(':');
    const minute = parseInt(m, 10) || 0;
    const hour = parseInt(h, 10) || 9;

    if (frequency === 'daily') return `${minute} ${hour} * * *`;
    if (frequency === 'weekdays') return `${minute} ${hour} * * 1-5`;
    if (frequency === 'weekly') return `${minute} ${hour} * * ${dayOfWeek}`;
    if (frequency === 'monthly') return `${minute} ${hour} 1 * *`;
    return `${minute} ${hour} * * *`;
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !prompt.trim() || savingForm) return;

    if (mode === 'full' && !fullConfirm) {
      showFeedback('Please confirm Full Autonomy permissions.', 'error');
      return;
    }

    setSavingForm(true);
    const cron = computeCron();

    try {
      if (editingTask) {
        const updated = await assistantApi.updateScheduledTask(editingTask.id, {
          title: title.trim(),
          prompt: prompt.trim(),
          cron,
          mode,
        });
        setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? updated : t)));
        if (selectedTask?.id === editingTask.id) setSelectedTask(updated);
        showFeedback('Scheduled task updated.');
      } else {
        const created = await assistantApi.createScheduledTask({
          title: title.trim(),
          prompt: prompt.trim(),
          cron,
          mode,
        });
        setTasks((prev) => [created, ...prev]);
        showFeedback('New scheduled task created.');
      }
      setFormOpen(false);
    } catch (err: any) {
      showFeedback(err?.response?.data?.error || 'Failed to save scheduled task.', 'error');
    } finally {
      setSavingForm(false);
    }
  };

  const handleRunNow = async (task: AssistantScheduledTask, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRunningTaskId(task.id);
    try {
      const run = await assistantApi.runScheduledTask(task.id);
      showFeedback('Task run initiated successfully.');
      if (selectedTask?.id === task.id) {
        setRuns((prev) => [run, ...prev]);
      }
      await loadTasks();
    } catch (err: any) {
      showFeedback(err?.response?.data?.error || 'Failed to trigger run.', 'error');
    } finally {
      setRunningTaskId(null);
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteModalId) return;
    setDeleting(true);
    try {
      await assistantApi.deleteScheduledTask(deleteModalId);
      setTasks((prev) => prev.filter((t) => t.id !== deleteModalId));
      if (selectedTask?.id === deleteModalId) {
        setSelectedTask(null);
        setRuns([]);
      }
      setDeleteModalId(null);
      showFeedback('Scheduled task deleted.');
    } catch {
      showFeedback('Failed to delete scheduled task.', 'error');
    } finally {
      setDeleting(false);
    }
  };

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
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Scheduled Tasks</h1>
            <p className="text-xs text-text-muted">
              Configure background automations, recurring audits, and hands-free reporting
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New scheduled task</span>
          </button>
        </div>
      </header>

      {/* Main Content Area: Split List & Details */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scheduled Tasks List (Spec Section 1.13) */}
        <div className={`${selectedTask ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Configured Automations ({tasks.length})
            </span>
            <button
              type="button"
              onClick={loadTasks}
              className="text-xs text-text-muted hover:text-text-main flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-text-muted">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-xs">Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-border p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-bg-secondary text-text-muted mx-auto flex items-center justify-center">
                <CalendarClock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-text-main">No scheduled tasks yet</h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                Schedule recurring automations like daily lead triage, weekly email summaries, or pipeline audits.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create first scheduled task</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tasks.map((task) => {
                const isSelected = selectedTask?.id === task.id;
                const isRunning = runningTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    onClick={() => handleSelectTask(task)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-primary/5 border-primary shadow-xs'
                        : 'bg-bg-card border-border/80 hover:border-border hover:shadow-xs'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-text-main truncate">{task.title}</h4>
                        {/* Mode badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase shrink-0 ${
                            task.mode === 'full'
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              : task.mode === 'draft'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-primary/10 text-primary border border-primary/20'
                          }`}
                        >
                          {task.mode.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 opacity-70" />
                          <span>{formatCronToWords(task.cron)}</span>
                        </span>
                        {task.lastRunAt && (
                          <span>
                            Last run {new Date(task.lastRunAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right action group */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                      {/* Active toggle */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={task.status === 'active'}
                        onClick={(e) => handleToggleActive(task, e)}
                        title={task.status === 'active' ? 'Active (Click to pause)' : 'Paused (Click to activate)'}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          task.status === 'active' ? 'bg-primary' : 'bg-border'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            task.status === 'active' ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      {/* Run Now Button */}
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={(e) => handleRunNow(task, e)}
                        className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text-main hover:bg-bg-secondary transition disabled:opacity-50"
                        title="Run now immediately"
                      >
                        {isRunning ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(task, e)}
                        className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text-main hover:bg-bg-secondary transition"
                        title="Edit task"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setDeleteModalId(task.id)}
                        className="p-1.5 rounded-lg border border-border text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <ChevronRight className={`w-4 h-4 text-text-muted transition ${isSelected ? 'text-primary rotate-90 sm:rotate-0' : ''}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Task Detail & Run History (Spec Section 1.13) */}
        {selectedTask && (
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-bg-card border border-border/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="space-y-0.5 min-w-0 pr-2">
                  <h3 className="text-sm font-semibold text-text-main truncate">{selectedTask.title}</h3>
                  <p className="text-xs text-text-muted">{formatCronToWords(selectedTask.cron)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="p-1 rounded-lg text-text-muted hover:text-text-main"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Instructions Box */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  Automation Prompt
                </span>
                <div className="p-3 rounded-xl bg-bg/70 border border-border/40 text-xs text-text-main leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {selectedTask.prompt}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={runningTaskId === selectedTask.id}
                  onClick={() => handleRunNow(selectedTask)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition shadow-xs disabled:opacity-50"
                >
                  {runningTaskId === selectedTask.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Run now</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(selectedTask)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border text-xs text-text-muted hover:text-text-main hover:bg-bg-secondary transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteModalId(selectedTask.id)}
                    className="p-1.5 rounded-xl border border-border text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Run History Table (Spec Section 1.13) */}
            <div className="p-5 rounded-2xl bg-bg-card border border-border/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Run History ({runs.length})
                </span>
                {loadingRuns && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
              </div>

              {runs.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-muted space-y-1">
                  <p>No runs recorded yet for this task.</p>
                  <p className="text-[11px] opacity-70">Click "Run now" to trigger the first execution.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {runs.map((run) => (
                    <div
                      key={run.id}
                      onClick={() => setSelectedRunResult(run)}
                      className="p-3 rounded-xl bg-bg/60 border border-border/40 hover:border-primary/40 transition cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              run.status === 'completed'
                                ? 'bg-emerald-500'
                                : run.status === 'failed'
                                ? 'bg-rose-500'
                                : 'bg-primary animate-pulse'
                            }`}
                          />
                          <span className="font-medium text-text-main capitalize">{run.status}</span>
                        </div>
                        <span className="text-[11px] text-text-muted">
                          {new Date(run.startedAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="text-right text-[11px] text-text-muted">
                        <span>{run.outputTokens ? `${run.outputTokens} tokens` : '—'}</span>
                        <ChevronRight className="w-3.5 h-3.5 inline ml-1 text-text-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* New / Edit Task Modal (Spec Section 1.13) */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <form
            onSubmit={handleSaveForm}
            className="w-full max-w-lg rounded-2xl bg-bg-card border border-border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-sm font-semibold text-text-main">
                {editingTask ? 'Edit Scheduled Task' : 'New Scheduled Task'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-text-muted hover:text-text-main"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Task Title */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                Task Name (Required)
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Daily Morning Lead Summary"
                className="w-full px-3 py-2 rounded-xl bg-bg border border-border text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Instructions / Prompt */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                Instructions (What should Stone AI do?)
              </label>
              <textarea
                rows={4}
                required
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Look up contacts added in the past 24 hours, check for high-value deal pipeline changes, and summarize urgent items."
                className="w-full px-3 py-2 rounded-xl bg-bg border border-border text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-none"
              />
            </div>

            {/* Schedule Section */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="daily">Daily</option>
                  <option value="weekdays">Every Weekday (Mon–Fri)</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                  Execution Time
                </label>
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-bg border border-border text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Access Mode Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                Access Mode Ceiling
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'read_only', label: 'Read-only', desc: 'Queries only' },
                  { id: 'draft', label: 'Draft', desc: 'Proposes actions' },
                  { id: 'full', label: 'Full Autonomy', desc: 'Zero approval gate' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMode(m.id as any);
                      if (m.id !== 'full') setFullConfirm(false);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      mode === m.id
                        ? 'bg-primary/10 border-primary text-text-main'
                        : 'bg-bg/40 border-border text-text-muted hover:border-border/80'
                    }`}
                  >
                    <div className="text-xs font-semibold">{m.label}</div>
                    <div className="text-[10px] opacity-70">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Full autonomy confirmation check */}
            {mode === 'full' && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-rose-500 font-semibold">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>Full Autonomy Warning</span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Stone AI will execute CRM mutations and calendar events without manual approval during background runs.
                </p>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={fullConfirm}
                    onChange={(e) => setFullConfirm(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-[11px] text-text-main font-medium">
                    I confirm and authorize hands-free execution for this task
                  </span>
                </label>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-secondary transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingForm || (mode === 'full' && !fullConfirm)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition shadow-xs disabled:opacity-50"
              >
                {savingForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{editingTask ? 'Save Changes' : 'Create Task'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Run Output Result Modal */}
      {selectedRunResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-bg-card border border-border p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-text-main">Scheduled Run Output</h3>
                <span className="text-[11px] text-text-muted">
                  Executed {new Date(selectedRunResult.startedAt).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRunResult(null)}
                className="text-text-muted hover:text-text-main"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {selectedRunResult.error ? (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">
                  <div className="font-semibold mb-1">Execution Error:</div>
                  <pre className="whitespace-pre-wrap font-mono text-[11px]">{selectedRunResult.error}</pre>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-bg border border-border/60 text-xs text-text-main leading-relaxed whitespace-pre-wrap font-sans">
                  {selectedRunResult.resultText || 'Execution completed with no return message.'}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs text-text-muted">
              <span>Tokens: {selectedRunResult.inputTokens + selectedRunResult.outputTokens}</span>
              <button
                type="button"
                onClick={() => setSelectedRunResult(null)}
                className="px-3 py-1.5 rounded-xl bg-bg-secondary text-text-main text-xs font-medium hover:bg-bg-secondary/80 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-bg-card border border-border p-5 shadow-xl space-y-3">
            <h3 className="text-sm font-semibold text-text-main">Delete this scheduled task?</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              This will cancel future recurring executions and remove all associated run history.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalId(null)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-text-muted hover:text-text-main hover:bg-bg-secondary transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteTask}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 transition shadow-xs flex items-center gap-1.5"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Task</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
