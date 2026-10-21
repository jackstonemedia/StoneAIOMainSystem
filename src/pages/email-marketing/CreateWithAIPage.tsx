/**
 * Create with AI — flow shell (Milestone 1).
 * Route: /email-marketing/create-with-ai
 *
 * M1 state: no profile -> first-time setup form; profile -> confirm card with
 * Edit (side panel). Continue leads to the interview, which lands in Milestone 2
 * — the placeholder below is replaced then, not papered over now.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ProfileForm, { profileToFormValues, type ProfileFormValues } from '../../components/email-marketing/ProfileForm';
import ProfileConfirmCard from '../../components/email-marketing/ProfileConfirmCard';
import ProfileSidePanel from '../../components/email-marketing/ProfileSidePanel';
import InterviewFlow from '../../components/email-marketing/InterviewFlow';
import { getProfile, saveProfile } from '../../lib/createWithAiApi';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import { extractApiError } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';

export default function CreateWithAIPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [panelOpen, setPanelOpen] = useState(false);
  const [continued, setContinued] = useState(false);
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

  if (isLoading) return <div className="p-6 text-text-muted">Loading…</div>;
  if (error) return <div className="p-6 text-red-400">Failed to load: {extractApiError(error)}</div>;

  const profile = data?.profile || null;

  return (
    <div className="mx-8 mt-5 mb-8 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-text-main">{createWithAiCopy.flow.title}</h2>
        <p className="text-sm text-text-muted mt-1">{createWithAiCopy.profile.subtitle}</p>
      </div>

      {!profile ? (
        <ProfileForm initial={profileToFormValues(null)} onSave={save} saving={saving} serverErrors={serverErrors} />
      ) : (
        <>
          <ProfileConfirmCard
            profile={profile}
            missingRequired={data?.missingRequired || []}
            onContinue={() => setContinued(true)}
            onEdit={() => setPanelOpen(true)}
          />
          <p className="text-sm">
            <Link to="/email-marketing/profile" className="text-primary hover:underline">
              {createWithAiCopy.profile.samples.link}
            </Link>
            <span className="text-text-muted"> · {data?.samples?.length || 0} sample(s) saved</span>
          </p>
        </>
      )}

      {continued && profile && (
        <InterviewFlow profile={profile} onSaveProfile={save} saving={saving} serverErrors={serverErrors} />
      )}

      {profile && (
        <ProfileSidePanel
          open={panelOpen}
          profile={profile}
          onClose={() => setPanelOpen(false)}
          onSave={save}
          saving={saving}
          serverErrors={serverErrors}
          inProgress={false}
        />
      )}
    </div>
  );
}
