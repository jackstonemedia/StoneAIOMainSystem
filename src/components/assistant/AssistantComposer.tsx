import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Square, ChevronDown, Plus,
  Mic, X, FileText, Image as ImageIcon,
  CornerDownLeft, Check, Folder
} from 'lucide-react';
import { assistantApi, type AssistantProject } from '../../lib/api/assistant';

export type AccessMode = 'read_only' | 'draft' | 'full';
export type ThinkingMode = 'auto' | 'deep' | 'standard';

const ROTATING_CAPABILITIES = [
  'Draft a summary of recent activity...',
  'Write a personalized follow-up email...',
  'Audit active pipeline deals and revenue...',
  'Find new leads needing outreach...',
  'Review pending task approvals and automations...',
];

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
  isCenteredEmptyState?: boolean;
  selectedProjectId?: string | null;
  onSelectProject?: (projectId: string | null) => void;
  placeholder?: string;
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
  isCenteredEmptyState = false,
  selectedProjectId = null,
  onSelectProject,
  placeholder,
}: AssistantComposerProps) {
  let navigate: any = null;
  try {
    navigate = useNavigate();
  } catch {
    navigate = null;
  }

  // Attachments and recording
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Model selection
  const [selectedModel, setSelectedModel] = useState<'Sonnet 5.5 Extra' | 'Sonnet 4.6' | 'Haiku 4.5'>('Sonnet 5.5 Extra');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // Thinking Mode selection (Auto / Deep Thinking / Standard)
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>(() =>
    thinking === 'extended' ? 'deep' : 'auto'
  );
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  // Projects list and dropdown
  const [projects, setProjects] = useState<AssistantProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(selectedProjectId);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  // Rotating placeholder capabilities
  const [capabilityIndex, setCapabilityIndex] = useState(0);
  const [fadeState, setFadeState] = useState<'visible' | 'fading'>('visible');

  useEffect(() => {
    if (input.length > 0) return;
    const interval = setInterval(() => {
      setFadeState('fading');
      setTimeout(() => {
        setCapabilityIndex((prev) => (prev + 1) % ROTATING_CAPABILITIES.length);
        setFadeState('visible');
      }, 350);
    }, 3800);
    return () => clearInterval(interval);
  }, [input]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const charCount = input.length;
  const isNearLimit = charCount >= maxChars - 1000;
  const isOverLimit = charCount > maxChars;

  // Load projects list
  useEffect(() => {
    assistantApi.listProjects().then(setProjects).catch(() => {});
  }, []);

  // Sync external selectedProjectId if provided
  useEffect(() => {
    if (selectedProjectId !== undefined) {
      setCurrentProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${newHeight}px`;
  }, [input]);

  // Close menus on outside click or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (modelMenuRef.current && !modelMenuRef.current.contains(target)) {
        setModelMenuOpen(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(target)) {
        setModeMenuOpen(false);
      }
      if (projectMenuRef.current && !projectMenuRef.current.contains(target)) {
        setProjectMenuOpen(false);
      }
    }
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        setModelMenuOpen(false);
        setModeMenuOpen(false);
        setProjectMenuOpen(false);
      }
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
        setInput(input ? `${input} ${transcript}` : transcript);
      };

      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
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
      } catch (err) {
        setIsRecording(false);
      }
    }
  };

  const processFiles = (files: FileList) => {
    const validFiles = Array.from(files).filter(f => f.size <= 25 * 1024 * 1024);
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result as string;
        const isImage = file.type.startsWith('image/');
        setAttachments(prev => [
          ...prev,
          {
            type: isImage ? 'image' : 'file',
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            data,
            size: file.size,
          },
        ]);
      };
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
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

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      const dt = new DataTransfer();
      imageFiles.forEach(f => dt.items.add(f));
      processFiles(dt.files);
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

  const hasSendContent = (input.trim().length > 0 || attachments.length > 0) && !isOverLimit && !disabled;
  const selectedProject = projects.find(p => p.id === currentProjectId);

  return (
    <div className={`w-full ${isCenteredEmptyState ? 'max-w-2xl md:max-w-3xl' : 'max-w-3xl'} mx-auto px-4 pb-3`}>
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

      {isCenteredEmptyState ? (
        /* Empty State Card Container (Less tall, same width) */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative rounded-2xl md:rounded-[20px] bg-[#2A2A2B] border border-transparent focus-within:border-[#3E3E3E] transition-all p-3.5 md:p-4 shadow-sm flex flex-col justify-between min-h-[105px] md:min-h-[115px] ${
            isDragging ? 'border-primary ring-2 ring-primary/30' : ''
          }`}
        >
          {/* Attachment Chips Header */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2 mb-2 border-b border-[#3E3E3E]/60">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#333334] border border-[#444445] text-xs text-[#ECECEC] group"
                >
                  {att.type === 'image' ? (
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span className="truncate max-w-[140px] font-medium">{att.name}</span>
                  <span className="text-[10px] text-[#8E8E8E]">
                    ({Math.round(att.size / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    aria-label="Remove attachment"
                    className="p-0.5 rounded-full hover:bg-white/10 text-[#8E8E8E] hover:text-white transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea Area */}
          <div className="relative flex-1 w-full min-h-[40px]">
            {!input && (
              <div
                className={`absolute top-0 left-0 pointer-events-none text-[#7A7A7D] text-[15px] leading-relaxed select-none transition-opacity duration-300 ${
                  fadeState === 'fading' ? 'opacity-0' : 'opacity-100'
                }`}
              >
                {placeholder || ROTATING_CAPABILITIES[capabilityIndex]}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder || ROTATING_CAPABILITIES[capabilityIndex]}
              aria-label={placeholder || ROTATING_CAPABILITIES[capabilityIndex]}
              disabled={disabled}
              className="w-full h-full bg-transparent text-[#ECECEC] text-[15px] leading-relaxed resize-none outline-none p-0 border-0 focus:ring-0 overflow-y-auto"
            />
          </div>

          {/* Bottom Row INSIDE the Box: Plus on bottom left, Voice Mic on bottom right */}
          <div className="flex items-center justify-between pt-2 mt-auto select-none">
            {/* Plus sign at bottom left */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add files"
              title="Attach images, documents or files"
              className="p-1 text-[#8A8A8D] hover:text-white transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Voice Microphone and Audio on bottom right */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleRecording}
                aria-label={isRecording ? 'Stop voice recording' : 'Voice input'}
                title={isRecording ? 'Listening... click to stop' : 'Voice input'}
                className={`p-1 text-[#8A8A8D] hover:text-white transition-colors cursor-pointer ${
                  isRecording ? 'text-rose-400 animate-pulse' : ''
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* When text is entered or streaming, show enter/send button */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop generating"
                  className="w-5 h-5 rounded-md bg-white text-black flex items-center justify-center transition-opacity hover:opacity-90 ml-1 cursor-pointer"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                </button>
              ) : hasSendContent ? (
                <button
                  type="button"
                  onClick={handleSendClick}
                  aria-label="Send message"
                  className="w-6 h-6 rounded-lg bg-white text-black hover:bg-neutral-200 flex items-center justify-center transition-all ml-1 cursor-pointer shadow-xs"
                >
                  <CornerDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        /* Active Thread Compact Pill Container (Slim height, smaller reply button) */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative rounded-2xl bg-[#2A2A2B] border border-transparent focus-within:border-[#3E3E3E] transition-all px-4 py-2 shadow-sm flex items-center gap-2 min-h-[44px] ${
            isDragging ? 'border-primary ring-2 ring-primary/30' : ''
          }`}
        >
          {/* Attachment Chips Header if present */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 shrink-0 pr-1 border-r border-[#3E3E3E]/60">
              {attachments.map((att, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#333334] text-[11px] text-[#ECECEC]"
                >
                  <span className="truncate max-w-[80px]">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    aria-label="Remove attachment"
                    className="hover:text-white"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Textarea inside slim pill */}
          <div className="relative flex-1 w-full min-h-[24px] flex items-center">
            {!input && (
              <div className="absolute left-0 pointer-events-none text-[#7A7A7D] text-[14.5px] select-none">
                {placeholder || 'Reply'}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              placeholder={placeholder || 'Reply'}
              aria-label={placeholder || 'Reply'}
              disabled={disabled}
              className="w-full bg-transparent text-[#ECECEC] text-[14.5px] leading-snug resize-none outline-none p-0 border-0 focus:ring-0 max-h-[120px] overflow-y-auto"
            />
          </div>

          {/* Small Reply Button on right of the pill */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="w-5 h-5 rounded-md bg-white text-black flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Square className="w-2 h-2 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendClick}
              disabled={!hasSendContent}
              aria-label="Send reply"
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                hasSendContent
                  ? 'bg-white text-black hover:bg-neutral-200 cursor-pointer'
                  : 'text-[#555558] cursor-default'
              }`}
            >
              <CornerDownLeft className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          )}
        </div>
      )}

      {/* Outer Bottom Row: Tools/Project on Bottom Left, Disclaimer in Center (Active thread), Model & Mode on Bottom Right */}
      <div className="flex items-center justify-between text-xs text-[#8A8A8D] px-2 pt-2.5 select-none">
        {/* Bottom Left: Project Dropdown (Empty State) or Tools Row (Active Thread) */}
        {isCenteredEmptyState ? (
          <div ref={projectMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setProjectMenuOpen(!projectMenuOpen)}
              className="flex items-center gap-1.5 text-[12px] font-medium text-[#8A8A8D] hover:text-white transition-colors cursor-pointer"
            >
              <span>{selectedProject ? selectedProject.name : 'Project'}</span>
              <ChevronDown className={`w-3 h-3 text-[#8A8A8D] transition-transform ${projectMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {projectMenuOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-52 rounded-xl bg-[#2A2A2B] border border-[#3E3E3E] shadow-xl p-1 z-50 text-xs animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentProjectId(null);
                    onSelectProject?.(null);
                    setProjectMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    !currentProjectId ? 'bg-[#3A3A3B] text-white font-medium' : 'text-[#8A8A8D] hover:text-white hover:bg-[#343435]'
                  }`}
                >
                  <span>No project (General)</span>
                  {!currentProjectId && <Check className="w-3.5 h-3.5 text-white" />}
                </button>

                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      setCurrentProjectId(proj.id);
                      onSelectProject?.(proj.id);
                      setProjectMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      currentProjectId === proj.id ? 'bg-[#3A3A3B] text-white font-medium' : 'text-[#8A8A8D] hover:text-white hover:bg-[#343435]'
                    }`}
                  >
                    <span className="truncate">{proj.name}</span>
                    {currentProjectId === proj.id && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}

                <div className="border-t border-[#3E3E3E] my-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProjectMenuOpen(false);
                      navigate('/assistant/projects');
                    }}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-left text-primary hover:bg-[#343435] transition-colors"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Manage Projects</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add files"
              title="Attach files"
              className="text-[#8A8A8D] hover:text-white transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleRecording}
              aria-label="Voice input"
              title="Voice input"
              className={`p-1 text-[#8A8A8D] hover:text-white transition-colors cursor-pointer ${
                isRecording ? 'text-rose-400 animate-pulse' : ''
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Center: Disclaimer in Active Chat & Character Counter */}
        <div className="flex items-center gap-2">
          {!isCenteredEmptyState && (
            <div className="hidden sm:block text-[11px] text-[#71717A] tracking-tight">
              Stone AI can make mistakes. Check important info.
            </div>
          )}
          {isNearLimit && (
            <span className={`font-mono text-[10px] ${isOverLimit ? 'text-rose-500 font-semibold' : 'text-[#8A8A8D]'}`}>
              {charCount.toLocaleString()} / {maxChars.toLocaleString()}
            </span>
          )}
        </div>

        {/* Bottom Right: Model Name & Auto/Deep Thinking Mode */}
        <div className="flex items-center gap-3">
          {/* Model Selector */}
          <div ref={modelMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setModelMenuOpen(!modelMenuOpen)}
              className="text-[12px] font-medium text-[#8A8A8D] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>{selectedModel.split(' ')[0]} {selectedModel.split(' ')[1]}</span>
              {selectedModel.includes('Extra') && (
                <span className="text-[10px] text-[#707073]">Extra</span>
              )}
            </button>

            {modelMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-44 rounded-xl bg-[#2A2A2B] border border-[#3E3E3E] shadow-xl p-1 z-50 text-xs animate-in fade-in zoom-in-95">
                {(['Sonnet 5.5 Extra', 'Sonnet 4.6', 'Haiku 4.5'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setSelectedModel(m);
                      setModelMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      selectedModel === m ? 'bg-[#3A3A3B] text-white font-medium' : 'text-[#8A8A8D] hover:text-white hover:bg-[#343435]'
                    }`}
                  >
                    <span>{m}</span>
                    {selectedModel === m && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mode Selector: Auto / Deep Thinking / Standard */}
          <div ref={modeMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setModeMenuOpen(!modeMenuOpen)}
              className="text-[12px] font-medium text-[#8A8A8D] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>
                {thinkingMode === 'deep' ? 'Deep Thinking' : thinkingMode === 'standard' ? 'Standard' : 'Auto'}
              </span>
            </button>

            {modeMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-48 rounded-xl bg-[#2A2A2B] border border-[#3E3E3E] shadow-xl p-1 z-50 text-xs animate-in fade-in zoom-in-95">
                {[
                  { id: 'auto', label: 'Auto', desc: 'Balanced intelligence & speed', think: 'auto', modeVal: 'full' },
                  { id: 'deep', label: 'Deep Thinking', desc: 'Extended reasoning chain', think: 'extended', modeVal: 'full' },
                  { id: 'standard', label: 'Standard', desc: 'Fast, direct responses', think: 'auto', modeVal: 'draft' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setThinkingMode(item.id as ThinkingMode);
                      onThinkingChange?.(item.think as any);
                      onModeChange(item.modeVal as AccessMode);
                      setModeMenuOpen(false);
                    }}
                    className={`w-full flex items-start justify-between px-2.5 py-2 rounded-lg text-left transition-colors ${
                      thinkingMode === item.id ? 'bg-[#3A3A3B] text-white font-medium' : 'text-[#8A8A8D] hover:text-white hover:bg-[#343435]'
                    }`}
                  >
                    <div>
                      <div className="text-[12px] font-medium text-white">{item.label}</div>
                      <div className="text-[10px] text-[#7A7A7D]">{item.desc}</div>
                    </div>
                    {thinkingMode === item.id && <Check className="w-3.5 h-3.5 text-white mt-0.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
