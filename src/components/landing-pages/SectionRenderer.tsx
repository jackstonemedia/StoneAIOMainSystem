/**
 * Shared landing-page section renderer (Wave 1 item 1.1).
 * Used by the editor preview (Slice 2) AND the public page (Slice 3) so
 * what the user sees while editing is what visitors get.
 *
 * `preview` renders the form disabled with a "Form preview" note and skips
 * submit handling. Pass `onSubmit` for the live public form.
 */
import { useState } from 'react';
import type { PageSection } from '../../types';
import { hasFormSection } from '../../lib/landingPageSections';

export interface FormAnswers {
  name: string;
  email: string;
  phone: string;
  message: string;
}

interface RendererProps {
  sections: PageSection[];
  preview?: boolean;
  onSubmit?: (answers: FormAnswers) => Promise<void>;
}

function str(config: Record<string, unknown>, key: string): string {
  const v = config[key];
  return typeof v === 'string' ? v : '';
}

function scrollToForm() {
  document.getElementById('lp-form')?.scrollIntoView({ behavior: 'smooth' });
}

function SectionForm({
  section,
  preview,
  onSubmit,
}: {
  section: PageSection;
  preview: boolean;
  onSubmit?: (answers: FormAnswers) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<FormAnswers>({ name: '', email: '', phone: '', message: '' });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const set = (key: keyof FormAnswers) => (e: { target: { value: string } }) =>
    setAnswers((a) => ({ ...a, [key]: e.target.value }));

  const submit = async () => {
    if (!onSubmit) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setSending(true);
    try {
      await onSubmit({ ...answers, email: answers.email.trim() });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <section id="lp-form" className="py-10 px-6 text-center">
        <h2 className="text-2xl font-semibold mb-2">Thank you</h2>
        <p className="text-text-muted">We have your details and will be in touch.</p>
      </section>
    );
  }

  const inputCls = 'w-full bg-bg border border-border rounded px-3 py-2 text-text-main';
  return (
    <section id="lp-form" className="py-10 px-6">
      <h2 className="text-2xl font-semibold text-center mb-6">{str(section.config, 'heading') || 'Get in touch'}</h2>
      <div className="max-w-md mx-auto flex flex-col gap-3">
        <input className={inputCls} placeholder="Your name" value={answers.name} onChange={set('name')} disabled={preview} />
        <input className={inputCls} placeholder="Email address *" type="email" value={answers.email} onChange={set('email')} disabled={preview} />
        <input className={inputCls} placeholder="Phone (optional)" value={answers.phone} onChange={set('phone')} disabled={preview} />
        <textarea className={inputCls} placeholder="Message (optional)" rows={3} value={answers.message} onChange={set('message')} disabled={preview} />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          className="px-4 py-2 rounded bg-primary text-white font-medium disabled:opacity-50"
          disabled={preview || sending}
          onClick={submit}
        >
          {preview ? 'Form preview' : sending ? 'Sending…' : str(section.config, 'buttonText') || 'Submit'}
        </button>
        {preview && <p className="text-text-muted text-xs text-center">This form is a preview — it does not submit while editing.</p>}
      </div>
    </section>
  );
}

export default function SectionRenderer({ sections, preview = false, onSubmit }: RendererProps) {
  const showFormButtons = hasFormSection(sections);
  return (
    <div className="w-full bg-bg text-text-main">
      {sections.map((section) => {
        switch (section.type) {
          case 'hero':
            return (
              <section key={section.id} className="py-16 px-6 text-center">
                <h1 className="text-4xl font-bold mb-4">{str(section.config, 'heading')}</h1>
                {str(section.config, 'subheading') && (
                  <p className="text-lg text-text-muted max-w-xl mx-auto mb-8">{str(section.config, 'subheading')}</p>
                )}
                {showFormButtons && str(section.config, 'buttonText') && (
                  <button className="px-6 py-3 rounded bg-primary text-white font-medium" onClick={scrollToForm}>
                    {str(section.config, 'buttonText')}
                  </button>
                )}
              </section>
            );
          case 'text':
            return (
              <section key={section.id} className="py-10 px-6">
                <div className="max-w-xl mx-auto">
                  {str(section.config, 'heading') && (
                    <h2 className="text-2xl font-semibold mb-3">{str(section.config, 'heading')}</h2>
                  )}
                  <p className="text-text-muted leading-relaxed whitespace-pre-wrap">{str(section.config, 'body')}</p>
                </div>
              </section>
            );
          case 'image': {
            const src = str(section.config, 'src');
            if (!src) {
              return preview ? (
                <section key={section.id} className="py-10 px-6">
                  <div className="max-w-xl mx-auto border border-dashed border-border rounded p-8 text-center text-text-muted">
                    Image section — add an image URL in the editor.
                  </div>
                </section>
              ) : null;
            }
            return (
              <section key={section.id} className="py-10 px-6">
                <figure className="max-w-xl mx-auto">
                  <img src={src} alt={str(section.config, 'alt')} className="w-full rounded" />
                  {str(section.config, 'caption') && (
                    <figcaption className="text-text-muted text-sm text-center mt-2">{str(section.config, 'caption')}</figcaption>
                  )}
                </figure>
              </section>
            );
          }
          case 'form':
            return <SectionForm key={section.id} section={section} preview={preview} onSubmit={onSubmit} />;
          case 'cta':
            return (
              <section key={section.id} className="py-12 px-6 text-center border-t border-border">
                <h2 className="text-2xl font-semibold mb-4">{str(section.config, 'heading')}</h2>
                {showFormButtons && str(section.config, 'buttonText') && (
                  <button className="px-6 py-3 rounded bg-primary text-white font-medium" onClick={scrollToForm}>
                    {str(section.config, 'buttonText')}
                  </button>
                )}
              </section>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
