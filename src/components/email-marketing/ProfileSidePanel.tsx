/**
 * Profile side panel — "Edit" opens a side panel (desktop) or full-screen sheet
 * (mobile) and returns to the same point in the flow (spec §4). Saving updates
 * the profile immediately. When a campaign is in progress (M2+), the caller sets
 * `inProgress` and the panel asks whether to regenerate the draft or keep it.
 */

import React from 'react';
import ProfileForm, { profileToFormValues, type ProfileFormValues } from './ProfileForm';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import type { BusinessProfile } from '../../lib/createWithAiApi';

export default function ProfileSidePanel({
  open,
  profile,
  onClose,
  onSave,
  saving,
  serverErrors,
  inProgress,
  onRegenerate,
  onKeep,
}: {
  open: boolean;
  profile: BusinessProfile;
  onClose: () => void;
  onSave: (values: ProfileFormValues) => Promise<void>;
  saving: boolean;
  serverErrors?: Record<string, string>;
  inProgress?: boolean;
  onRegenerate?: () => void;
  onKeep?: () => void;
}) {
  const copy = createWithAiCopy.profile.sidePanel;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-lg h-full overflow-y-auto bg-bg border-l border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-main">{copy.title}</h3>
          <button type="button" onClick={onClose} className="btn-secondary text-xs">
            Close
          </button>
        </div>
        <ProfileForm
          initial={profileToFormValues(profile)}
          onSave={onSave}
          saving={saving}
          serverErrors={serverErrors}
          onCancel={onClose}
        />
        {inProgress && (
          <div className="border border-border rounded-lg p-3 space-y-2 bg-surface/40">
            <p className="text-sm text-text-main">{copy.changedInProgress}</p>
            <div className="flex gap-2">
              <button type="button" onClick={onRegenerate} className="btn-primary text-xs">
                {copy.regenerate}
              </button>
              <button type="button" onClick={onKeep} className="btn-secondary text-xs">
                {copy.keep}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
