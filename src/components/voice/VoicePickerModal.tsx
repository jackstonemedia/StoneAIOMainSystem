import { useState, useEffect } from 'react';
import { X, Search, Play, ChevronRight, ChevronLeft, Check, Plus } from 'lucide-react';

interface VoiceEntry {
  voice_id: string;
  voice_name: string;
  gender: 'male' | 'female';
  provider: string;
  accent?: string;
  age?: string;
  preview_audio_url?: string;
}

interface VoicePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoiceId: string;
  onSelect: (voiceId: string, voiceName: string) => void;
}

const PROVIDER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'elevenlabs', label: 'ElevenLabs' },
  { key: 'cartesia', label: 'Cartesia' },
  { key: 'openai', label: 'OpenAI' },
  { key: 'minimax', label: 'MiniMax' },
  { key: 'fish_audio', label: 'Fish Audio' },
  { key: 'platform', label: 'Platform' },
];

export default function VoicePickerModal({ isOpen, onClose, selectedVoiceId, onSelect }: VoicePickerModalProps) {
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'platform' | 'custom'>('platform');
  const [providerFilter, setProviderFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioRef] = useState(() => new Audio());

  useEffect(() => {
    if (!isOpen) return;
    fetchVoices();
  }, [isOpen]);

  const fetchVoices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/voice-agents/voices');
      if (res.ok) {
        const data = await res.json();
        setVoices(data);
      }
    } catch (e) {
      console.error('Failed to fetch voices:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredVoices = voices.filter(v => {
    if (providerFilter !== 'all' && v.provider !== providerFilter) return false;
    if (genderFilter !== 'all' && v.gender !== genderFilter) return false;
    if (searchQuery && !v.voice_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const recommendedVoices = filteredVoices.slice(0, 6);

  const playPreview = (voice: VoiceEntry) => {
    if (playingId === voice.voice_id) {
      audioRef.pause();
      setPlayingId(null);
      return;
    }
    if (voice.preview_audio_url) {
      audioRef.src = voice.preview_audio_url;
      audioRef.play().catch(() => {});
      setPlayingId(voice.voice_id);
      audioRef.onended = () => setPlayingId(null);
    }
  };

  if (!isOpen) return null;

  const avatarColors = [
    'from-pink-400 to-purple-500',
    'from-blue-400 to-cyan-500',
    'from-amber-400 to-orange-500',
    'from-green-400 to-emerald-500',
    'from-violet-400 to-indigo-500',
    'from-rose-400 to-pink-500',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-[860px] max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold">Select Voice</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-hover rounded-lg transition-colors">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Platform / Custom Tabs */}
        <div className="flex border-b border-border px-6">
          <button onClick={() => setActiveTab('platform')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'platform' ? 'text-primary border-primary' : 'text-text-muted border-transparent hover:text-text-main'}`}>
            Platform Voices
          </button>
          <button onClick={() => setActiveTab('custom')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'custom' ? 'text-primary border-primary' : 'text-text-muted border-transparent hover:text-text-main'}`}>
            Custom Providers
          </button>
        </div>

        {/* Provider Sub-tabs */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-border overflow-x-auto">
          {PROVIDER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setProviderFilter(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-full font-medium whitespace-nowrap transition-colors ${providerFilter === tab.key ? 'bg-primary text-white' : 'text-text-muted hover:bg-bg hover:text-text-main'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors">
            <Plus className="w-3 h-3" /> Add custom voice
          </button>
          <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}
            className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs focus:outline-none">
            <option value="all">Gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
          <select className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs focus:outline-none">
            <option>Accent</option>
          </select>
          <select className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs focus:outline-none">
            <option>Types</option>
          </select>
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-1.5 bg-bg border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Recommended Voices Carousel */}
              {recommendedVoices.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Recommended Voices</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {recommendedVoices.map((voice, i) => (
                      <button key={voice.voice_id}
                        onClick={() => onSelect(voice.voice_id, voice.voice_name)}
                        className={`flex-shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${selectedVoiceId === voice.voice_id ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-bg hover:border-primary/30'}`}>
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-xs font-bold`}>
                          {voice.voice_name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-semibold block">{voice.voice_name}</span>
                          <span className="text-[10px] text-text-muted">{voice.accent || voice.provider} · {voice.age || voice.gender}</span>
                        </div>
                        {selectedVoiceId === voice.voice_id && <Check className="w-4 h-4 text-primary ml-1" />}
                        <button onClick={(e) => { e.stopPropagation(); playPreview(voice); }}
                          className="p-1 hover:bg-surface-hover rounded-full ml-1">
                          <Play className={`w-3 h-3 ${playingId === voice.voice_id ? 'text-primary' : 'text-text-muted'}`} />
                        </button>
                      </button>
                    ))}
                    <button className="flex-shrink-0 p-2 text-text-muted hover:text-text-main">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Voice Table */}
              <div>
                <div className="grid grid-cols-[2fr_2fr_2fr] gap-4 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border">
                  <span>Voice</span>
                  <span>Trait</span>
                  <span>Voice ID</span>
                </div>
                <div className="divide-y divide-border">
                  {filteredVoices.map((voice) => (
                    <button key={voice.voice_id}
                      onClick={() => onSelect(voice.voice_id, voice.voice_name)}
                      className={`w-full grid grid-cols-[2fr_2fr_2fr] gap-4 px-3 py-3 text-left hover:bg-bg/50 transition-colors items-center ${selectedVoiceId === voice.voice_id ? 'bg-primary/5' : ''}`}>
                      <div className="flex items-center gap-2.5">
                        <button onClick={(e) => { e.stopPropagation(); playPreview(voice); }}
                          className="p-1 hover:bg-surface-hover rounded-full flex-shrink-0">
                          <Play className={`w-3.5 h-3.5 ${playingId === voice.voice_id ? 'text-primary' : 'text-text-muted'}`} />
                        </button>
                        <span className="text-xs font-medium">{voice.voice_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {voice.accent && <span className="text-[10px] px-1.5 py-0.5 bg-bg border border-border rounded">{voice.accent}</span>}
                        {voice.age && <span className="text-[10px] px-1.5 py-0.5 bg-bg border border-border rounded">{voice.age}</span>}
                        <span className="text-[10px] px-1.5 py-0.5 bg-bg border border-border rounded capitalize">{voice.provider}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-muted font-mono">{voice.voice_id}</span>
                        {selectedVoiceId === voice.voice_id && <Check className="w-4 h-4 text-primary" />}
                      </div>
                    </button>
                  ))}
                  {filteredVoices.length === 0 && (
                    <div className="py-8 text-center text-text-muted text-xs">
                      {voices.length === 0 ? 'Loading voices from Retell...' : 'No voices match your filters.'}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
