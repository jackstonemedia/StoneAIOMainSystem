import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Search, MoreVertical, Trash2 } from 'lucide-react';
import { NotionEditor } from '../../components/editor/NotionEditor';

interface Document {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export default function Documents() {
  const queryClient = useQueryClient();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch documents list
  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ['crm', 'documents'],
    queryFn: async () => {
      const res = await fetch('/api/crm/documents');
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    }
  });

  // Fetch single document content
  const { data: selectedDoc } = useQuery({
    queryKey: ['crm', 'documents', selectedDocId],
    queryFn: async () => {
      if (!selectedDocId) return null;
      const res = await fetch(`/api/crm/documents/${selectedDocId}`);
      if (!res.ok) throw new Error('Failed to fetch document');
      return res.json();
    },
    enabled: !!selectedDocId
  });

  const createDoc = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/crm/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Document', content: '' })
      });
      return res.json();
    },
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'documents'] });
      setSelectedDocId(newDoc.id);
    }
  });

  const updateDoc = useMutation({
    mutationFn: async (data: { id: string; title: string; content: string }) => {
      const res = await fetch(`/api/crm/documents/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'documents'] });
    }
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/crm/documents/${id}`, { method: 'DELETE' });
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'documents'] });
      if (selectedDocId === deletedId) setSelectedDocId(null);
    }
  });

  // Debounced auto-save for content
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');

  useEffect(() => {
    if (selectedDoc) {
      setLocalTitle(selectedDoc.title);
      setLocalContent(selectedDoc.content || '');
    }
  }, [selectedDoc]);

  useEffect(() => {
    if (!selectedDocId) return;
    const timer = setTimeout(() => {
      if (localTitle !== selectedDoc?.title || localContent !== selectedDoc?.content) {
        updateDoc.mutate({ id: selectedDocId, title: localTitle, content: localContent });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [localTitle, localContent, selectedDocId]);

  const filteredDocs = documents.filter(d => d.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex w-full h-full bg-bg text-text-main overflow-hidden">
      
      {/* Sidebar */}
      <div className="w-[280px] flex-shrink-0 bg-surface border-r border-border flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-text-main">Documents</h2>
          <button 
            onClick={() => createDoc.mutate()}
            disabled={createDoc.isPending}
            className="p-1.5 hover:bg-surface-hover rounded-[6px] text-text-muted hover:text-text-main transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search documents..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface-hover border-0 rounded-[6px] text-[13px] text-text-main placeholder:text-text-muted focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {isLoading ? (
            <div className="p-4 text-[13px] text-text-muted text-center">Loading...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-4 text-[13px] text-text-muted text-center">No documents found.</div>
          ) : (
            filteredDocs.map(doc => (
              <div 
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`flex items-center justify-between group px-3 py-2 rounded-[6px] cursor-pointer text-[13px] transition-colors ${selectedDocId === doc.id ? 'bg-primary/10 text-primary font-medium' : 'text-text-main hover:bg-surface-hover'}`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className={`w-4 h-4 flex-shrink-0 ${selectedDocId === doc.id ? 'text-primary' : 'text-text-muted'}`} />
                  <span className="truncate">{doc.title || 'Untitled'}</span>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this document?')) deleteDoc.mutate(doc.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-red-500 transition-all rounded-[4px]"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 overflow-y-auto bg-bg h-full">
        {selectedDocId && selectedDoc ? (
          <div className="max-w-[900px] mx-auto py-12 px-8 md:px-16 pb-32 min-h-full">
            <input 
              type="text"
              value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              placeholder="Document Title"
              className="w-full text-4xl font-bold bg-transparent border-0 outline-none focus:ring-0 text-text-main placeholder:text-text-muted/30 mb-8 p-0"
            />
            <div className="documents-editor-container">
              <NotionEditor 
                content={localContent}
                onChange={(html) => setLocalContent(html)}
                placeholder="Press '/' for commands, or start typing..."
                minHeight="min-h-[500px]"
              />
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-text-muted space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center border border-border shadow-sm">
              <FileText className="w-8 h-8 text-text-muted/50" />
            </div>
            <p className="text-[14px]">Select a document or create a new one</p>
            <button 
              onClick={() => createDoc.mutate()}
              className="px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold hover:opacity-90 transition-opacity"
            >
              Create Document
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
