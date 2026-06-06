import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppWindow, FileText, Plus, Search, Filter, Trash2, Edit2, Copy, Globe, Eye } from 'lucide-react';
import { db, StorageKey } from '../../lib/storage';
import PageBuilder from '../../components/marketing/PageBuilder';

export default function Sites() {
  const [activeTab, setActiveTab] = useState<'landing-pages' | 'forms'>('landing-pages');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'landing-pages' || tab === 'forms') setActiveTab(tab);
  }, [location.search]);

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const fetchItems = async () => {
    const key = activeTab === 'landing-pages' ? StorageKey.LANDING_PAGES : StorageKey.FORMS;
    const data = await db.get<any>(key);
    setItems(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const createItem = async () => {
    const key = activeTab === 'landing-pages' ? StorageKey.LANDING_PAGES : StorageKey.FORMS;
    if (activeTab === 'landing-pages') {
      const newItem = await db.insert(key, {
        name: 'New Landing Page',
        slug: `page-${Math.random().toString(36).substring(7)}`,
        status: 'draft',
        sectionsJson: '[]'
      });
      setSelectedItemId(newItem.id);
      setBuilderOpen(true);
    } else {
      const newItem = await db.insert(key, {
        name: 'New Form',
        fieldsJson: '[]',
        active: false
      });
      fetchItems();
      // Form builder would go here, maybe modal or same builder architecture.
    }
  };

  const deleteItem = async (id: string) => {
    const key = activeTab === 'landing-pages' ? StorageKey.LANDING_PAGES : StorageKey.FORMS;
    await db.delete(key, id);
    fetchItems();
  };

  const filtered = items.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-[var(--bg)]">
      <div className="px-6 py-6 border-b border-[var(--border)] flex items-center justify-between shrink-0 bg-[var(--surface)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Sites & Forms</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Manage landing pages and lead capture forms.</p>
        </div>
        <button 
          onClick={createItem}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Create {activeTab === 'landing-pages' ? 'Page' : 'Form'}
        </button>
      </div>

      <div className="flex items-center gap-6 px-6 border-b border-[var(--border)] bg-[var(--surface)]">
        <button
          onClick={() => { setActiveTab('landing-pages'); navigate('?tab=landing-pages', { replace: true }); }}
          className={`flex items-center gap-2 px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'landing-pages' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <AppWindow className="w-4 h-4" /> Landing Pages
        </button>
        <button
          onClick={() => { setActiveTab('forms'); navigate('?tab=forms', { replace: true }); }}
          className={`flex items-center gap-2 px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'forms' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <FileText className="w-4 h-4" /> Forms
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input 
              type="text"
              placeholder={`Search ${activeTab === 'landing-pages' ? 'pages' : 'forms'}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm outline-none text-[var(--text-main)] focus:border-primary transition-colors"
            />
          </div>
          <button className="p-2 border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(item => (
            <div 
              key={item.id} 
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:border-primary/50 transition-colors group flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center shrink-0">
                {activeTab === 'landing-pages' ? <AppWindow className="w-6 h-6 text-primary" /> : <FileText className="w-6 h-6 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="truncate pr-4">
                    <h3 className="font-semibold text-[var(--text-main)] truncate">{item.name}</h3>
                    {activeTab === 'landing-pages' && (
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-1">
                        <Globe className="w-3.5 h-3.5" /> /{item.slug}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {activeTab === 'landing-pages' && (
                      <>
                        <button 
                          onClick={() => { setSelectedItemId(item.id); setBuilderOpen(true); }}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <a 
                          href={`/p/${item.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] rounded"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      </>
                    )}
                    <button 
                      onClick={() => deleteItem(item.id)}
                      className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 mt-4 text-xs font-medium">
                  {activeTab === 'landing-pages' && (
                    <span className={`px-2 py-0.5 rounded-full ${item.status === 'published' ? 'bg-green-500/10 text-green-500' : 'bg-black/10 text-[var(--text-muted)]'}`}>
                      {item.status.toUpperCase()}
                    </span>
                  )}
                  {activeTab === 'forms' && (
                    <span className={`px-2 py-0.5 rounded-full ${item.active ? 'bg-green-500/10 text-green-500' : 'bg-black/10 text-[var(--text-muted)]'}`}>
                      {item.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  )}
                  <span className="text-[var(--text-muted)]">
                    Created {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-[var(--text-muted)]">
              No {activeTab} found. 
            </div>
          )}
        </div>
      </div>

      {builderOpen && selectedItemId && activeTab === 'landing-pages' && (
        <PageBuilder 
          pageId={selectedItemId} 
          onClose={() => { setBuilderOpen(false); fetchItems(); }} 
        />
      )}
    </div>
  );
}
