import React, { useEffect, useRef, useState, useCallback } from 'react';
import grapesjs, { type Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import gjsPresetNewsletter from 'grapesjs-preset-newsletter';
import { blockJsonToGrapesjs } from '../../lib/blockJsonToGrapesjs';
import { grapesjsToBlockJson, type BlockJson } from '../../lib/grapesjsToBlockJson';
import { Code, Layout, Tag, ChevronDown } from 'lucide-react';

interface EmailBuilderCanvasProps {
  initialContent?: string | BlockJson | Record<string, any>;
  onChange?: (html: string, blockJson: BlockJson) => void;
  height?: string;
  placeholder?: string;
}

const MERGE_TAGS = [
  { label: 'First Name', tag: '{{contact.first_name | fallback:"there"}}' },
  { label: 'Last Name', tag: '{{contact.last_name}}' },
  { label: 'Full Name', tag: '{{contact.name}}' },
  { label: 'Email Address', tag: '{{contact.email}}' },
  { label: 'Company / Business', tag: '{{contact.business_name}}' },
  { label: 'Phone Number', tag: '{{contact.phone}}' },
  { label: 'Unsubscribe Link', tag: '{{unsubscribe_url}}' },
];

export const EmailBuilderCanvas: React.FC<EmailBuilderCanvasProps> = ({
  initialContent,
  onChange,
  height = '580px',
  placeholder = 'Start designing your email...',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'code'>('visual');
  const [currentHtml, setCurrentHtml] = useState<string>('');
  const [showTagMenu, setShowTagMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync initial content once
  useEffect(() => {
    const converted = blockJsonToGrapesjs(initialContent || '');
    const startingHtml = converted.html || `<div style="padding: 24px; font-family: Arial, sans-serif;"><p>${placeholder}</p></div>`;
    setCurrentHtml(startingHtml);

    if (!containerRef.current) return;

    // Destroy any existing editor if present
    if (editorRef.current) {
      editorRef.current.destroy();
      editorRef.current = null;
    }

    try {
      const editor = grapesjs.init({
        container: containerRef.current,
        fromElement: false,
        height: '100%',
        width: 'auto',
        storageManager: false,
        plugins: [gjsPresetNewsletter],
        pluginsOpts: {
          [gjsPresetNewsletter as any]: {
            modalTitleImport: 'Import Template HTML',
          },
        },
        components: startingHtml,
      });

      const handleUpdate = () => {
        const html = editor.getHtml();
        setCurrentHtml(html);
        const bj = grapesjsToBlockJson(editor);
        onChange?.(html, bj);
      };

      editor.on('update', handleUpdate);
      editor.on('component:update', handleUpdate);
      editorRef.current = editor;
    } catch (err) {
      console.error('[EmailBuilderCanvas] Failed to initialize GrapesJS:', err);
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []);

  const handleTabSwitch = useCallback((tab: 'visual' | 'code') => {
    if (tab === 'code') {
      if (editorRef.current) {
        const html = editorRef.current.getHtml();
        setCurrentHtml(html);
      }
    } else if (tab === 'visual') {
      if (editorRef.current) {
        editorRef.current.setComponents(currentHtml);
      }
    }
    setActiveTab(tab);
  }, [currentHtml]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCurrentHtml(val);
    const bj = grapesjsToBlockJson(val);
    onChange?.(val, bj);
  };

  const handleInsertTag = (tag: string) => {
    if (activeTab === 'visual' && editorRef.current) {
      const selected = editorRef.current.getSelected();
      if (selected) {
        selected.append(tag);
      } else {
        editorRef.current.addComponents(tag);
      }
      const html = editorRef.current.getHtml();
      setCurrentHtml(html);
      onChange?.(html, grapesjsToBlockJson(editorRef.current));
    } else {
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const updated = text.substring(0, start) + tag + text.substring(end);
        setCurrentHtml(updated);
        onChange?.(updated, grapesjsToBlockJson(updated));
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 0);
      } else {
        const updated = currentHtml + tag;
        setCurrentHtml(updated);
        onChange?.(updated, grapesjsToBlockJson(updated));
      }
    }
    setShowTagMenu(false);
  };

  return (
    <div
      className="flex flex-col border border-border/70 rounded-xl overflow-hidden bg-surface shadow-card relative"
      style={{ height }}
    >
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/70 bg-surface/90 backdrop-blur-md shrink-0 z-10">
        {/* Visual vs Code Tab Switcher */}
        <div className="flex items-center gap-1 bg-surface-hover/60 p-1 rounded-lg border border-border/50">
          <button
            type="button"
            onClick={() => handleTabSwitch('visual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'visual'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            Visual Builder
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'code'
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Code / HTML
          </button>
        </div>

        {/* Merge Tag Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTagMenu(!showTagMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-surface hover:bg-surface-hover text-xs font-semibold text-text-main transition-colors shadow-sm"
          >
            <Tag className="w-3.5 h-3.5 text-primary" />
            <span>Insert Personalization Tag</span>
            <ChevronDown className="w-3 h-3 text-text-muted ml-0.5" />
          </button>

          {showTagMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowTagMenu(false)}
              />
              <div className="absolute right-0 mt-1.5 w-72 bg-surface border border-border rounded-xl shadow-xl z-50 p-1.5 overflow-hidden">
                <div className="px-2.5 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Personalization Tokens
                </div>
                <div className="max-h-60 overflow-y-auto space-y-0.5">
                  {MERGE_TAGS.map(t => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => handleInsertTag(t.tag)}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-primary/10 hover:text-primary rounded-lg text-xs font-medium text-text-main flex items-center justify-between transition-colors group"
                    >
                      <span className="font-medium group-hover:text-primary">{t.label}</span>
                      <span className="text-[10px] text-text-muted font-mono bg-surface-hover/80 px-1.5 py-0.5 rounded">
                        {t.tag.slice(0, 16)}…
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 relative overflow-hidden bg-bg">
        <div
          ref={containerRef}
          className={`h-full w-full ${activeTab === 'visual' ? 'block' : 'hidden'}`}
        />
        {activeTab === 'code' && (
          <textarea
            ref={textareaRef}
            value={currentHtml}
            onChange={handleCodeChange}
            placeholder="Write or edit HTML template body directly..."
            className="w-full h-full p-4 font-mono text-xs bg-bg text-text-main resize-none focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
};
export default EmailBuilderCanvas;
