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
    <div className="flex flex-col h-full w-full relative overflow-y-auto z-0 bg-bg pb-12">
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <ProfileForm
          initial={profileToFormValues(data?.profile || null)}
          onSave={save}
          saving={saving}
          serverErrors={serverErrors}
        />

        {data?.profile && (
          <div className="mt-10 pt-8 border-t border-border/60">
            <MyBestEmails samples={data.samples} onRefresh={refresh} />
          </div>
        )}
        {!data?.profile && (
          <p className="text-sm text-text-muted mt-4 text-center">
            Save your profile first — writing samples attach to it afterwards.
          </p>
        )}
      </div>
    </div>
  );
}
