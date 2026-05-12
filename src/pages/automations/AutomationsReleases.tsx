import { useState } from 'react';
import { GitMerge, Plus, Github, Info, Loader2, Play } from 'lucide-react';
import { useReleases, useCreateRelease, usePushToGit } from '../../hooks/useReleases';
import { useToast } from '../../components/ui/Toast';

export default function AutomationsReleases() {
  const [activeTab, setActiveTab] = useState<'releases' | 'git'>('releases');
  const [showNewRelease, setShowNewRelease] = useState(false);
  const [releaseName, setReleaseName] = useState('');
  
  const { data: releases = [], isLoading } = useReleases();
  const createRelease = useCreateRelease();
  const pushToGit = usePushToGit();
  const { toast } = useToast();

  const handleCreateRelease = async () => {
    try {
      await createRelease.mutateAsync({ name: releaseName || `Release v${releases.length + 1}.0` });
      setShowNewRelease(false);
      setReleaseName('');
      toast('success', 'Release created successfully');
    } catch (e: any) {
      toast('error', e.message || 'Failed to create release');
    }
  };

  const handlePushToGit = async () => {
    try {
      await pushToGit.mutateAsync();
      toast('success', 'Successfully pushed releases to Git');
    } catch (e: any) {
      toast('error', e.message || 'Failed to push to Git');
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-surface shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text-main flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-accent" />
            Releases
          </h1>
          <p className="text-xs text-text-muted mt-0.5">Manage workflow deployments and environments</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handlePushToGit}
            disabled={pushToGit.isPending}
            className="flex items-center gap-2 px-3 py-1.5 border border-border text-text-muted text-sm rounded-lg hover:bg-surface hover:text-text-main transition-colors disabled:opacity-50"
          >
            {pushToGit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
            {pushToGit.isPending ? 'Pushing...' : 'Push to Git'}
          </button>
          
          <button 
            onClick={() => setShowNewRelease(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Release
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {showNewRelease && (
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
              <h3 className="text-base font-semibold text-text-main mb-4">Create New Release</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Release Name</label>
                  <input
                    type="text"
                    value={releaseName}
                    onChange={(e) => setReleaseName(e.target.value)}
                    placeholder={`Release v${releases.length + 1}.0`}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button 
                    onClick={() => setShowNewRelease(false)}
                    className="px-4 py-2 text-sm text-text-muted hover:bg-bg rounded-lg"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCreateRelease}
                    disabled={createRelease.isPending}
                    className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {createRelease.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Release
                  </button>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : releases.length === 0 && !showNewRelease ? (
            <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <GitMerge className="w-6 h-6 text-accent" />
              </div>
              <h2 className="text-base font-semibold text-text-main">No releases yet</h2>
              <p className="text-sm text-text-muted mt-1 max-w-sm">Releases allow you to package flows, connections, and tables into a versioned deployment.</p>
              <button 
                onClick={() => setShowNewRelease(true)}
                className="mt-6 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90"
              >
                Create First Release
              </button>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bg border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-text-muted">Version / Name</th>
                    <th className="text-left px-4 py-3 font-medium text-text-muted">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-text-muted">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {releases.map((release) => (
                    <tr key={release.id} className="hover:bg-bg/50">
                      <td className="px-4 py-3 font-medium text-text-main flex items-center gap-2">
                        <Play className="w-3.5 h-3.5 text-accent" />
                        {release.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20">
                          {release.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-text-muted">
                        {new Date(release.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-400">Environment Management</h3>
              <p className="text-xs text-blue-400/80 mt-1">Enable environments in Project Settings to connect a Git repository. This will allow you to push and pull changes between different workspaces or self-hosted instances.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
