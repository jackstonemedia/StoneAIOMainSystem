/**
 * My Best Emails — optional writing samples that refine voice only (spec §4).
 * Never required, never blocking, never nagged about. A sample's style summary
 * must be approved (or edited) before it is used for drafting.
 */

import React, { useState } from 'react';
import { createWithAiCopy } from '../../lib/createWithAiCopy';
import {
  addSamplePaste,
  addSampleUpload,
  updateSample,
  deleteSample,
  generateStyleSummary,
  fileToBase64,
  type WritingSample,
} from '../../lib/createWithAiApi';
import { extractApiError } from '../../lib/apiClient';
import { useToast } from '../ui/Toast';

function summaryLines(summary: Record<string, unknown> | null): Array<[string, string]> {
  if (!summary) return [];
  const out: Array<[string, string]> = [];
  const str = (k: string) => (typeof summary[k] === 'string' ? (summary[k] as string) : '');
  const arr = (k: string) => (Array.isArray(summary[k]) ? (summary[k] as string[]).join(', ') : '');
  if (str('typicalLength')) out.push(['Typical length', str('typicalLength')]);
  if (str('sentenceLength')) out.push(['Sentence length', str('sentenceLength')]);
  if (str('formality')) out.push(['Formality', str('formality')]);
  if (str('greeting')) out.push(['Greeting', str('greeting')]);
  if (str('signOff')) out.push(['Sign-off', str('signOff')]);
  if (str('punctuation')) out.push(['Punctuation', str('punctuation')]);
  if (arr('recurringPhrases')) out.push(['Recurring phrases', arr('recurringPhrases')]);
  if (arr('avoids')) out.push(['Avoids', arr('avoids')]);
  return out;
}

export default function MyBestEmails({
  samples,
  onRefresh,
}: {
  samples: WritingSample[];
  onRefresh: () => void;
}) {
  const copy = createWithAiCopy.profile.samples;
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<'paste' | 'upload'>('paste');
  const [title, setTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingSummary, setEditingSummary] = useState<string | null>(null);
  const [summaryDraft, setSummaryDraft] = useState('');

  const add = async () => {
    setBusy(true);
    setError('');
    try {
      if (addMode === 'paste') {
        await addSamplePaste(title, pasteText);
      } else {
        if (!file) throw new Error('Choose a file first.');
        const base64 = await fileToBase64(file);
        await addSampleUpload(title, file.name, file.type, base64);
      }
      toast('success', 'Sample added', 'Generate its style summary, then approve it before it is used.');
      setTitle('');
      setPasteText('');
      setFile(null);
      setShowAdd(false);
      onRefresh();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      toast('success', okMsg);
      onRefresh();
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-surface/40 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-main">{copy.title}</h3>
          <p className="text-sm text-text-muted mt-0.5">{copy.hint}</p>
          <p className="text-xs text-text-muted mt-1">
            {samples.length} of 10 samples · {copy.limit}
          </p>
        </div>
        <button type="button" onClick={() => setShowAdd(!showAdd)} className="btn-secondary whitespace-nowrap">
          {copy.link}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {showAdd && (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-bg">
          <div className="flex gap-2">
            <button type="button" onClick={() => setAddMode('paste')} className={addMode === 'paste' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>
              {copy.addPaste}
            </button>
            <button type="button" onClick={() => setAddMode('upload')} className={addMode === 'upload' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>
              {copy.addUpload}
            </button>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Spring promo email)"
            className="w-full border border-border bg-surface text-text-main rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary placeholder:text-text-muted"
          />
          {addMode === 'paste' ? (
            <div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste an email you wrote…"
                rows={6}
                className="w-full border border-border bg-surface text-text-main rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary placeholder:text-text-muted"
              />
              <p className="text-xs text-text-muted mt-1">{pasteText.length.toLocaleString()} / 10,000 characters</p>
            </div>
          ) : (
            <input
              type="file"
              accept=".txt,.docx,.pdf,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-text-muted"
            />
          )}
          <button type="button" onClick={add} disabled={busy} className="btn-primary text-sm">
            {busy ? 'Adding…' : 'Add sample'}
          </button>
        </div>
      )}

      {samples.length === 0 ? (
        <p className="text-sm text-text-muted">No samples yet. The AI writes a good email without them.</p>
      ) : (
        <ul className="space-y-3">
          {samples.map((s) => (
            <li key={s.id} className="border border-border rounded-lg p-3 bg-bg space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="text-sm font-medium text-text-main text-left">
                  {s.title} <span className="text-text-muted font-normal">({s.source} · {s.content.length.toLocaleString()} chars)</span>
                </button>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.approved ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'}`}>
                  {s.approved ? copy.approved : copy.pending}
                </span>
              </div>

              {expanded === s.id && (
                <div className="space-y-3">
                  <p className="text-sm text-text-muted whitespace-pre-line max-h-48 overflow-auto border border-border rounded p-2">{s.content}</p>
                  {s.styleSummary ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-text-main">Style summary</p>
                      {editingSummary === s.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={summaryDraft}
                            onChange={(e) => setSummaryDraft(e.target.value)}
                            rows={6}
                            className="w-full border border-border bg-surface text-text-main rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                act(async () => {
                                  const parsed = JSON.parse(summaryDraft);
                                  await updateSample(s.id, { styleSummary: parsed, approved: true });
                                  setEditingSummary(null);
                                }, 'Summary updated and approved')
                              }
                              className="btn-primary text-xs"
                            >
                              Save + approve
                            </button>
                            <button type="button" onClick={() => setEditingSummary(null)} className="btn-secondary text-xs">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <dl className="text-xs space-y-1">
                            {summaryLines(s.styleSummary).map(([k, v]) => (
                              <div key={k}>
                                <dt className="font-medium text-text-main inline">{k}: </dt>
                                <dd className="text-text-muted inline">{v}</dd>
                              </div>
                            ))}
                          </dl>
                          <div className="flex gap-2 pt-1">
                            {!s.approved && (
                              <button type="button" disabled={busy} onClick={() => act(() => updateSample(s.id, { approved: true }), 'Sample approved')} className="btn-primary text-xs">
                                {copy.approve}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSummaryDraft(JSON.stringify(s.styleSummary, null, 2));
                                setEditingSummary(s.id);
                              }}
                              className="btn-secondary text-xs"
                            >
                              {copy.editSummary}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(() => generateStyleSummary(s.id), 'Style summary generated — approve it to use it')}
                      className="btn-secondary text-xs"
                    >
                      {copy.generate}
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const next = window.prompt('New title', s.title);
                        if (next !== null) act(() => updateSample(s.id, { title: next }), 'Sample updated');
                      }}
                      className="btn-secondary text-xs"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(copy.deleteConfirm)) act(() => deleteSample(s.id), 'Sample deleted');
                      }}
                      className="btn-secondary text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
