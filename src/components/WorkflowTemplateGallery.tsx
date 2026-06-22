import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Loader2 } from 'lucide-react';
import { useWorkflowTemplates, useInstallTemplate } from '../hooks/useWorkflows';
import { useToast } from './ui/Toast';
import type { WorkflowTemplate } from '../types/automation';

const CATEGORY_COLORS: Record<string, string> = {
  'CRM':          'bg-green-500/10 text-green-400 border-green-500/20',
  'Appointments': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Marketing':    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Reputation':   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Scheduling':   'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  'Integration':  'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export function WorkflowTemplateGallery() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: templates = [], isLoading } = useWorkflowTemplates();
  const installTemplate = useInstallTemplate();
  const [installing, setInstalling] = useState<string | null>(null);

  const grouped = templates.reduce((acc: Record<string, WorkflowTemplate[]>, tpl) => {
    acc[tpl.category] = acc[tpl.category] ?? [];
    acc[tpl.category].push(tpl);
    return acc;
  }, {});

  const handleInstall = async (templateId: string) => {
    setInstalling(templateId);
    try {
      const workflow = await installTemplate.mutateAsync({ templateId });
      toast('success', 'Template installed — opening builder');
      navigate(`/automations/${workflow.id}`);
    } catch (err: any) {
      toast('error', err.message || 'Failed to install template');
    } finally {
      setInstalling(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Zap className="w-12 h-12 text-text-muted mb-4 opacity-40" />
        <h2 className="text-lg font-semibold text-text-main mb-2">No templates found</h2>
        <p className="text-sm text-text-muted">Check back later for new templates.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {Object.entries(grouped).map(([category, tpls]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-lg font-semibold text-text-main">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tpls.map(tpl => (
              <div key={tpl.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col hover:border-accent transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-text-main">{tpl.name}</h3>
                    {tpl.description && (
                      <p className="text-sm text-text-muted mt-1">{tpl.description}</p>
                    )}
                  </div>
                  <div className={`px-2 py-1 rounded text-[10px] font-semibold border uppercase tracking-wider ${CATEGORY_COLORS[tpl.category] || 'bg-bg text-text-muted border-border'}`}>
                    {tpl.category}
                  </div>
                </div>
                
                <div className="mt-auto pt-4 flex flex-wrap gap-1 mb-4">
                  {JSON.parse(tpl.tags || '[]').map((tag: string) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded bg-bg text-[10px] text-text-muted">
                      {tag}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleInstall(tpl.id)}
                  disabled={installing === tpl.id}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {installing === tpl.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {installing === tpl.id ? 'Installing...' : 'Use Template'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
