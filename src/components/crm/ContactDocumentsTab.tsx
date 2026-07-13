import { useState } from 'react';
import { Search, FileText, UploadCloud, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export default function ContactDocumentsTab({ contactId }: { contactId: string }) {
  const [activeTab, setActiveTab] = useState<'All' | 'Internal' | 'Sent' | 'Received'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [uploadSection, setUploadSection] = useState('Internal');

  return (
    <div className="flex flex-col h-full min-h-[400px] bg-transparent">
      {/* Header Search & Tabs */}
      <div className="space-y-3 mb-6 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by document name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-border/50 rounded-[6px] pl-9 pr-3 py-1.5 text-[13px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50"
          />
        </div>
        
        <div className="flex bg-surface border border-border/50 rounded-[6px] p-0.5">
          {['All', 'Internal', 'Sent', 'Received'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 text-[12px] font-semibold py-1.5 rounded-[4px] transition-colors ${
                activeTab === tab 
                  ? 'bg-bg text-text-main shadow-sm' 
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      <div className="flex-1 flex flex-col items-center justify-center text-center my-auto min-h-[50vh]">
        <div className="w-10 h-10 bg-surface border border-border/50 rounded-[10px] flex items-center justify-center mb-4">
          <FileText className="w-5 h-5 text-text-main" />
        </div>
        <h3 className="text-[14px] font-bold text-text-main mb-1">No documents yet</h3>
        <p className="text-[13px] text-text-muted mb-4 max-w-[220px] leading-relaxed">
          Upload or send documents to see them listed here.
        </p>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-1.5 bg-surface border border-border rounded-[6px] text-[12px] font-semibold text-text-main hover:bg-surface-hover transition-colors"
        >
          Add documents
        </button>
      </div>

      {/* Add Documents Modal */}
      <Dialog.Root open={isAddOpen} onOpenChange={setIsAddOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-[100] grid w-full max-w-[500px] translate-x-[-50%] translate-y-[-50%] bg-bg border border-border shadow-lg sm:rounded-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <Dialog.Title className="text-[15px] font-bold text-text-main">
                  Add documents
                </Dialog.Title>
              </div>
              <Dialog.Close className="text-text-muted hover:text-text-main transition-colors">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-[13px] text-text-muted">Upload up to 10 documents</p>
              
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-text-main">Section</label>
                <select 
                  value={uploadSection}
                  onChange={(e) => setUploadSection(e.target.value)}
                  className="w-full bg-surface border border-border/50 rounded-[6px] px-3 py-2 text-[13px] text-text-main focus:outline-none focus:border-primary/50"
                >
                  <option value="Internal">Internal</option>
                  <option value="Sent">Sent</option>
                  <option value="Received">Received</option>
                </select>
              </div>

              <div className="border border-dashed border-border/80 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-hover/50 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-5 h-5 text-text-main" />
                </div>
                <p className="text-[13px] font-medium text-text-main mb-1">Drag and drop files, or click to upload</p>
                <p className="text-[11px] text-text-muted">DOC, PNG, JPG, GIF, PPT, or PDF (max 250 MB each)</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-surface/30 rounded-b-xl">
              <Dialog.Close className="px-4 py-2 border border-border rounded-[6px] text-[13px] font-semibold text-text-main hover:bg-surface-hover transition-colors">
                Cancel
              </Dialog.Close>
              <button 
                className="px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-bold hover:bg-primary-hover transition-colors"
                onClick={() => setIsAddOpen(false)}
              >
                Upload
              </button>
            </div>
            
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
