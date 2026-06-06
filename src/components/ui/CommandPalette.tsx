import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, X, Users, Briefcase, Plus } from 'lucide-react';
import { db, StorageKey } from '../../lib/storage';

export default function CommandPalette({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ type: string, label: string, url: string, icon: any }[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? onClose() : document.dispatchEvent(new CustomEvent('open-command-palette'));
      }
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([
          { type: 'Action', label: 'Create new Contact', url: '/crm/contacts?new=true', icon: Plus },
          { type: 'Action', label: 'Create new Deal', url: '/crm/pipeline?new=true', icon: Plus },
          { type: 'Navigation', label: 'Go to Contacts', url: '/crm/contacts', icon: Users },
          { type: 'Navigation', label: 'Go to Pipeline', url: '/crm/pipeline', icon: Briefcase },
        ]);
        return;
      }

      const q = query.toLowerCase();
      const [contacts, deals] = await Promise.all([
        db.get<any>(StorageKey.CONTACTS),
        db.get<any>(StorageKey.DEALS)
      ]);

      const matchedContacts = contacts
        .filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
        .map(c => ({ type: 'Contact', label: `${c.firstName} ${c.lastName}`, url: `/crm/contacts/${c.id}`, icon: Users }));

      const matchedDeals = deals
        .filter(d => d.title.toLowerCase().includes(q))
        .map(d => ({ type: 'Deal', label: d.title, url: `/crm/pipeline?dealId=${d.id}`, icon: Briefcase }));

      setResults([...matchedContacts, ...matchedDeals].slice(0, 10));
    };

    const debounce = setTimeout(fetchResults, 150);
    return () => clearTimeout(debounce);
  }, [query, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div 
        className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <Search className="w-5 h-5 text-muted shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input 
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full h-14 bg-transparent border-none outline-none px-3 text-lg"
            style={{ color: 'var(--text-main)' }}
          />
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/10 transition-colors">
            <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              No results found for "{query}"
            </div>
          ) : (
            results.map((item, i) => (
              <button
                key={i}
                onClick={() => { navigate(item.url); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors"
                style={{ ':hover': { background: 'var(--surface-hover)' } } as any}
              >
                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0" style={{ color: 'var(--primary)' }}>
                  <item.icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-sm" style={{ color: 'var(--text-main)' }}>{item.label}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.type}</div>
                </div>
              </button>
            ))
          )}
        </div>
        
        <div className="px-4 py-2 text-xs flex items-center gap-4 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg)' }}>
          <span className="flex items-center gap-1"><Command className="w-3 h-3"/> K to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
