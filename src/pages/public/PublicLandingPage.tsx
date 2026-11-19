/**
 * Public landing page (Wave 1 item 1.1, Slices 3-4).
 * Standalone, unauthenticated: renders a published page at /p/:slug.
 * No login, no app shell. The form section submits to the public endpoint
 * and creates (or links) a contact.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SectionRenderer, { type FormAnswers } from '../../components/landing-pages/SectionRenderer';
import type { PageSection } from '../../types';
import { Loader2 } from 'lucide-react';

interface PublicPageData {
  id: string;
  name: string;
  slug: string;
  seoTitle: string | null;
  seoDesc: string | null;
  sectionsJson: PageSection[];
}

export default function PublicLandingPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PublicPageData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/pages/${encodeURIComponent(slug)}`);
        if (res.status === 404) {
          if (!cancelled) setStatus('missing');
          return;
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as PublicPageData;
        if (cancelled) return;
        setPage(data);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (page) {
      document.title = page.seoTitle || page.name;
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', page.seoDesc || '');
    }
  }, [page]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (status === 'missing' || !page) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg text-text-main px-6 text-center">
        <h1 className="text-2xl font-semibold mb-2">This page isn&apos;t available</h1>
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
    const res = await fetch(`/api/public/pages/${encodeURIComponent(slug)}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    });
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
  };

  return (
    <div className="min-h-screen bg-bg text-text-main">
      <SectionRenderer sections={page.sectionsJson} onSubmit={submitForm} />
    </div>
  );
}
