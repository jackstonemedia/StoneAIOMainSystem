import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Book, Folder, Settings, MoreHorizontal, Edit, Trash, ExternalLink } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';

export default function InboxHelpCenter() {
  const [activeTab, setActiveTab] = useState<'articles' | 'categories' | 'settings'>('articles');
  
  // Mock data for UI until we build the backend routes for help center
  const portals = [{ id: '1', name: 'Main Help Center', domain: 'help.stoneaio.com' }];
  
  const articles = [
    { id: '1', title: 'Getting Started with Stone AIO', category: 'Onboarding', status: 'published', views: 124 },
    { id: '2', title: 'How to setup Omnichannel', category: 'Configuration', status: 'draft', views: 0 },
    { id: '3', title: 'Billing and Invoices FAQ', category: 'Billing', status: 'published', views: 45 },
  ];

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[#16191D] text-white font-inter">
      {/* Help Center Sidebar */}
      <div className="w-[260px] shrink-0 border-r border-[#2C3036] bg-[#1B1D22] flex flex-col h-full">
        <div className="p-4 border-b border-[#2C3036]">
          <h2 className="text-[15px] font-bold">Help Center</h2>
        </div>
        
        <div className="p-3 space-y-1">
          <button 
            onClick={() => setActiveTab('articles')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${activeTab === 'articles' ? 'bg-[#28364D] text-[#3B82F6]' : 'text-[#A6ADB4] hover:bg-[#2C3036] hover:text-white'}`}
          >
            <Book className="w-4 h-4" /> Articles
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${activeTab === 'categories' ? 'bg-[#28364D] text-[#3B82F6]' : 'text-[#A6ADB4] hover:bg-[#2C3036] hover:text-white'}`}
          >
            <Folder className="w-4 h-4" /> Categories
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${activeTab === 'settings' ? 'bg-[#28364D] text-[#3B82F6]' : 'text-[#A6ADB4] hover:bg-[#2C3036] hover:text-white'}`}
          >
            <Settings className="w-4 h-4" /> Portal Settings
          </button>
        </div>
        
        <div className="mt-auto p-4 border-t border-[#2C3036]">
          <button className="flex items-center gap-2 text-[13px] text-slate-400 hover:text-white transition-colors">
            <ExternalLink className="w-4 h-4" />
            Open Portal
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="h-[60px] border-b border-[#2C3036] flex items-center justify-between px-6 shrink-0 bg-[#16191D]">
          <h1 className="text-[16px] font-bold capitalize">{activeTab}</h1>
          {activeTab === 'articles' && (
            <button className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-[13px] font-semibold px-4 py-1.5 rounded-md flex items-center gap-2 transition-colors">
              <Plus className="w-4 h-4" />
              New Article
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-[#16191D]">
          {activeTab === 'articles' && (
            <div className="bg-[#1B1D22] border border-[#2C3036] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[#2C3036] flex items-center justify-between">
                <div className="relative w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Search articles..." 
                    className="w-full bg-[#16191D] border border-[#2C3036] rounded-md py-2 pl-9 pr-3 text-[13px] text-white focus:outline-none focus:border-[#4f46e5]"
                  />
                </div>
              </div>
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#16191D] border-b border-[#2C3036] text-slate-400">
                  <tr>
                    <th className="font-medium p-4">Title</th>
                    <th className="font-medium p-4">Category</th>
                    <th className="font-medium p-4">Status</th>
                    <th className="font-medium p-4">Views</th>
                    <th className="font-medium p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2C3036]">
                  {articles.map(article => (
                    <tr key={article.id} className="hover:bg-[#2C3036]/30 transition-colors">
                      <td className="p-4 font-medium">{article.title}</td>
                      <td className="p-4 text-slate-400">{article.category}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[11px] font-semibold uppercase ${
                          article.status === 'published' ? 'bg-green-500/10 text-green-500' : 'bg-slate-700/50 text-slate-300'
                        }`}>
                          {article.status}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{article.views}</td>
                      <td className="p-4 flex justify-end gap-2">
                        <button className="p-1.5 text-slate-400 hover:text-white hover:bg-[#2C3036] rounded"><Edit className="w-4 h-4" /></button>
                        <button className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-[#2C3036] rounded"><Trash className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {activeTab === 'categories' && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Folder className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-[14px]">No categories configured.</p>
              <button className="mt-4 text-[#3B82F6] hover:underline text-[13px]">Create a category</button>
            </div>
          )}
          
          {activeTab === 'settings' && (
            <div className="max-w-2xl bg-[#1B1D22] border border-[#2C3036] rounded-xl p-6">
              <h3 className="text-[15px] font-bold mb-4">Portal Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] text-slate-400 mb-1">Portal Name</label>
                  <input type="text" className="w-full bg-[#16191D] border border-[#2C3036] rounded-md py-2 px-3 text-[13px] text-white" defaultValue="Main Help Center" />
                </div>
                <div>
                  <label className="block text-[13px] text-slate-400 mb-1">Custom Domain</label>
                  <input type="text" className="w-full bg-[#16191D] border border-[#2C3036] rounded-md py-2 px-3 text-[13px] text-white" defaultValue="help.stoneaio.com" />
                </div>
                <div>
                  <label className="block text-[13px] text-slate-400 mb-1">Brand Color</label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-[#4f46e5]"></div>
                    <input type="text" className="w-32 bg-[#16191D] border border-[#2C3036] rounded-md py-2 px-3 text-[13px] text-white" defaultValue="#4f46e5" />
                  </div>
                </div>
                <button className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-[13px] font-semibold px-4 py-2 rounded-md mt-2 transition-colors">
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
