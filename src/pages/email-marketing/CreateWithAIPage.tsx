import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ProfileForm, { profileToFormValues, type ProfileFormValues } from '../../components/email-marketing/ProfileForm';
import InterviewFlow from '../../components/email-marketing/InterviewFlow';
import { getProfile, saveProfile } from '../../lib/createWithAiApi';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import { extractApiError } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';

export default function CreateWithAIPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
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
      <div className="flex flex-col h-full w-full items-center justify-center relative bg-[#1E1E1E]">
        <div className="flex items-center gap-3 text-[#8A8A8D]">
          <div className="w-5 h-5 border-2 border-[#52677D] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Initializing AI Campaign Studio…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center relative bg-[#1E1E1E] p-6">
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

  // When no profile exists yet: Utilize the whole entire page with full-page expansive layout
  if (!profile) {
    return (
      <div className="flex flex-col h-full w-full relative overflow-y-auto z-0 bg-[#1E1E1E]">
        <ProfileForm initial={profileToFormValues(null)} onSave={save} saving={saving} serverErrors={serverErrors} />
      </div>
    );
  }

  // Profile exists: step-by-step AI flow on the assistant-thread background
  // (#1E1E1E). Slim toolbar: back link + title only. The step indicator
  // ("Step 1 of 3 — …") lives in InterviewFlow, which owns the step state.
  // Profile editing lives at /email-marketing/profile (sidebar now).
  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden z-0 bg-[#1E1E1E]">
      {/* Slim toolbar */}
      <div className="px-6 h-[56px] border-b border-[#2C2C2C] bg-[#1E1E1E] flex items-center gap-4 shrink-0 z-10">
        <Link
          to="/email-marketing/campaigns"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#242426] hover:bg-[#2D2D2E] border border-[#343437] text-xs font-semibold text-[#8A8A8D] hover:text-[#ECECEC] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Campaigns</span>
        </Link>

        <div className="h-4 w-[1px] bg-[#343437]" />

        <h2 className="text-sm font-bold text-[#ECECEC] tracking-tight">Create with AI</h2>
      </div>

      {/* Step flow body */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <InterviewFlow
          profile={profile}
          onSaveProfile={save}
          saving={saving}
          serverErrors={serverErrors}
        />
      </div>
    </div>
  );
}
