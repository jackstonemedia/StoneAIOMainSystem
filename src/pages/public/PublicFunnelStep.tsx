/**
 * Public funnel step (Wave 1 item 1.2, Slice 3).
 * Standalone, unauthenticated: renders one step of a published funnel at
 * /f/:slug/:step. No login, no app shell. The form section submits to the
 * funnel endpoint; on success the visitor moves to the next step, and the
 * last step shows the page's own thank-you state.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SectionRenderer, { type FormAnswers } from '../../components/landing-pages/SectionRenderer';
import type { PageSection } from '../../types';
import { Loader2 } from 'lucide-react';

interface PublicFunnelStepData {
  funnelId: string;
  funnelName: string;
  funnelSlug: string;
  stepId: string;
  stepNumber: number;
  totalSteps: number;
  offerTitle: string | null;
  offerBody: string | null;
  page: {
    id: string;
    name: string;
    slug: string;
    seoTitle: string | null;
    seoDesc: string | null;
    sectionsJson: PageSection[];
  };
  nextStep: number | null;
}

export default function PublicFunnelStep() {
  const { slug = '', step = '1' } = useParams<{ slug: string; step: string }>();
  const navigate = useNavigate();
  const [stepData, setStepData] = useState<PublicFunnelStepData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setStepData(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/public/funnels/${encodeURIComponent(slug)}/${encodeURIComponent(step)}`,
        );
        if (res.status === 404) {
          if (!cancelled) setStatus('missing');
          return;
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as PublicFunnelStepData;
        if (cancelled) return;
        setStepData(data);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, step]);

  useEffect(() => {
    if (stepData) {
      document.title = stepData.offerTitle || stepData.page.seoTitle || stepData.page.name;
    }
  }, [stepData]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (status === 'missing' || !stepData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg text-text-main px-6 text-center">
        <h1 className="text-2xl font-semibold mb-2">This funnel isn&apos;t available</h1>
        <p className="text-text-muted">
          It may have been unpublished, or the link may be wrong.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg text-text-main px-6 text-center">
        <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-text-muted">Please try again in a moment.</p>
      </div>
    );
  }

  const submitForm = async (answers: FormAnswers) => {
    const res = await fetch(
      `/api/public/funnels/${encodeURIComponent(slug)}/${encodeURIComponent(step)}/submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      },
    );
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = (await res.json()) as Record<string, unknown>;
        if (typeof body.error === 'string') message = body.error;
      } catch {
        // Keep the status-based message.
      }
      throw new Error(message);
    }
    const body = (await res.json()) as { nextStep: number | null };
    if (body.nextStep !== null && body.nextStep !== undefined) {
      // Move on before the form's own thank-you state renders — the next
      // step is the visitor's confirmation that this one landed.
      navigate(`/f/${encodeURIComponent(slug)}/${body.nextStep}`);
    }
    // Last step: return without navigating — the form shows its thank-you.
  };

  return (
    <div className="min-h-screen bg-bg text-text-main">
      <div className="max-w-3xl mx-auto px-6 pt-6 text-center">
        <p className="text-text-muted text-xs">
          {stepData.funnelName} — Step {stepData.stepNumber} of {stepData.totalSteps}
        </p>
        {stepData.offerTitle && (
          <h1 className="text-2xl font-semibold mt-2">{stepData.offerTitle}</h1>
        )}
        {stepData.offerBody && (
          <p className="text-text-muted mt-2 whitespace-pre-wrap">{stepData.offerBody}</p>
        )}
      </div>
      <SectionRenderer sections={stepData.page.sectionsJson} onSubmit={submitForm} />
    </div>
  );
}
