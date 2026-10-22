import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Sparkles, Building2, User, ShieldCheck, 
  ExternalLink, FileText, CheckCircle2, AlertTriangle, 
  RotateCcw, SlidersHorizontal
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ProfileForm, { profileToFormValues, type ProfileFormValues } from '../../components/email-marketing/ProfileForm';
import ProfileSidePanel from '../../components/email-marketing/ProfileSidePanel';
import InterviewFlow from '../../components/email-marketing/InterviewFlow';
import { getProfile, saveProfile } from '../../lib/createWithAiApi';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import { extractApiError } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';

export default function CreateWithAIPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['create-with-ai', 'profile'],
    queryFn: getProfile,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['create-with-ai', 'profile'] });

  const save = async (values: ProfileFormValues) => {
    setSaving(true);
    setServerErrors({});
    try {
      await saveProfile(values);
      toast('success', createWithAiCopy.profile.buttons.saved);
      refresh();
      setPanelOpen(false);
    } catch (err) {
      const e = err as { response?: { data?: { fields?: Record<string, string> } } };
      const fields = e?.response?.data?.fields;
      if (fields) setServerErrors(fields);
      toast('error', 'Could not save profile', extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center relative bg-bg">
        <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />
        <div className="flex items-center gap-3 text-text-muted">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Initializing AI Campaign Studio…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center relative bg-bg p-6">
        <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />
        <div className="p-6 rounded-[16px] bg-red-500/10 border border-red-500/20 max-w-md text-center space-y-3">
          <p className="text-sm text-red-400 font-semibold">Failed to load Business Profile</p>
          <p className="text-xs text-text-muted">{extractApiError(error)}</p>
          <button
            onClick={() => refresh()}
            className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border rounded-lg text-xs font-semibold text-text-main"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const profile = data?.profile || null;
  const missingRequired = data?.missingRequired || [];

  // When no profile exists yet: Utilize the whole entire page with full-page expansive layout
  if (!profile) {
    return (
      <div className="flex flex-col h-full w-full relative overflow-y-auto z-0 bg-bg">
        <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />
        <ProfileForm initial={profileToFormValues(null)} onSave={save} saving={saving} serverErrors={serverErrors} />
      </div>
    );
  }

  // Profile exists: Full-height Two-Pane AI Campaign Studio
  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden z-0 bg-bg">
      {/* Full-screen frosted glass overlay matching CRM Contacts aesthetic */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* Top Studio Action Toolbar */}
      <div className="px-6 h-[64px] border-b border-border/50 bg-surface/40 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            to="/email-marketing/campaigns"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/70 hover:bg-surface border border-border/60 text-xs font-semibold text-text-muted hover:text-text-main transition-colors shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Campaigns</span>
          </Link>

          <div className="h-4 w-[1px] bg-border/60" />

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-extrabold text-text-main tracking-tight">
              AI Campaign Studio
            </h2>
          </div>
        </div>

        {/* Center: Active Profile Pill & Quick Edit */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => setPanelOpen(true)}
            className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface/60 hover:bg-surface border border-border/60 hover:border-primary/40 text-xs transition-all cursor-pointer shadow-sm"
            title="Click to view or edit Business Profile"
          >
            <Building2 className="w-3.5 h-3.5 text-primary" />
            <span className="font-bold text-text-main truncate max-w-[160px]">{profile.businessName}</span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted truncate max-w-[140px]">{profile.senderName}</span>
            <span className="text-[10px] uppercase font-bold text-primary ml-1 px-1.5 py-0.2 bg-primary/10 rounded">Edit</span>
          </div>

          {missingRequired.length > 0 && (
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Incomplete Profile ({missingRequired.length})</span>
            </button>
          )}
        </div>

        {/* Right: Samples link & Status indicator */}
        <div className="flex items-center gap-3">
          <Link
            to="/email-marketing/profile"
            className="hidden sm:flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors font-medium"
            title="Manage your voice samples and email guidelines"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{data?.samples?.length || 0} Voice Sample(s)</span>
          </Link>

          <div className="h-4 w-[1px] bg-border/60 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Autosaved</span>
          </div>
        </div>
      </div>

      {/* Main Two-Pane Studio Body */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <InterviewFlow
          profile={profile}
          onSaveProfile={save}
          saving={saving}
          serverErrors={serverErrors}
        />
      </div>

      {/* Slide-over Profile Side Panel */}
      <ProfileSidePanel
        open={panelOpen}
        profile={profile}
        onClose={() => setPanelOpen(false)}
        onSave={save}
        saving={saving}
        serverErrors={serverErrors}
        inProgress={false}
      />
    </div>
  );
}
