/**
 * Profile confirm card — shown at the start of every Create with AI run (spec §4).
 * Two buttons: "Looks right, continue" and "Edit". Continue is blocked while any
 * required field is empty. Empty optional fields never block and are not mentioned.
 * If the profile has not changed in 90 days, a nudge line appears.
 */

import { createWithAiCopy } from '../../lib/createWithAiCopy';
import type { BusinessProfile } from '../../lib/createWithAiApi';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export default function ProfileConfirmCard({
  profile,
  missingRequired,
  onContinue,
  onEdit,
}: {
  profile: BusinessProfile;
  missingRequired: string[];
  onContinue: () => void;
  onEdit: () => void;
}) {
  const copy = createWithAiCopy.profile.confirmCard;
  const updatedAt = new Date(profile.updatedAt);
  const stale = Date.now() - updatedAt.getTime() > NINETY_DAYS_MS;
  const blocked = missingRequired.length > 0;

  return (
    <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-3">
      <h3 className="text-base font-semibold text-text-main">{copy.title}</h3>
      <dl className="text-sm space-y-1">
        <div>
          <dt className="text-text-muted inline">Business: </dt>
          <dd className="text-text-main inline">
            {profile.businessName} · {profile.businessType}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted inline">Services: </dt>
          <dd className="text-text-main inline whitespace-pre-line">{profile.services}</dd>
        </div>
        <div>
          <dt className="text-text-muted inline">Service area: </dt>
          <dd className="text-text-main inline">{profile.serviceArea}</dd>
        </div>
        <div>
          <dt className="text-text-muted inline">From: </dt>
          <dd className="text-text-main inline">
            {profile.senderName} &lt;{profile.replyToEmail}&gt;
          </dd>
        </div>
        <div>
          <dt className="text-text-muted inline">Action: </dt>
          <dd className="text-text-main inline">{profile.bookingLink || profile.phone || '—'}</dd>
        </div>
      </dl>
      {stale && (
        <p className="text-sm text-yellow-400">{copy.lastUpdated(updatedAt.toLocaleDateString())}</p>
      )}
      {blocked && (
        <div className="text-sm text-red-400 space-y-1">
          <p>{copy.blocked}</p>
          <ul className="list-disc list-inside text-xs">
            {missingRequired.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onContinue} disabled={blocked} className="btn-primary">
          {copy.continue}
        </button>
        <button type="button" onClick={onEdit} className="btn-secondary">
          {copy.edit}
        </button>
      </div>
    </div>
  );
}
