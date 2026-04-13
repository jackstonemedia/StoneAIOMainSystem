import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Image, Film, Music, FileArchive, Trash2, Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  data: string; // base64
  uploadedAt: string;
}

interface FileAttachmentsProps {
  entityId: string;
}

const STORAGE_KEY = (id: string) => `crm_attachments_${id}`;

function getIcon(type: string) {
  if (type.startsWith('image/')) return { Icon: Image, color: 'text-text-muted0', bg: 'bg-primary/10' };
  if (type.startsWith('video/')) return { Icon: Film, color: 'text-text-muted0', bg: 'bg-primary/10' };
  if (type.startsWith('audio/')) return { Icon: Music, color: 'text-green-500', bg: 'bg-green-50' };
  if (type.includes('zip') || type.includes('rar')) return { Icon: FileArchive, color: 'text-text-muted0', bg: 'bg-primary/10' };
  return { Icon: FileText, color: 'text-text-muted0', bg: 'bg-surface-hover' };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileAttachments({ entityId }: FileAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY(entityId));
    return saved ? JSON.parse(saved) : [];
  });
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const persist = (updated: Attachment[]) => {
    setAttachments(updated);
    localStorage.setItem(STORAGE_KEY(entityId), JSON.stringify(updated));
  };

  const processFile = useCallback((file: File) => {
    setUploading(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const attachment: Attachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        data: e.target?.result as string,
        uploadedAt: new Date().toLocaleDateString(),
      };
      setAttachments(prev => {
        const updated = [...prev, attachment];
        localStorage.setItem(STORAGE_KEY(entityId), JSON.stringify(updated));
        return updated;
      });
      setUploading(null);
    };
    reader.readAsDataURL(file);
  }, [entityId]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files).forEach(processFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(processFile);
    e.target.value = '';
  };

  const downloadFile = (att: Attachment) => {
    const a = document.createElement('a');
    a.href = att.data;
    a.download = att.name;
    a.click();
  };

  const removeFile = (id: string) => persist(attachments.filter(a => a.id !== id));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Files & Documents</h3>
        <button onClick={() => fileRef.current?.click()} className="text-[11px] font-semibold text-[#0073ea] hover:bg-[#e5f0ff] px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChange} />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all mb-4 ${dragging ? 'border-[#0073ea] bg-[#e5f0ff]/50' : 'border-border hover:border-[#0073ea]/40 hover:bg-surface-hover'}`}
      >
        <Upload className={`w-6 h-6 ${dragging ? 'text-[#0073ea]' : 'text-text-muted'}`} />
        <p className="text-[12px] font-medium text-text-muted0 text-center">
          {uploading ? `Uploading ${uploading}...` : 'Drop files here or click to browse'}
        </p>
      </div>

      {/* File list */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {attachments.map(att => {
            const { Icon, color, bg } = getIcon(att.type);
            return (
              <motion.div key={att.id}
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 p-3 bg-surface-hover border border-border rounded-xl group hover:border-border transition-colors">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                  <Icon className={`w-4.5 h-4.5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-main truncate">{att.name}</p>
                  <p className="text-[11px] text-text-muted">{formatBytes(att.size)} · {att.uploadedAt}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => downloadFile(att)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-muted0 transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeFile(att.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {attachments.length === 0 && (
          <p className="text-[12px] text-text-muted italic text-center py-1">No files attached yet.</p>
        )}
      </div>
    </div>
  );
}
