import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useInbox } from '../context/InboxContext';
import { useInboxConversations } from '../hooks/useInboxConversations';
import type { InboxConversation } from '../types/inbox';
import { 
  Filter, 
  ArrowDownUp, 
  ArrowRightToLine, 
  MessageSquare,
  SearchCode
} from 'lucide-react';

const ChannelIcons: Record<string, any> = {
  live_chat: MessageSquare,
  email: SearchCode,
  sms: MessageSquare,
};

export default function ConversationList() {
  const {
    activeView, setActiveView, statusFilter, inboxChannelId, teamId, labelId,
    selectedConversationId, setSelectedConversationId,
    searchQuery
  } = useInbox();

  const filters = {
    status: statusFilter !== 'all' ? statusFilter : undefined,
    assignedUserId: activeView === 'mine' ? 'me' : activeView === 'unassigned' ? 'unassigned' : undefined,
    inboxChannelId: inboxChannelId ?? undefined,
    teamId: teamId ?? undefined,
    labelId: labelId ?? undefined,
    q: searchQuery || undefined,
  };

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInboxConversations(filters);

  const conversations: InboxConversation[] = data?.pages.flatMap(p => p.conversations) ?? [];

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Derived counts for the tabs (in a real app, these would come from an API summary endpoint)
  const mineCount = 11;
  const unassignedCount = 5;
  const allCount = 18;

  return (
    <div className="w-[340px] shrink-0 border-r border-[#2C3036] bg-[#16191D] flex flex-col h-full font-inter">
      {/* Header */}
      <div className="border-b border-[#2C3036] shrink-0">
        <div className="h-[60px] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <h3 className="text-[18px] font-bold text-white">Conversations</h3>
            <span className="text-[11px] font-semibold bg-[#2C3036] text-slate-300 px-2 py-0.5 rounded uppercase">Open</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#2C3036] transition-colors" title="Filter">
              <Filter className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#2C3036] transition-colors" title="Sort">
              <ArrowDownUp className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#2C3036] transition-colors" title="Collapse">
              <ArrowRightToLine className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Top Tabs */}
        <div className="flex px-4 gap-4 mt-2">
          <button 
            onClick={() => setActiveView('mine')}
            className={`pb-3 text-[14px] font-medium flex items-center gap-1.5 border-b-2 transition-colors ${activeView === 'mine' ? 'border-[#3B82F6] text-[#3B82F6]' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            Mine <span className="bg-[#28364D] text-[#3B82F6] text-[10px] px-1.5 py-0.5 rounded-full">{mineCount}</span>
          </button>
          <button 
            onClick={() => setActiveView('unassigned')}
            className={`pb-3 text-[14px] font-medium flex items-center gap-1.5 border-b-2 transition-colors ${activeView === 'unassigned' ? 'border-[#3B82F6] text-[#3B82F6]' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            Unassigned <span className="bg-[#2C3036] text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full">{unassignedCount}</span>
          </button>
          <button 
            onClick={() => setActiveView('all')}
            className={`pb-3 text-[14px] font-medium flex items-center gap-1.5 border-b-2 transition-colors ${activeView === 'all' ? 'border-[#3B82F6] text-[#3B82F6]' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            All <span className="bg-[#2C3036] text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full">{allCount}</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading && (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {conversations.map((conv) => {
          const ChannelIcon = ChannelIcons[conv.inboxChannel?.channelType || 'live_chat'] || MessageSquare;
          
          return (
            <button
              key={conv.id}
              onClick={() => setSelectedConversationId(conv.id)}
              className={`w-full text-left transition-colors group flex items-start p-4 ${
                selectedConversationId === conv.id
                  ? 'bg-[#2C3036] border-l-2 border-[#3B82F6]'
                  : 'hover:bg-[#2C3036]/50 border-l-2 border-transparent'
              }`}
            >
              {/* Avatar section */}
              <div className="relative mr-3 shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-white text-zinc-950 border border-white/20 flex items-center justify-center shadow-sm">
                  {conv.inboxContact?.avatarUrl ? (
                    <img src={conv.inboxContact.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-zinc-950 text-sm font-bold">
                      {(conv.inboxContact?.name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {/* Channel Icon Badge */}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#1B1D22] rounded-full flex items-center justify-center p-0.5 border border-[#2C3036]">
                  <ChannelIcon className="w-2.5 h-2.5 text-slate-300" />
                </div>
              </div>

              {/* Content section */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5">
                  <ChannelIcon className="w-3 h-3 text-slate-500" />
                  <span className="text-[11px] text-slate-500 truncate">{conv.inboxChannel?.name || 'Unknown Channel'}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {conv.unreadCount > 0 && <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>}
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[14px] font-bold text-white truncate">
                    {conv.inboxContact?.name || conv.inboxContact?.email || `#${conv.displayId}`}
                  </span>
                  <span className="text-[11px] text-slate-500 shrink-0">
                    {conv.lastActivityAt ? formatDistanceToNow(new Date(conv.lastActivityAt), { addSuffix: true }) : ''}
                  </span>
                </div>

                <p className="text-[13px] text-slate-400 line-clamp-1 mb-2">
                  {conv.subject || 'No subject'}
                </p>

                {/* Labels */}
                <div className="flex flex-wrap gap-1">
                  {conv.labels?.slice(0, 2).map((label) => (
                    <span
                      key={label.id}
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white flex items-center gap-1"
                      style={{ background: '#2C3036' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: label.color || '#94a3b8' }}></span>
                      {label.title}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  );
}
