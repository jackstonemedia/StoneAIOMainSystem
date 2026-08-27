import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, Plus, Tag as TagIcon, Edit2, Trash2, GitMerge,
  Check, X, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { opportunitiesApi } from '../../../lib/api/opportunities';
import { useToast } from '../../../components/ui/Toast';
import type { Tag } from '../../../types/opportunities';

const COLOR_SWATCHES = [
  '#52677D', '#818CF8', '#60A5FA', '#34D399', '#10B981',
  '#FBBF24', '#F59E0B', '#F472B6', '#EC4899', '#A78BFA',
  '#8B5CF6', '#94A3B8', '#F87171', '#EF4444',
];

export default function TagsSettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#52677D');
  const [newTagShared, setNewTagShared] = useState(true);

  // Edit tag state
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#52677D');

  // Merge modal state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [sourceTagId, setSourceTagId] = useState('');
  const [targetTagId, setTargetTagId] = useState('');

  const { data: tags = [], isLoading } = useQuery<Tag[]>({
    queryKey: ['opportunities-tags'],
    queryFn: () => opportunitiesApi.listTags(),
  });

  const createTagMut = useMutation({
    mutationFn: () => opportunitiesApi.createTag({
      name: newTagName.trim(),
      color: newTagColor,
      isShared: newTagShared,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-tags'] });
      setNewTagName('');
      toast('success', 'Tag created');
    },
    onError: (err: any) => toast('error', 'Failed to create tag', err.message),
  });

  const updateTagMut = useMutation({
    mutationFn: () => {
      if (!editingTag) throw new Error();
      return opportunitiesApi.updateTag(editingTag.id, {
        name: editName.trim(),
        color: editColor,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-tags'] });
      setEditingTag(null);
      toast('success', 'Tag updated');
    },
    onError: (err: any) => toast('error', 'Failed to update tag', err.message),
  });

  const deleteTagMut = useMutation({
    mutationFn: (id: string) => opportunitiesApi.deleteTag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-tags'] });
      toast('success', 'Tag removed');
    },
    onError: (err: any) => toast('error', 'Failed to delete tag', err.message),
  });

  const mergeTagsMut = useMutation({
    mutationFn: () => opportunitiesApi.mergeTags(sourceTagId, targetTagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-tags'] });
      setShowMergeModal(false);
      setSourceTagId('');
      setTargetTagId('');
      toast('success', 'Tags merged successfully');
    },
    onError: (err: any) => toast('error', 'Failed to merge tags', err.message),
  });

  const handleOpenEdit = (t: Tag) => {
    setEditingTag(t);
    setEditName(t.name);
    setEditColor(t.color);
  };

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {/* Top Header */}
      <header className="px-8 py-4 border-b border-border bg-surface shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/opportunities"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-[20px] font-bold text-text-main flex items-center gap-2">
              <TagIcon className="w-5 h-5 text-primary" />
              Tag Management
            </h1>
            <p className="text-[12px] text-text-muted mt-0.5">
              Organize and label deals with custom tags, recolor, or merge duplicate tags
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowMergeModal(true)}
          disabled={tags.length < 2}
          className="px-4 py-2 bg-surface-hover hover:bg-surface-hover/80 border border-border text-text-main text-[13px] font-semibold rounded-xl flex items-center gap-2 shadow-xs disabled:opacity-50 transition-all"
        >
          <GitMerge className="w-4 h-4" /> Merge Tags
        </button>
      </header>

      {/* Body Content */}
      <div className="flex-1 overflow-auto p-8 max-w-4xl space-y-6">
        {/* Quick Add Tag Card */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-[14px] font-bold text-text-main">Create New Tag</h3>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Tag name (e.g. VIP, Enterprise, High Margin)..."
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              className="flex-1 min-w-[200px] px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
            />

            {/* Color Swatch Picker */}
            <div className="flex items-center gap-1 p-1 bg-surface-hover/50 border border-border rounded-xl">
              {COLOR_SWATCHES.slice(0, 8).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTagColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${newTagColor === c ? 'scale-125 ring-2 ring-white/50' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs text-text-main cursor-pointer px-2">
              <input
                type="checkbox"
                checked={newTagShared}
                onChange={e => setNewTagShared(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-primary"
              />
              Shared with Contacts
            </label>

            <button
              onClick={() => createTagMut.mutate()}
              disabled={!newTagName.trim() || createTagMut.isPending}
              className="px-5 py-2 bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold rounded-xl disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> Add Tag
            </button>
          </div>
        </div>

        {/* Tags Table */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-text-muted text-sm">Loading tags...</div>
          ) : tags.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">No tags found. Add one above!</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-hover/30 text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">Swatch</th>
                  <th className="py-3 px-4">Tag Name</th>
                  <th className="py-3 px-4">Usage Count</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-[13px] text-text-main">
                {tags.map(t => (
                  <tr key={t.id} className="hover:bg-surface-hover/40 transition-colors">
                    <td className="py-3 px-4 text-center">
                      <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: t.color }} />
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border"
                        style={{
                          backgroundColor: `${t.color}20`,
                          borderColor: `${t.color}40`,
                          color: t.color,
                        }}
                      >
                        {t.name}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-slate-200">{t.usageCount || 0} deals / contacts</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-slate-200">
                        {t.isShared ? 'Shared' : 'Opportunities Only'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(t)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteTagMut.mutate(t.id)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Tag Modal */}
      <AnimatePresence>
        {editingTag && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-[16px] font-bold text-text-main">Edit Tag</h3>
                <button onClick={() => setEditingTag(null)} className="text-text-muted hover:text-text-main">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-muted">Tag Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-muted">Color</label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-surface-hover/30 rounded-xl">
                    {COLOR_SWATCHES.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={`w-6 h-6 rounded-full transition-transform ${editColor === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTag(null)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => updateTagMut.mutate()}
                  disabled={!editName.trim() || updateTagMut.isPending}
                  className="px-5 py-2 bg-primary text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Merge Tags Modal */}
      <AnimatePresence>
        {showMergeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <GitMerge className="w-5 h-5 text-primary" />
                  <h3 className="text-[16px] font-bold text-text-main">Merge Duplicate Tags</h3>
                </div>
                <button onClick={() => setShowMergeModal(false)} className="text-text-muted hover:text-text-main">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-text-muted">
                All records currently labeled with the source tag will be updated to the target tag, and the source tag will be deleted.
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-muted">Source Tag (Will be merged and removed)</label>
                  <select
                    value={sourceTagId}
                    onChange={e => setSourceTagId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main"
                  >
                    <option value="">Select source tag...</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-muted">Target Tag (Will be kept)</label>
                  <select
                    value={targetTagId}
                    onChange={e => setTargetTagId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main"
                  >
                    <option value="">Select destination tag...</option>
                    {tags.filter(t => t.id !== sourceTagId).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => mergeTagsMut.mutate()}
                  disabled={!sourceTagId || !targetTagId || mergeTagsMut.isPending}
                  className="px-5 py-2 bg-primary text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                >
                  Merge Tags
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
