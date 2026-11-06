import React, { useState } from 'react';
import {
  X, Copy, Check, Download, Edit3, Eye, Clock, RotateCcw,
  Sparkles, Send, FileText, Table, Mail, Layers, ExternalLink
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { ArtifactItem } from '../../pages/assistant/AssistantArtifactsPage';

interface ArtifactSidePanelProps {
  artifact: ArtifactItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateArtifact: (updated: ArtifactItem) => void;
  onAskChanges: (request: string) => void;
}

export function ArtifactSidePanel({
  artifact,
  isOpen,
  onClose,
  onUpdateArtifact,
  onAskChanges,
}: ArtifactSidePanelProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'edit' | 'versions'>('preview');
  const [editContent, setEditContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [changePrompt, setChangePrompt] = useState('');

  // Sync draft content when artifact changes
  React.useEffect(() => {
    if (artifact) {
      setEditContent(artifact.content);
    }
  }, [artifact]);

  if (!isOpen || !artifact) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveEdit = () => {
    const newVersionNum = (artifact.version || 1) + 1;
    const newVersionEntry = {
      version: newVersionNum,
      content: editContent,
      createdAt: new Date().toISOString(),
    };
    const updated: ArtifactItem = {
      ...artifact,
      content: editContent,
      version: newVersionNum,
      versions: [...(artifact.versions || []), newVersionEntry],
      updatedAt: new Date().toISOString(),
    };
    onUpdateArtifact(updated);
    setActiveTab('preview');
  };

  const handleRestoreVersion = (verContent: string, verNum: number) => {
    const updated: ArtifactItem = {
      ...artifact,
      content: verContent,
      version: verNum,
      updatedAt: new Date().toISOString(),
    };
    onUpdateArtifact(updated);
    setEditContent(verContent);
    setActiveTab('preview');
  };

  const handleSendPrompt = (promptText?: string) => {
    const text = promptText || changePrompt;
    if (!text.trim()) return;
    onAskChanges(`Please update artifact "${artifact.title}": ${text.trim()}`);
    setChangePrompt('');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'table':
        return <Table className="w-3.5 h-3.5 text-blue-400" />;
      case 'email':
        return <Mail className="w-3.5 h-3.5 text-emerald-400" />;
      case 'proposal':
        return <FileText className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-primary" />;
    }
  };

  return (
    <aside className="w-full md:w-[480px] lg:w-[540px] xl:w-[600px] h-full flex flex-col bg-[#1A1A1B] border-l border-[#2C2C2C] text-text-main shrink-0 animate-in slide-in-from-right-4 duration-200 select-none font-inter overflow-hidden">
      {/* Top Header */}
      <div className="p-3.5 border-b border-[#2C2C2C] flex items-center justify-between gap-3 bg-[#161617]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-[#252527] border border-[#343437]">
            {getTypeIcon(artifact.type)}
          </div>
          <div className="min-w-0">
            <h2 className="text-[13.5px] font-semibold text-white truncate leading-tight">
              {artifact.title}
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-[#8A8A8D] mt-0.5">
              <span className="capitalize">{artifact.type}</span>
              <span>•</span>
              <span className="font-mono bg-[#2A2A2C] px-1.5 py-0.2 rounded text-[10px] text-text-muted">
                v{artifact.version || 1}
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Tab Selector */}
          <div className="flex items-center bg-[#242426] p-0.5 rounded-lg border border-[#323235] mr-1">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              aria-label="Preview"
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                activeTab === 'preview' ? 'bg-[#333336] text-white shadow-xs' : 'text-[#8A8A8D] hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              aria-label="Edit"
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                activeTab === 'edit' ? 'bg-[#333336] text-white shadow-xs' : 'text-[#8A8A8D] hover:text-white'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('versions')}
              aria-label="Versions"
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                activeTab === 'versions' ? 'bg-[#333336] text-white shadow-xs' : 'text-[#8A8A8D] hover:text-white'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>History</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy artifact content"
            title="Copy content"
            className="p-1.5 rounded-lg hover:bg-[#2A2A2D] text-[#8A8A8D] hover:text-white transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            aria-label="Download markdown"
            title="Download markdown"
            className="p-1.5 rounded-lg hover:bg-[#2A2A2D] text-[#8A8A8D] hover:text-white transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close artifact panel"
            className="p-1.5 rounded-lg hover:bg-[#2A2A2D] text-[#8A8A8D] hover:text-white transition-colors cursor-pointer ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Viewport */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 select-text custom-scrollbar bg-[#171718]">
        {activeTab === 'preview' && (
          <div className="max-w-none text-white">
            <MarkdownRenderer content={artifact.content} />
          </div>
        )}

        {activeTab === 'edit' && (
          <div className="flex flex-col h-full space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              aria-label="Edit artifact content"
              rows={18}
              className="w-full flex-1 p-3.5 text-[13px] font-mono leading-relaxed rounded-xl bg-[#121213] border border-[#2E2E31] text-text-main outline-none focus:border-primary resize-none custom-scrollbar"
            />
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[#7A7A7D]">
                Editing v{artifact.version || 1} • Saving will increment version
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditContent(artifact.content);
                    setActiveTab('preview');
                  }}
                  className="px-3 py-1.5 text-xs text-[#8A8A8D] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:opacity-90 transition cursor-pointer shadow-xs"
                >
                  Save New Version
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#8A8A8D] uppercase tracking-wider">
              Version History
            </h3>
            {(!artifact.versions || artifact.versions.length === 0) ? (
              <div className="p-4 rounded-xl border border-[#2E2E31] bg-[#1E1E20] text-xs text-[#8A8A8D] text-center">
                This is initial version v1. Edits will appear here with history and rollback support.
              </div>
            ) : (
              artifact.versions.map((v) => (
                <div
                  key={v.version}
                  className={`p-3 rounded-xl border transition-all ${
                    v.version === artifact.version
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-[#2E2E31] bg-[#1E1E20] hover:border-[#3E3E42]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-white">
                        v{v.version}
                      </span>
                      {v.version === artifact.version && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/20 text-primary font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#8A8A8D]">
                      {new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-[#A0A0A5] line-clamp-2 font-mono">
                    {v.content.slice(0, 140)}...
                  </p>
                  {v.version !== artifact.version && (
                    <div className="mt-2.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRestoreVersion(v.content, v.version)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#29292D] hover:bg-[#343439] text-[11px] text-white transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore this version</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer: Ask AI for Changes */}
      <div className="p-3 border-t border-[#2C2C2C] bg-[#161617] space-y-2 select-none">
        {/* Quick Revision Prompts */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => handleSendPrompt('Make this more concise and executive-focused')}
            className="px-2 py-1 rounded-full text-[10.5px] bg-[#242426] hover:bg-[#2F2F32] text-[#8A8A8D] hover:text-white transition-colors whitespace-nowrap border border-[#323235] cursor-pointer"
          >
            Shorter & Executive
          </button>
          <button
            type="button"
            onClick={() => handleSendPrompt('Add a detailed pricing/metrics table')}
            className="px-2 py-1 rounded-full text-[10.5px] bg-[#242426] hover:bg-[#2F2F32] text-[#8A8A8D] hover:text-white transition-colors whitespace-nowrap border border-[#323235] cursor-pointer"
          >
            Add Metrics Table
          </button>
          <button
            type="button"
            onClick={() => handleSendPrompt('Improve formatting and strengthen key points')}
            className="px-2 py-1 rounded-full text-[10.5px] bg-[#242426] hover:bg-[#2F2F32] text-[#8A8A8D] hover:text-white transition-colors whitespace-nowrap border border-[#323235] cursor-pointer"
          >
            Polish Tone
          </button>
        </div>

        {/* Prompt Input Box */}
        <div className="relative flex items-center">
          <input
            type="text"
            value={changePrompt}
            onChange={(e) => setChangePrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendPrompt();
            }}
            placeholder="Ask AI to revise this artifact..."
            aria-label="Ask AI to revise this artifact"
            className="w-full pl-3 pr-9 py-2 rounded-xl text-xs bg-[#242426] border border-[#323235] text-white placeholder-[#8A8A8D] outline-none focus:border-primary transition-colors"
          />
          <button
            type="button"
            onClick={() => handleSendPrompt()}
            disabled={!changePrompt.trim()}
            aria-label="Submit revision request"
            className={`absolute right-1.5 p-1 rounded-lg transition-colors cursor-pointer ${
              changePrompt.trim()
                ? 'bg-primary text-white hover:opacity-90'
                : 'text-[#606063] cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
