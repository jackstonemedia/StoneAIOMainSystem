import { useState, useEffect } from 'react';
import { X, Save, Plus, Type, Image as ImageIcon, Layout, Move } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { db, StorageKey } from '../../lib/storage';

interface PageBuilderProps {
  pageId: string;
  onClose: () => void;
}

const SECTION_TYPES = [
  { type: 'hero', icon: Layout, label: 'Hero Section' },
  { type: 'features', icon: Layout, label: 'Features (3-col)' },
  { type: 'text', icon: Type, label: 'Text Block' },
  { type: 'image', icon: ImageIcon, label: 'Image Block' },
];

export default function PageBuilder({ pageId, onClose }: PageBuilderProps) {
  const [page, setPage] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  useEffect(() => {
    fetchPage();
  }, [pageId]);

  const fetchPage = async () => {
    const data = await db.findById<any>(StorageKey.LANDING_PAGES, pageId);
    if (data) {
      setPage(data);
      try {
        setSections(JSON.parse(data.sectionsJson || '[]'));
      } catch {
        setSections([]);
      }
    }
  };

  const savePage = async () => {
    if (!page) return;
    await db.update(StorageKey.LANDING_PAGES, pageId, { sectionsJson: JSON.stringify(sections) });
    onClose();
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setSections(items);
  };

  const addSection = (type: string) => {
    const newSection = {
      id: crypto.randomUUID(),
      type,
      config: type === 'hero' ? { headline: 'Catchy Headline', subheadline: 'Compelling subheadline goes here.', buttonText: 'Get Started' } :
              type === 'features' ? { items: ['Feature 1', 'Feature 2', 'Feature 3'] } :
              type === 'text' ? { text: 'Add your text here...' } :
              type === 'image' ? { src: 'https://via.placeholder.com/800x400' } : {}
    };
    setSections([...sections, newSection]);
    setSelectedSectionId(newSection.id);
  };

  const updateConfig = (key: string, value: any) => {
    setSections(sections.map(s => s.id === selectedSectionId ? { ...s, config: { ...s.config, [key]: value } } : s));
  };

  if (!page) return null;

  const selectedSection = sections.find(s => s.id === selectedSectionId);

  return (
    <div className="fixed inset-0 z-[100] flex bg-[var(--bg)]">
      {/* Left Sidebar: Sections */}
      <div className="w-[280px] border-r border-[var(--border)] bg-[var(--surface)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-main)] truncate pr-2">{page.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--surface-hover)] rounded-md text-[var(--text-muted)]"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-xs font-semibold uppercase text-[var(--text-muted)] mb-3">Add Section</h3>
          <div className="grid gap-2">
            {SECTION_TYPES.map(st => (
              <button 
                key={st.type}
                onClick={() => addSection(st.type)}
                className="flex items-center gap-3 p-3 border border-[var(--border)] rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-[var(--text-muted)] hover:text-[var(--text-main)] text-left"
              >
                <st.icon className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">{st.label}</span>
                <Plus className="w-4 h-4 ml-auto opacity-50" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Center Canvas */}
      <div className="flex-1 overflow-y-auto bg-black/5 p-8 flex justify-center">
        <div className="w-full max-w-[1000px] bg-white shadow-xl min-h-[800px]">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="page-canvas">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="min-h-[500px]">
                  {sections.map((section, index) => (
                    <Draggable key={section.id} draggableId={section.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          onClick={() => setSelectedSectionId(section.id)}
                          className={`relative group border-2 cursor-pointer ${
                            selectedSectionId === section.id ? 'border-primary' : 'border-transparent hover:border-black/10'
                          } ${snapshot.isDragging ? 'shadow-2xl bg-white' : ''}`}
                        >
                          <div 
                            {...provided.dragHandleProps}
                            className="absolute left-2 top-2 p-1 bg-white rounded shadow opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <Move className="w-4 h-4 text-gray-500" />
                          </div>
                          
                          {/* Render Section based on type */}
                          {section.type === 'hero' && (
                            <div className="py-20 px-8 text-center bg-gray-50">
                              <h1 className="text-5xl font-extrabold text-gray-900 mb-6">{section.config.headline}</h1>
                              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">{section.config.subheadline}</p>
                              <button className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg">{section.config.buttonText}</button>
                            </div>
                          )}
                          
                          {section.type === 'features' && (
                            <div className="py-16 px-8">
                              <div className="grid grid-cols-3 gap-8">
                                {section.config.items?.map((item: string, i: number) => (
                                  <div key={i} className="text-center p-6 bg-gray-50 rounded-xl">
                                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4"><Layout className="w-6 h-6" /></div>
                                    <h3 className="font-semibold text-lg">{item}</h3>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {section.type === 'text' && (
                            <div className="py-12 px-8 max-w-3xl mx-auto text-lg text-gray-700 whitespace-pre-wrap">
                              {section.config.text}
                            </div>
                          )}

                          {section.type === 'image' && (
                            <div className="py-8 px-8">
                              <img src={section.config.src} alt="" className="w-full max-w-4xl mx-auto rounded-xl shadow-lg" />
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>

      {/* Right Sidebar: Properties */}
      <div className="w-[300px] border-l border-[var(--border)] bg-[var(--surface)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
          <h3 className="font-semibold text-[var(--text-main)]">Properties</h3>
          <div className="flex gap-2">
            <button onClick={() => db.update(StorageKey.LANDING_PAGES, pageId, { status: 'published' }).then(savePage)} className="px-3 py-1.5 bg-primary text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity">Publish</button>
            <button onClick={savePage} className="px-3 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-main)] rounded-md text-sm font-medium hover:bg-[var(--border)] transition-colors">Save</button>
          </div>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          {selectedSection ? (
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase text-[var(--text-muted)] mb-4">{selectedSection.type} Settings</div>
              
              {selectedSection.type === 'hero' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Headline</label>
                    <input type="text" value={selectedSection.config.headline} onChange={e => updateConfig('headline', e.target.value)} className="w-full p-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded text-[var(--text-main)] outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Subheadline</label>
                    <textarea value={selectedSection.config.subheadline} onChange={e => updateConfig('subheadline', e.target.value)} className="w-full p-2 h-20 text-sm bg-[var(--bg)] border border-[var(--border)] rounded text-[var(--text-main)] outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Button Text</label>
                    <input type="text" value={selectedSection.config.buttonText} onChange={e => updateConfig('buttonText', e.target.value)} className="w-full p-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded text-[var(--text-main)] outline-none" />
                  </div>
                </>
              )}

              {selectedSection.type === 'text' && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Text Content</label>
                  <textarea value={selectedSection.config.text} onChange={e => updateConfig('text', e.target.value)} className="w-full p-2 h-40 text-sm bg-[var(--bg)] border border-[var(--border)] rounded text-[var(--text-main)] outline-none" />
                </div>
              )}

              {selectedSection.type === 'image' && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Image URL</label>
                  <input type="text" value={selectedSection.config.src} onChange={e => updateConfig('src', e.target.value)} className="w-full p-2 text-sm bg-[var(--bg)] border border-[var(--border)] rounded text-[var(--text-main)] outline-none" />
                </div>
              )}

              <div className="pt-6 border-t border-[var(--border)] mt-6">
                <button 
                  onClick={() => {
                    setSections(sections.filter(s => s.id !== selectedSection.id));
                    setSelectedSectionId(null);
                  }}
                  className="w-full py-2 text-red-500 border border-red-500/30 hover:bg-red-500/10 rounded-md text-sm transition-colors"
                >
                  Remove Section
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-[var(--text-muted)] text-sm mt-10">Select a section to edit.</div>
          )}
        </div>
      </div>
    </div>
  );
}
