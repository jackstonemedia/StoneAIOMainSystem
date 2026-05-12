import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Filter, MoreHorizontal, ArrowUpRight, 
  Play, Pause, Trash2, Clock, CheckCircle2, AlertCircle, Zap
} from 'lucide-react';
import { useWorkflows, useDeleteWorkflow } from '../hooks/useWorkflows';
import { useToast } from '../components/ui/Toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  published: { label: 'Active', color: 'text-green-500 bg-green-500/10 border-green-500/20', icon: CheckCircle2 },
  draft:     { label: 'Draft', color: 'text-text-muted bg-surface border-border', icon: Clock },
  paused:    { label: 'Paused', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20', icon: Pause },
  error:     { label: 'Error', color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: AlertCircle },
  ENABLED:   { label: 'Active', color: 'text-green-500 bg-green-500/10 border-green-500/20', icon: CheckCircle2 },
  DISABLED:  { label: 'Paused', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20', icon: Pause },
  DRAFT:     { label: 'Draft', color: 'text-text-muted bg-surface border-border', icon: Clock },
};

export default function Workflows() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const { data: workflows = [], isLoading } = useWorkflows();
  const deleteWorkflow = useDeleteWorkflow();
  
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);

  const filteredWorkflows = workflows.filter(w => 
    !search || w.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (!workflowToDelete) return;
    try {
      await deleteWorkflow.mutateAsync(workflowToDelete);
      toast('success', 'Workflow deleted successfully');
    } catch (e) {
      toast('error', 'Failed to delete workflow');
    }
    setWorkflowToDelete(null);
  };

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden animate-in fade-in duration-300">
      <div className="h-20 border-b border-border bg-surface shrink-0 flex items-center justify-between px-6 lg:px-8">
        <div>
          <h1 className="text-xl font-bold text-text-main">Workflows & Automations</h1>
          <p className="text-sm text-text-muted mt-1">Build event-driven sequences and autonomous agents to run your business.</p>
        </div>
        <button
          onClick={() => navigate('/workflows/new/builder')}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Workflow
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-surface/40 backdrop-blur-sm p-2 rounded-xl border border-border/50">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bg border border-border rounded-lg text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button className="px-3 py-2 bg-bg border border-border rounded-lg text-sm font-medium text-text-muted hover:text-text-main transition-colors flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg/50">
                  <th className="px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Trigger</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Last Updated</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                      Loading workflows...
                    </td>
                  </tr>
                ) : filteredWorkflows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="w-12 h-12 bg-surface border border-border rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Zap className="w-6 h-6 text-text-muted" />
                      </div>
                      <h3 className="text-sm font-medium text-text-main mb-1">No workflows found</h3>
                      <p className="text-xs text-text-muted">Create your first workflow to automate your operations.</p>
                    </td>
                  </tr>
                ) : (
                  filteredWorkflows.map((workflow) => {
                    const statusObj = STATUS_CONFIG[workflow.status] || STATUS_CONFIG['draft'];
                    const StatusIcon = statusObj.icon;
                    
                    return (
                      <tr 
                        key={workflow.id} 
                        onClick={() => navigate(`/workflows/${workflow.id}/builder`)}
                        className="group hover:bg-bg/50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-text-main group-hover:text-primary transition-colors">
                              {workflow.name}
                            </span>
                            {workflow.description && (
                              <span className="text-xs text-text-muted mt-0.5 truncate max-w-xs">
                                {workflow.description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-surface border border-border flex items-center justify-center">
                              <Zap className="w-3.5 h-3.5 text-text-muted" />
                            </div>
                            <span className="text-xs font-medium text-text-muted capitalize">
                              {workflow.triggerType?.replace('_', ' ') || 'Manual'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase border ${statusObj.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusObj.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-text-muted">
                          {new Date(workflow.updatedAt).toLocaleDateString(undefined, { 
                            month: 'short', day: 'numeric', year: 'numeric' 
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => navigate(`/workflows/${workflow.id}/builder`)}
                              className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Edit Workflow"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setWorkflowToDelete(workflow.id)}
                              className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Delete Workflow"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {workflowToDelete && (
        <div className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-text-main">Delete Workflow</h3>
              <p className="text-sm text-text-muted mt-2">
                Are you sure you want to delete this workflow? This action cannot be undone and will immediately stop all active runs.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-bg/50 border-t border-border">
              <button 
                onClick={() => setWorkflowToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-text-main hover:bg-bg rounded-lg transition-colors border border-transparent hover:border-border"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
