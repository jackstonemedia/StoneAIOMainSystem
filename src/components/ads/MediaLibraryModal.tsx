import { useState } from 'react';
import { X, Upload, Search, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

const MOCK_MEDIA = [
  { id: '1', url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=500&q=80', name: 'Real Estate Home 1' },
  { id: '2', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=500&q=80', name: 'Modern House' },
  { id: '3', url: 'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?auto=format&fit=crop&w=500&q=80', name: 'Living Room' },
  { id: '4', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=500&q=80', name: 'Luxury Kitchen' },
  { id: '5', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=500&q=80', name: 'Office Space' },
  { id: '6', url: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=500&q=80', name: 'Roofing Services' },
];

interface MediaLibraryModalProps {
  onClose: () => void;
  onSelect: (url: string) => void;
}

export default function MediaLibraryModal({ onClose, onSelect }: MediaLibraryModalProps) {
  const [media, setMedia] = useState(MOCK_MEDIA);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = media.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  const handleUpload = () => {
    // Simulate upload by prompting for URL
    const url = window.prompt('Enter image URL (e.g. from Unsplash):');
    if (url) {
      const newImg = { id: Math.random().toString(), url, name: 'Uploaded Image' };
      setMedia([newImg, ...media]);
      setSelectedId(newImg.id);
    }
  };

  const handleConfirm = () => {
    const selected = media.find(m => m.id === selectedId);
    if (selected) {
      onSelect(selected.url);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-text-main">Media Library</h2>
            <p className="text-sm text-text-muted">Select or upload creative assets for your ads</p>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/50">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search media..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>
          <button
            onClick={handleUpload}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-sm font-semibold text-text-main hover:bg-surface-hover transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" /> Upload Media
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted">
              <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">No media found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map(m => {
                const isSelected = selectedId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group border-2 transition-all ${
                      isSelected ? 'border-primary shadow-[0_0_0_4px_rgba(var(--primary-rgb),0.1)]' : 'border-transparent hover:border-primary/50'
                    }`}
                  >
                    <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white text-xs font-medium truncate">{m.name}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-white rounded-full">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-surface">
          <p className="text-sm text-text-muted">
            {selectedId ? '1 item selected' : '0 items selected'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-transparent text-text-main rounded-lg text-sm font-semibold hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedId}
              className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Select Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
