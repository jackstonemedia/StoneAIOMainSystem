/**
 * Business Profile page — full profile management (Milestone 1).
 * Route: /email-marketing/profile
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ProfileForm, { profileToFormValues, type ProfileFormValues } from '../../components/email-marketing/ProfileForm';
import MyBestEmails from '../../components/email-marketing/MyBestEmails';
import { getProfile, saveProfile } from '../../lib/createWithAiApi';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import { extractApiError } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';

export default function BusinessProfilePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['create-with-ai', 'profile'],
    queryFn: getProfile,
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['create-with-ai', 'profile'] });
  }, [qc]);

  useEffect(() => {
    setServerErrors({});
  }, [data?.profile?.updatedAt]);

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

  if (isLoading) return <div className="p-6 text-text-muted">Loading profile…</div>;
  if (error) return <div className="p-6 text-red-400">Failed to load profile: {extractApiError(error)}</div>;

  return (
    <div className="mx-8 mt-5 mb-8 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-text-main">{createWithAiCopy.profile.title}</h2>
        <p className="text-sm text-text-muted mt-1">{createWithAiCopy.profile.subtitle}</p>
      </div>

      <ProfileForm
        initial={profileToFormValues(data?.profile || null)}
        onSave={save}
        saving={saving}
        serverErrors={serverErrors}
      />

      {data?.profile && <MyBestEmails samples={data.samples} onRefresh={refresh} />}
      {!data?.profile && (
        <p className="text-sm text-text-muted">
          Save your profile first — writing samples attach to it afterwards.
        </p>
      )}
    </div>
  );
}
