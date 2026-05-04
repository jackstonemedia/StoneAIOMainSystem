import { useRef, useState } from 'react';
import { Upload, File, Image, FileText, Trash2, Download, RefreshCw, X } from 'lucide-react';
import { useToast } from '../ui/Toast';

interface Props { contactId: string; workspaceId?: string; }

interface FileItem {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: string;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith('image/')) return <Image className="w-5 h-5 text-blue-400" />;
  if (type === 'application/pdf') return <FileText className="w-5 h-5 text-red-400" />;
  return <File className="w-5 h-5 text-text-muted" />;
}

export default function ContactFilesTab({ contactId }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    const newFiles: FileItem[] = Array.from(fileList).map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      url: URL.createObjectURL(f),
      type: f.type || 'application/octet-stream',
      size: f.size,
      createdAt: new Date().toISOString(),
    }));
    await new Promise(r => setTimeout(r, 800));
    setFiles(prev => [...newFiles, ...prev]);
    setUploading(false);
    toast('success', `${newFiles.length} file${newFiles.length > 1 ? 's' : ''} uploaded`);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleDelete = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    toast('success', 'File removed');
  };

  const images = files.filter(f => f.type.startsWith('image/'));
  const docs = files.filter(f => !f.type.startsWith('image/'));

  return (
    <div className="space-y-5">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-[10px] p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-surface-hover/30'}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <p className="text-[13px] font-semibold text-text-muted">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-text-muted/40" />
            <p className="text-[13px] font-semibold text-text-main">Drop files here or click to upload</p>
            <p className="text-[11px] text-text-muted">Supports images, PDFs, documents, and more</p>
          </div>
        )}
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Images</p>
          <div className="grid grid-cols-3 gap-2">
            {images.map(f => (
              <div key={f.id} className="relative group rounded-[8px] overflow-hidden border border-border aspect-square bg-bg">
                <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a href={f.url} download={f.name} className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors" onClick={e => e.stopPropagation()}>
                    <Download className="w-3.5 h-3.5 text-white" />
                  </a>
                  <button onClick={() => handleDelete(f.id)} className="w-7 h-7 bg-red-500/20 hover:bg-red-500/40 rounded-full flex items-center justify-center transition-colors">
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 backdrop-blur-sm">
                  <p className="text-[10px] text-white font-medium truncate">{f.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents List */}
      {docs.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Documents</p>
          <div className="space-y-1.5">
            {docs.map(f => (
              <div key={f.id} className="flex items-center gap-3 p-3 bg-bg border border-border rounded-[8px] group hover:border-primary/30 transition-colors">
                <FileIcon type={f.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-main truncate">{f.name}</p>
                  <p className="text-[11px] text-text-muted">{formatBytes(f.size)} · {new Date(f.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={f.url} download={f.name} className="w-7 h-7 rounded-[4px] border border-border flex items-center justify-center text-text-muted hover:text-primary hover:border-primary transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => handleDelete(f.id)} className="w-7 h-7 rounded-[4px] border border-border flex items-center justify-center text-text-muted hover:text-red-400 hover:border-red-400/30 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length === 0 && !uploading && (
        <div className="text-center py-4">
          <p className="text-[12px] text-text-muted">No files attached yet. Upload files to share with this contact.</p>
        </div>
      )}
    </div>
  );
}
