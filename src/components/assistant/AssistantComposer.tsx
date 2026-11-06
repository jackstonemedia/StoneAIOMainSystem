import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
  ArrowUp, Square, ChevronDown, Brain, Plus,
  Mic, MicOff, X, FileText, Image as ImageIcon
} from 'lucide-react';

export type AccessMode = 'read_only' | 'draft' | 'full';

export interface ComposerAttachment {
  type: 'image' | 'file';
  name: string;
  mimeType: string;
  data: string;
  size: number;
}

interface AssistantComposerProps {
  input: string;
  setInput: (value: string) => void;
  onSend: (content: string, attachments?: ComposerAttachment[]) => void;
  onStop?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  mode: AccessMode;
  onModeChange: (mode: AccessMode) => void;
  thinking?: 'auto' | 'extended';
  onThinkingChange?: (thinking: 'auto' | 'extended') => void;
  maxChars?: number;
}

export function AssistantComposer({
  input,
  setInput,
  onSend,
  onStop,
  isStreaming,
  disabled = false,
  mode,
  onModeChange,
  thinking = 'auto',
  onThinkingChange,
  maxChars = 20000,
}: AssistantComposerProps) {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const charCount = input.length;
  const isNearLimit = charCount >= maxChars - 1000;
  const isOverLimit = charCount > maxChars;

  // Auto-resize textarea up to 8 lines (approx 200px) then scroll
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 200);
    el.style.height = `${newHeight}px`;
  }, [input]);

  // Close mode menu on outside click or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
    }
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setModeMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Initialize SpeechRecognition if available
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(input ? `${input} ${transcript}` : transcript);
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, [setInput]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {
        setIsRecording(false);
      }
    }
  };

  // Convert File to base64
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      if (file.size > 20 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 20MB.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string) || '';
        const isImg = file.type.startsWith('image/');
        setAttachments((prev) => [
          ...prev,
          {
            type: isImg ? 'image' : 'file',
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            data: base64,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      processFiles(e.clipboardData.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  const handleSendClick = () => {
    if (isStreaming) {
      onStop?.();
    } else if ((input.trim() || attachments.length > 0) && !isOverLimit && !disabled) {
      onSend(input.trim(), attachments.length > 0 ? attachments : undefined);
      setAttachments([]);
    }
  };

  const modeBadgeColor =
    mode === 'full'
      ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
      : mode === 'draft'
      ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
      : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';

  const modeLabel =
    mode === 'full' ? 'Full autonomy' : mode === 'draft' ? 'Draft' : 'Read-only';

  const hasSendContent = (input.trim().length > 0 || attachments.length > 0) && !isOverLimit && !disabled;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-3">
      {/* Floating Capsule Input */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border bg-[#181a22]/95 backdrop-blur-md shadow-luxury transition-all px-3.5 py-2.5 ${
          isDragging ? 'border-primary ring-2 ring-primary/30' : 'border-border/60 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20'
        }`}
      >
        {/* Hidden File Picker */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*,application/pdf,text/csv,text/plain"
          onChange={(e) => {
            if (e.target.files) processFiles(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* Attachment Chips Header */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2 mb-1 border-b border-border/30">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-hover border border-border/40 text-xs text-text-main group"
              >
                {att.type === 'image' ? (
                  <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span className="truncate max-w-[140px] font-medium">{att.name}</span>
                <span className="text-[10px] text-text-muted">
                  ({Math.round(att.size / 1024)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  aria-label="Remove attachment"
                  className="p-0.5 rounded-full hover:bg-muted text-text-muted hover:text-foreground transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Composer Row: Plus on Left, Textarea in Middle, Mic & Send on Right */}
        <div className="flex items-center gap-1.5">
          {/* Plus / Add Files Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Add files"
            title="Attach images, documents or files"
            className="p-1.5 rounded-full text-text-muted hover:text-text-main hover:bg-surface-hover/70 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Main Text Input */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Write a message..."
            aria-label="Write a message"
            rows={1}
            disabled={disabled}
            className="flex-1 px-2 py-1 text-[14.5px] leading-relaxed bg-transparent text-text-main placeholder:text-text-muted/60 resize-none outline-none max-h-[200px] overflow-y-auto"
          />

          <div className="flex items-center gap-1 shrink-0">
            {/* Voice Input Mic Button */}
            <button
              type="button"
              onClick={toggleRecording}
              aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
              title={isRecording ? 'Listening... click to stop' : 'Voice input'}
              className={`p-1.5 rounded-full transition-colors ${
                isRecording
                  ? 'bg-rose-500/10 text-rose-500 animate-pulse border border-rose-500/30'
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover/70'
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Send / Stop Action Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="w-7 h-7 rounded-full bg-text-main text-bg flex items-center justify-center transition-opacity hover:opacity-90"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            ) : hasSendContent ? (
              <button
                type="button"
                onClick={handleSendClick}
                aria-label="Send message"
                className="w-7 h-7 rounded-full bg-[#ececec] text-black hover:bg-white flex items-center justify-center transition-all shadow-xs"
              >
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            ) : (
              <button
                type="button"
                disabled
                aria-label="Send message"
                className="w-7 h-7 rounded-full bg-surface-hover text-text-muted/30 flex items-center justify-center cursor-not-allowed"
              >
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info Row: Disclaimer on Left, Model & Access Mode on Right */}
      <div className="flex items-center justify-between text-[11px] text-text-muted/60 px-2 pt-1.5 select-none">
        <span>Stone AI can make mistakes. Please double-check responses.</span>

        <div className="flex items-center gap-2">
          {isNearLimit && (
            <span className={`font-mono text-[10px] ${isOverLimit ? 'text-rose-500 font-semibold' : 'text-text-muted'}`}>
              {charCount.toLocaleString()} / {maxChars.toLocaleString()}
            </span>
          )}

          {/* Mode Selector Pill */}
          <div ref={modeMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setModeMenuOpen(!modeMenuOpen)}
              className="text-text-muted/80 hover:text-text-main flex items-center gap-1 font-medium transition-colors"
            >
              <span>{modeLabel}</span>
              {thinking === 'extended' && <span className="text-primary font-normal">· Thinking</span>}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {modeMenuOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-72 p-1.5 rounded-xl bg-bg border border-border/70 shadow-xl z-50 animate-in fade-in zoom-in-95 text-xs">
                <div className="px-2.5 py-1 font-semibold text-text-muted text-[10px] uppercase tracking-wider">
                  Access Level
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onModeChange('read_only');
                    setModeMenuOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex flex-col gap-0.5 ${
                    mode === 'read_only' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-hover text-text-main'
                  }`}
                >
                  <span className="font-semibold">Read-only</span>
                  <span className="text-[11px] text-text-muted">Search, open and inspect records. Cannot modify.</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onModeChange('draft');
                    setModeMenuOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex flex-col gap-0.5 ${
                    mode === 'draft' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-hover text-text-main'
                  }`}
                >
                  <span className="font-semibold text-blue-500">Draft</span>
                  <span className="text-[11px] text-text-muted">Drafts emails, changes and actions for your preview and approval.</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onModeChange('full');
                    setModeMenuOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors flex flex-col gap-0.5 ${
                    mode === 'full' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-hover text-text-main'
                  }`}
                >
                  <span className="font-semibold text-amber-500">Full autonomy</span>
                  <span className="text-[11px] text-text-muted">Autonomous execution within safe guardrails.</span>
                </button>

                <div className="my-1 border-t border-border/40" />

                {/* Reasoning mode */}
                <button
                  type="button"
                  onClick={() => {
                    onThinkingChange?.(thinking === 'extended' ? 'auto' : 'extended');
                    setModeMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-text-main flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                    <span>Extended Thinking</span>
                  </div>
                  <span className="text-[10px] text-text-muted">
                    {thinking === 'extended' ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
