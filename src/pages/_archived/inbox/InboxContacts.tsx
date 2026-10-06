import { useState } from 'react';
import { Search, Plus, Filter, Download, MoreHorizontal, Mail, Phone, MapPin, Building } from 'lucide-react';

export default function InboxContacts() {
  const [activeSegment, setActiveSegment] = useState('all');
  
  // Mock data for UI
  const contacts = [
    { id: '1', name: 'John Doe', email: 'john@example.com', phone: '+1 555-123-4567', company: 'Acme Corp', lastSeen: '2 hours ago' },
    { id: '2', name: 'Jane Smith', email: 'jane.smith@design.co', phone: '+44 7700 900077', company: 'Design Co', lastSeen: '1 day ago' },
    { id: '3', name: 'Robert Johnson', email: 'robert@techstart.io', phone: '', company: 'TechStart', lastSeen: '3 days ago' },
  ];

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[#16191D] text-white font-inter">
      {/* Contacts Sidebar */}
      <div className="w-[260px] shrink-0 border-r border-[#2C3036] bg-[#1B1D22] flex flex-col h-full">
        <div className="p-4 border-b border-[#2C3036] flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Contacts</h2>
          <button className="p-1 hover:bg-[#2C3036] rounded text-slate-400 hover:text-white">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-3 space-y-1">
          <p className="px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Segments</p>
          <button 
            onClick={() => setActiveSegment('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${activeSegment === 'all' ? 'bg-[#28364D] text-[#3B82F6]' : 'text-[#A6ADB4] hover:bg-[#2C3036] hover:text-white'}`}
          >
            All Contacts
            <span className="bg-[#2C3036] text-slate-300 px-2 py-0.5 rounded text-[11px]">1,245</span>
          </button>
          <button 
            onClick={() => setActiveSegment('active')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${activeSegment === 'active' ? 'bg-[#28364D] text-[#3B82F6]' : 'text-[#A6ADB4] hover:bg-[#2C3036] hover:text-white'}`}
          >
            Recently Active
            <span className="bg-[#2C3036] text-slate-300 px-2 py-0.5 rounded text-[11px]">342</span>
          </button>
          <button 
            onClick={() => setActiveSegment('customers')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${activeSegment === 'customers' ? 'bg-[#28364D] text-[#3B82F6]' : 'text-[#A6ADB4] hover:bg-[#2C3036] hover:text-white'}`}
          >
            Paid Customers
            <span className="bg-[#2C3036] text-slate-300 px-2 py-0.5 rounded text-[11px]">89</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="h-[60px] border-b border-[#2C3036] flex items-center justify-between px-6 shrink-0 bg-[#16191D]">
          <h1 className="text-[16px] font-bold">All Contacts</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search contacts..." 
                className="w-[300px] bg-[#1B1D22] border border-[#2C3036] rounded-md py-1.5 pl-9 pr-3 text-[13px] text-white focus:outline-none focus:border-[#4f46e5]"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-[#1B1D22] border border-[#2C3036] rounded-md text-[13px] text-slate-300 hover:text-white hover:border-slate-500 transition-colors">
              <Filter className="w-4 h-4" /> Filter
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-[#1B1D22] border border-[#2C3036] rounded-md text-[13px] text-slate-300 hover:text-white hover:border-slate-500 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
            <button className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-[13px] font-semibold px-4 py-1.5 rounded-md flex items-center gap-2 transition-colors ml-2">
              <Plus className="w-4 h-4" />
              New Contact
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-[#16191D]">
          <div className="bg-[#1B1D22] border border-[#2C3036] rounded-xl overflow-hidden">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#16191D] border-b border-[#2C3036] text-slate-400">
                <tr>
                  <th className="font-medium p-4 pl-6">Name</th>
                  <th className="font-medium p-4">Email / Phone</th>
                  <th className="font-medium p-4">Company</th>
                  <th className="font-medium p-4">Last Seen</th>
                  <th className="font-medium p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C3036]">
                {contacts.map(contact => (
                  <tr key={contact.id} className="hover:bg-[#2C3036]/30 transition-colors cursor-pointer group">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-[12px]">
                          {contact.name.charAt(0)}
                        </div>
                        <span className="font-medium group-hover:text-[#3B82F6] transition-colors">{contact.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-400">
                      <div className="flex flex-col gap-1">
                        {contact.email && (
                          <span className="flex items-center gap-2"><Mail className="w-3 h-3 text-slate-500" /> {contact.email}</span>
                        )}
                        {contact.phone && (
                          <span className="flex items-center gap-2"><Phone className="w-3 h-3 text-slate-500" /> {contact.phone}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-400">
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-slate-500" />
                        {contact.company}
                      </div>
                    </td>
                    <td className="p-4 text-slate-400">{contact.lastSeen}</td>
                    <td className="p-4 pr-6 text-right">
                      <button className="p-1.5 text-slate-400 hover:text-white hover:bg-[#2C3036] rounded"><MoreHorizontal className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
