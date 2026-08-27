/**
 * Email Templates Suite — Email Marketing Module
 *
 * Full layout and design matching the Campaigns section 1-to-1:
 * HeaderPortal integration, frosted glass backdrop, permanent bordered table headers,
 * theme filter pills, and modern modal composer.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, extractApiError } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import {
  FileText, Plus, Trash2, Loader2, X, Edit3, Send, Sparkles,
  Eye, AlertCircle, Search, ChevronRight, Check, ChevronDown,
  LayoutGrid, List as ListIcon
} from 'lucide-react';

const STARTER_TEMPLATES = [
  {
    id: 'starter-welcome',
    name: '👋 Welcome & Onboarding',
    subject: 'Welcome to our platform, {{first_name}}! Here is your quick start guide',
    category: 'Onboarding',
    description: 'Warm greeting email with getting started steps and helpful resource links.',
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb;">
  <h1 style="color: #4f46e5; font-size: 24px; font-weight: bold; margin-bottom: 16px;">Welcome aboard, {{first_name}}! 🎉</h1>
  <p style="color: #374151; font-size: 16px; line-height: 1.6;">We are thrilled to have you with us. Our mission is to help you grow your business effortlessly with powerful automated tools.</p>
  
  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 24px 0;">
    <h3 style="margin-top: 0; color: #1f2937;">3 Quick Steps to Get Started:</h3>
    <ol style="color: #4b5563; padding-left: 20px; line-height: 1.8;">
      <li>Complete your user profile details</li>
      <li>Connect your integrations & contacts</li>
      <li>Launch your first automated campaign</li>
    </ol>
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="#" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Go to Dashboard &rarr;</a>
  </div>

  <p style="color: #6b7280; font-size: 14px;">If you have any questions, reply directly to this email — our team is here for you.</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin-top: 32px;" />
  <p style="color: #9ca3af; font-size: 12px; text-align: center;">Sent via Stone AIO</p>
</div>`,
  },
  {
    id: 'starter-promo',
    name: '🎉 Special Discount Offer',
    subject: 'Special offer inside: Save 25% on your next order, {{first_name}}!',
    category: 'Promotional',
    description: 'High-converting sales email with promotional coupon badge and CTA.',
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #ffffff; padding: 24px; border-radius: 10px; text-align: center; margin-bottom: 24px;">
    <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; text-transform: uppercase;">Exclusive VIP Offer</span>
    <h1 style="font-size: 28px; margin: 12px 0 6px 0;">Get 25% Off Everything</h1>
    <p style="margin: 0; opacity: 0.9;">Limited time offer for {{first_name}}</p>
  </div>

  <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi {{first_name}}, as one of our valued members, we want to give you an exclusive discount on your next service upgrade.</p>
  
  <div style="border: 2px dashed #6366f1; background-color: #f5f3ff; text-align: center; padding: 20px; border-radius: 10px; margin: 24px 0;">
    <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 6px 0;">Your Promo Code</p>
    <span style="font-size: 26px; font-weight: bold; color: #4f46e5; letter-spacing: 2px;">SAVE25</span>
  </div>

  <div style="text-align: center; margin: 32px 0;">
    <a href="#" style="background-color: #4f46e5; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Claim 25% Discount Now &rarr;</a>
  </div>
</div>`,
  },
  {
    id: 'starter-announcement',
    name: '🚀 Product Launch / Announcement',
    subject: 'Introducing our newest feature update for {{first_name}}',
    category: 'Product',
    description: 'Clean announcement design with hero highlight and key feature list.',
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb;">
  <span style="color: #4f46e5; font-weight: bold; font-size: 14px; text-transform: uppercase;">Product Update</span>
  <h1 style="color: #111827; font-size: 26px; margin: 8px 0 16px 0;">Big News: Smarter Campaigns Are Here 🚀</h1>
  <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Hi {{first_name}}, we just released our newest update designed to help you organize contacts and send personalized campaigns faster than ever.</p>

  <ul style="color: #374151; font-size: 15px; line-height: 1.8; padding-left: 20px;">
    <li><strong>Live Smart List Syncing</strong> — Filter contacts dynamically by tags</li>
    <li><strong>Instant & Scheduled Sending</strong> — Deliver now or pick exact timing</li>
    <li><strong>Personalization Tags</strong> — Automatically customize subject lines</li>
  </ul>

  <div style="text-align: center; margin: 32px 0;">
    <a href="#" style="background-color: #111827; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Explore What's New &rarr;</a>
  </div>
</div>`,
  },
];

export default function TemplatesList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CUSTOM' | 'STARTERS'>('ALL');
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const extractApiError = (err: any) => err?.response?.data?.error || err?.message || 'An error occurred';

  // Fetch custom templates from database
  const { data: dbTemplates = [], isLoading, error } = useQuery({
    queryKey: ['email-marketing', 'templates'],
    queryFn: () => apiClient.get('/email-marketing/templates').then(r => r.data),
    staleTime: 10_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/email-marketing/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'templates'] });
      toast('success', 'Template Deleted', 'The template has been removed.');
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const payload = {
        name: templateData.name || 'Untitled Template',
        blockJson: {
          subject: templateData.subject || '',
          html: templateData.html || '',
        },
      };

      if (templateData.id && !templateData.id.startsWith('starter-')) {
        return apiClient.patch(`/email-marketing/templates/${templateData.id}`, payload).then(r => r.data);
      }
      return apiClient.post('/email-marketing/templates', payload).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'templates'] });
      toast('success', 'Template Saved', 'Template saved successfully.');
      setEditingTemplate(null);
    },
    onError: (err: any) => {
      setErrorMsg(extractApiError(err));
    },
  });

  const handleUseTemplate = async (template: any) => {
    try {
      let templateId = template.id;
      if (template.id.startsWith('starter-')) {
        const saved = await saveTemplateMutation.mutateAsync({
          name: template.name.replace(/^[^\w]+/, '').trim(),
          subject: template.subject,
          html: template.html,
        });
        templateId = saved.id || saved.templateId;
      }
      navigate(`/email-marketing/campaigns/new?templateId=${templateId}`);
    } catch (err: any) {
      toast('error', 'Failed to use template', extractApiError(err));
    }
  };

  const openNewTemplateModal = () => {
    setEditingTemplate({
      id: '',
      name: 'New Custom Template',
      subject: 'Special Message for {{first_name}}',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">\n  <h2>Hello {{first_name}},</h2>\n  <p>Write your email content here…</p>\n</div>`,
    });
    setEditorTab('edit');
    setErrorMsg('');
  };

  const openEditModal = (t: any) => {
    const bj = t.blockJson as any;
    let htmlContent = '';
    let subjectLine = '';

    if (typeof bj === 'string') {
      htmlContent = bj;
    } else if (bj?.html) {
      htmlContent = bj.html;
      subjectLine = bj.subject || '';
    } else if (bj?.body) {
      htmlContent = bj.body;
    }

    setEditingTemplate({
      id: t.id,
      name: t.name,
      subject: subjectLine || t.subject || '',
      html: htmlContent || t.html || '',
    });
    setEditorTab('edit');
    setErrorMsg('');
  };

  // Unified template rows
  const allTemplates = useMemo(() => {
    const customRows = dbTemplates.map((t: any) => ({
      id: t.id,
      name: t.name,
      subject: (t.blockJson as any)?.subject || '',
      category: 'Workspace',
      isStarter: false,
      updatedAt: t.updatedAt,
      raw: t,
    }));

    const starterRows = STARTER_TEMPLATES.map((st: any) => ({
      id: st.id,
      name: st.name,
      subject: st.subject,
      category: st.category || 'Gallery',
      isStarter: true,
      updatedAt: null,
      raw: st,
    }));

    return [...customRows, ...starterRows];
  }, [dbTemplates]);

  // Filtered rows by search & tab pill
  const processedTemplates = useMemo(() => {
    return allTemplates.filter(item => {
      if (activeFilter === 'CUSTOM' && item.isStarter) return false;
      if (activeFilter === 'STARTERS' && !item.isStarter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.subject.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allTemplates, activeFilter, searchQuery]);

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden z-0 bg-bg text-text-main min-h-screen">
      {/* Full-tab frosted glass overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* Header Portal for Top App Bar Controls */}
      <HeaderPortal>
        <div className="flex items-center gap-3">
          <div className="relative shadow-sm rounded-full flex items-center mr-2">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search Templates..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-[200px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>
          
          <button 
            onClick={openNewTemplateModal} 
            className="btn-secondary"
          >
            <Plus className="w-4 h-4" /> Create Template
          </button>
        </div>
      </HeaderPortal>

      {/* Error state */}
      {error && (
        <div className="mx-8 mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3 text-[13px]">
          <AlertCircle className="w-5 h-5 shrink-0" />
          Failed to load templates. Please refresh or try again.
        </div>
      )}

      {/* Filter Pills & View Mode Switcher */}
      {!isLoading && !error && (
        <div className="mx-8 mt-5 mb-1 space-y-4 relative z-10">
          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { key: 'ALL', label: 'All Templates', count: allTemplates.length },
                { key: 'STARTERS', label: 'Starter Kits', count: STARTER_TEMPLATES.length },
                { key: 'CUSTOM', label: 'Custom Designs', count: dbTemplates.length },
              ].map(pill => (
                <button
                  key={pill.key}
                  onClick={() => setActiveFilter(pill.key as any)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeFilter === pill.key
                      ? 'bg-primary text-white shadow-interactive font-bold'
                      : 'bg-surface/60 border border-border/50 text-text-muted hover:text-text-main hover:bg-surface-hover'
                  }`}
                >
                  <span>{pill.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    activeFilter === pill.key ? 'bg-white/20 text-white' : 'bg-surface border border-border/60 text-text-muted'
                  }`}>
                    {pill.count}
                  </span>
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-surface/80 border border-border/60 rounded-lg p-0.5 shadow-sm">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'grid' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                  }`}
                  title="Card Gallery View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'table' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                  }`}
                  title="Table List View"
                >
                  <ListIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Container */}
      {!isLoading && !error && (
        <div className="flex-1 overflow-auto mx-8 mt-3 mb-6 relative z-10">
          {viewMode === 'grid' ? (
            /* ── GRID CARD GALLERY ── */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {processedTemplates.map(tpl => (
                <div
                  key={tpl.id}
                  className="bg-surface/50 border border-border/60 rounded-2xl p-5 backdrop-blur-md shadow-card hover:border-primary/50 transition-all group flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-primary bg-primary/15 border border-primary/25 shrink-0 shadow-sm">
                          {tpl.isStarter ? <Sparkles className="w-4 h-4 text-amber-400" /> : <FileText className="w-4 h-4 text-primary" />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-text-main truncate group-hover:text-primary transition-colors">
                            {tpl.name}
                          </h4>
                          <span className="text-[11px] text-text-muted font-medium block">
                            {tpl.category}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                        tpl.isStarter
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                          : 'text-primary bg-primary/10 border-primary/25'
                      }`}>
                        {tpl.isStarter ? 'Starter' : 'Custom'}
                      </span>
                    </div>

                    {/* Subject Line Preview */}
                    <div className="bg-bg/60 border border-border/40 rounded-xl p-3 mb-4 text-xs">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                        Default Subject
                      </span>
                      <p className="text-text-main font-medium truncate">
                        {tpl.subject || '(No default subject)'}
                      </p>
                    </div>

                    {/* Miniature Body Snapshot */}
                    {tpl.description && (
                      <p className="text-xs text-text-muted leading-relaxed line-clamp-2 mb-4">
                        {tpl.description}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/40">
                    <button
                      onClick={() => openEditModal(tpl.raw)}
                      className="flex-1 py-1.5 px-3 rounded-lg border border-border/60 bg-surface-hover hover:bg-surface text-text-main text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Edit3 className="w-3 h-3" /> Customize
                    </button>

                    <button
                      onClick={() => handleUseTemplate(tpl.raw)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-interactive"
                    >
                      <Send className="w-3 h-3" /> Use in Campaign
                    </button>

                    {!tpl.isStarter && (
                      <button
                        onClick={() => deleteMutation.mutate(tpl.id)}
                        className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── TABLE VIEW ── */
            <div className="rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 flex flex-col">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
                  <tr>
                    <th className="w-12 p-3 text-center">
                      <span className="w-4 h-4 border border-border bg-bg rounded flex items-center justify-center text-text-muted text-[10px] font-bold">
                        #
                      </span>
                    </th>
                    <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                      Template name
                    </th>
                    <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                      Default subject line
                    </th>
                    <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                      Category / Source
                    </th>
                    <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                      Last updated
                    </th>
                    <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {processedTemplates.map((tpl, idx) => (
                    <tr 
                      key={tpl.id}
                      className="border-b border-border/50 transition-colors cursor-pointer bg-black/5 hover:bg-black/10"
                      onClick={() => openEditModal(tpl.raw)}
                    >
                      <td className="p-3 text-center text-[12px] font-medium text-text-muted opacity-60">
                        {idx + 1}
                      </td>

                      {/* Template Name */}
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-primary shadow-sm shrink-0 bg-primary/20 border border-primary/30">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[13px] font-medium transition-colors text-text-main truncate hover:underline">
                            {tpl.name}
                          </span>
                        </div>
                      </td>

                      {/* Default Subject Line */}
                      <td className="p-3">
                        <span className="text-[13px] font-medium text-text-muted truncate max-w-[280px] block">
                          {tpl.subject || '(No default subject)'}
                        </span>
                      </td>

                      {/* Category / Source Badge */}
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-sm ${
                          tpl.isStarter 
                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' 
                            : 'text-primary bg-primary/10 border-primary/20'
                        }`}>
                          {tpl.isStarter ? <Sparkles className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                          {tpl.category}
                        </span>
                      </td>

                      {/* Last Updated */}
                      <td className="p-3 text-[11px] font-medium whitespace-nowrap text-text-muted opacity-60">
                        {tpl.updatedAt ? new Date(tpl.updatedAt).toLocaleDateString() : 'Starter Kit'}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => openEditModal(tpl.raw)}
                            className="flex items-center gap-1 px-2.5 py-1 border border-border bg-surface-hover hover:bg-surface text-text-main rounded-[6px] text-[11px] font-semibold transition-all shadow-sm"
                          >
                            <Edit3 className="w-3 h-3" /> Customize
                          </button>

                          <button
                            onClick={() => handleUseTemplate(tpl.raw)}
                            className="flex items-center gap-1 px-3 py-1 bg-primary hover:bg-primary-hover text-white rounded-[6px] text-[11px] font-semibold transition-all shadow-sm"
                          >
                            <Send className="w-3 h-3" /> Use Template
                          </button>

                          {!tpl.isStarter && (
                            <button
                              onClick={() => deleteMutation.mutate(tpl.id)}
                              className="p-1 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-[6px] transition-colors"
                              title="Delete Template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer Controls & Paginator */}
      <div 
        className="pr-8 pl-8 py-4 border-t flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]"
        style={{ 
          background: 'var(--sidebar-bg)', 
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text-main)',
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 bg-surface-hover/50 p-1 rounded-lg border border-border/50">
            {[
              { id: 'ALL', label: 'All Templates' },
              { id: 'CUSTOM', label: `Workspace (${dbTemplates.length})` },
              { id: 'STARTERS', label: `Starter Gallery (${STARTER_TEMPLATES.length})` },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setActiveFilter(st.id as any)}
                className={`px-3 py-1 rounded-[6px] text-[11px] font-bold transition-all ${
                  activeFilter === st.id ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Counter & Pagination */}
        <div className="flex items-center gap-5">
          <span className="text-[13px] font-medium text-text-muted">
            {processedTemplates.length} Templates
          </span>
          <div className="flex items-center gap-3 font-semibold">
            <button className="text-[13px] font-medium text-text-muted hover:text-white transition-colors">Prev</button>
            <button className="px-3 py-0.5 rounded-[6px] shadow-sm bg-primary text-white font-bold text-[12px]">1</button>
            <button className="text-[13px] font-medium text-text-muted hover:text-white transition-colors">Next</button>
          </div>
        </div>
      </div>

      {/* Modern Template Customization Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border/60 rounded-2xl w-full max-w-3xl h-[85vh] flex flex-col shadow-luxury overflow-hidden relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-surface-hover/80 shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <input
                  value={editingTemplate.name}
                  onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  placeholder="Template Name"
                  className="bg-transparent font-bold text-text-main text-base border-b border-transparent hover:border-border/60 focus:border-primary outline-none px-1 py-0.5"
                />
              </div>

              <div className="flex items-center gap-3">
                {/* Editor View Switcher */}
                <div className="flex items-center gap-1 bg-surface-hover p-1 rounded-xl border border-border/40 text-xs shadow-inner">
                  <button
                    onClick={() => setEditorTab('edit')}
                    className={`px-3 py-1 rounded-[6px] font-bold text-[12px] transition-all ${
                      editorTab === 'edit' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    Edit HTML
                  </button>
                  <button
                    onClick={() => setEditorTab('preview')}
                    className={`px-3 py-1 rounded-[6px] font-bold text-[12px] transition-all ${
                      editorTab === 'preview' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    Live Preview
                  </button>
                </div>

                <button
                  onClick={() => setEditingTemplate(null)}
                  className="text-text-muted hover:text-text-main p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2.5 text-xs font-medium text-red-400 flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden p-6 flex flex-col space-y-4">
              {/* Subject Line */}
              <div>
                <label className="text-[12px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                  Default Email Subject Line
                </label>
                <input
                  value={editingTemplate.subject || ''}
                  onChange={e => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  placeholder="e.g. Special offer for {{first_name}}"
                  className="w-full bg-surface border border-border/60 rounded-xl px-4 py-2.5 text-[13px] text-text-main font-medium focus:outline-none focus:border-primary transition-all hover:border-border"
                />
              </div>

              {/* Personalization shortcut bar */}
              {editorTab === 'edit' && (
                <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted">
                  <span className="font-semibold text-text-muted">Insert tag:</span>
                  {['{{first_name}}', '{{last_name}}', '{{email}}'].map(tag => (
                    <button
                      key={tag}
                      onClick={() => setEditingTemplate({ ...editingTemplate, html: (editingTemplate.html || '') + ' ' + tag })}
                      className="px-3 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all shadow-sm"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              )}

              {/* Main Content Pane */}
              <div className="flex-1 bg-surface/40 border border-border/50 rounded-xl overflow-hidden flex flex-col shadow-card">
                {editorTab === 'edit' ? (
                  <textarea
                    value={editingTemplate.html || ''}
                    onChange={e => setEditingTemplate({ ...editingTemplate, html: e.target.value })}
                    placeholder="Write HTML or plain text template body here…"
                    className="w-full flex-1 bg-surface text-text-main font-mono text-[13px] p-4 focus:outline-none resize-none leading-relaxed shadow-inner"
                  />
                ) : (
                  <iframe
                    srcDoc={editingTemplate.html || '<p style="color:#6b7280;padding:20px;">No HTML content yet</p>'}
                    title="Template Live Preview"
                    className="w-full flex-1 bg-white border-0"
                  />
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-surface-hover/80 shrink-0">
              <button
                onClick={() => setEditingTemplate(null)}
                className="btn-secondary"
              >
                Cancel
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => saveTemplateMutation.mutate(editingTemplate)}
                  disabled={saveTemplateMutation.isPending}
                  className="btn-secondary flex items-center gap-2"
                >
                  {saveTemplateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save Template
                </button>

                <button
                  onClick={() => handleUseTemplate(editingTemplate)}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-bold transition-all shadow-interactive flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" /> Use in Campaign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
