import { useState, useRef } from 'react';
import { X, Upload, Search, Image as ImageIcon, CheckCircle2, Sparkles, Plus, Link as LinkIcon } from 'lucide-react';
import { useGenerateAdImage } from '../../hooks/useAdAI';

const INITIAL_MEDIA = [
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
  initialPrompt?: string;
}

export default function MediaLibraryModal({ onClose, onSelect, initialPrompt = '' }: MediaLibraryModalProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'ai'>('library');
  const [media, setMedia] = useState(INITIAL_MEDIA);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlForm, setShowUrlForm] = useState(false);

  // AI Generator state
  const [aiPrompt, setAiPrompt] = useState(initialPrompt);
  const { mutate: generateImage, isPending: isGenerating, error: aiError } = useGenerateAdImage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = media.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const resultUrl = reader.result as string;
      const newImg = {
        id: `upload_${Date.now()}`,
        url: resultUrl,
        name: file.name.replace(/\.[^/.]+$/, ''),
      };
      setMedia(prev => [newImg, ...prev]);
      setSelectedId(newImg.id);
    };
    reader.readAsDataURL(file);
  };

  const handleAddByUrl = () => {
    if (!urlInput.trim()) return;
    const newImg = {
      id: `url_${Date.now()}`,
      url: urlInput.trim(),
      name: 'Web Image',
    };
    setMedia(prev => [newImg, ...prev]);
    setSelectedId(newImg.id);
    setUrlInput('');
    setShowUrlForm(false);
  };

  const handleGenerateAI = () => {
    if (!aiPrompt.trim()) return;
    generateImage(
      { description: aiPrompt.trim() },
      {
        onSuccess: (data) => {
          if (data.url) {
            const newImg = {
              id: `ai_${Date.now()}`,
              url: data.url,
              name: `AI: ${aiPrompt.slice(0, 24)}...`,
            };
            setMedia(prev => [newImg, ...prev]);
            setSelectedId(newImg.id);
            setActiveTab('library');
          }
        },
      }
    );
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
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-text-main">Media Library</h2>
            <div className="flex items-center bg-background border border-border rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === 'library' ? 'bg-surface text-text-main shadow-xs' : 'text-text-muted hover:text-text-main'
                }`}
              >
                Media Assets
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ai')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  activeTab === 'ai' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> AI Generator
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeTab === 'library' ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-background/50 flex-wrap gap-2">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search media..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-semibold text-text-main hover:bg-surface-hover transition-colors shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setShowUrlForm(!showUrlForm)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-semibold text-text-main hover:bg-surface-hover transition-colors shadow-xs"
                >
                  <LinkIcon className="w-3.5 h-3.5" /> Image URL
                </button>
              </div>
            </div>

            {/* URL Input sub-bar */}
            {showUrlForm && (
              <div className="px-6 py-2.5 bg-surface border-b border-border flex items-center gap-2">
                <input
                  type="url"
                  placeholder="Paste image URL (e.g. https://images.unsplash.com/...)"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={e => e.key === 'Enter' && handleAddByUrl()}
                />
                <button
                  type="button"
                  onClick={handleAddByUrl}
                  disabled={!urlInput.trim()}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  Add Image
                </button>
              </div>
            )}

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-6 bg-background">
              {filtered.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted py-12">
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
                          isSelected ? 'border-primary shadow-[0_0_0_4px_rgba(var(--primary-rgb),0.15)] ring-2 ring-primary' : 'border-transparent hover:border-primary/50'
                        }`}
                      >
                        <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-white text-xs font-medium truncate">{m.name}</p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5 text-white shadow-xs">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* AI Generator Tab */
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">
            <div className="max-w-xl mx-auto space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-text-main">Generate Ad Visuals with AI</h3>
                <p className="text-xs text-text-muted">Describe the scene or product aesthetic and AI will create high-converting ad photography.</p>
              </div>

              <div className="space-y-3">
                <textarea
                  rows={4}
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="e.g. Modern kitchen remodel with white marble countertops, warm natural sunlight, high-end residential interior photography, 8k resolution..."
                  className="w-full p-3.5 bg-surface border border-border rounded-xl text-sm text-text-main focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />

                {aiError && (
                  <p className="text-xs text-red-500 font-medium">
                    {(aiError as any)?.message || 'Failed to generate image. Please try another prompt.'}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleGenerateAI}
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Generating High-Res Visual...' : 'Generate Image'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-surface">
          <p className="text-sm text-text-muted">
            {selectedId ? '1 image selected' : 'No image selected'}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-transparent text-text-main rounded-lg text-sm font-semibold hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
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
