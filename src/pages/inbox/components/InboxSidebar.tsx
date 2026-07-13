import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Inbox, MessageSquare, AtSign, Clock, Folder, Users, Hash, 
  ChevronDown, ChevronRight, Settings, Plus, Search, CheckCircle, SearchCode
} from 'lucide-react';
import { useInbox } from '../context/InboxContext';
import { useQuery } from '@tanstack/react-query';
import { inboxApi } from '../lib/api/inbox';

// Custom icons based on the screenshot
const ChannelIcons: Record<string, any> = {
  live_chat: MessageSquare,
  email: SearchCode, // Using placeholder for email
  sms: MessageSquare,
};

export default function InboxSidebar() {
  const {
    activeView, setActiveView,
    inboxChannelId, setInboxChannelId,
    labelId, setLabelId,
    teamId, setTeamId,
    setSelectedConversationId,
  } = useInbox();
  const navigate = useNavigate();

  const [convOpen, setConvOpen] = useState(true);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [channelsOpen, setChannelsOpen] = useState(true);

  const { data: channels = [] } = useQuery({
    queryKey: ['inbox', 'channels'],
    queryFn: inboxApi.listChannels,
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['inbox', 'teams'],
    queryFn: inboxApi.listTeams,
  });
  const { data: labels = [] } = useQuery({
    queryKey: ['inbox', 'labels'],
    queryFn: inboxApi.listLabels,
  });
  const { data: mySignature } = useQuery({
    queryKey: ['inbox', 'agents', 'me', 'signature'],
    queryFn: inboxApi.getMySignature,
  });

  const selectView = (view: typeof activeView) => {
    setActiveView(view);
    setInboxChannelId(null);
    setLabelId(null);
    setTeamId(null);
    setSelectedConversationId(null);
  };

  const isMainActive = (viewId: string) => activeView === viewId && !inboxChannelId && !labelId && !teamId;

  return (
    <div className="w-[260px] shrink-0 border-r border-[#2C3036] bg-[#1B1D22] text-[#A6ADB4] flex flex-col h-full overflow-y-auto custom-scrollbar font-inter">
      {/* Header */}
      <div className="h-[60px] flex items-center justify-between px-4 shrink-0 mt-2">
        <button className="flex items-center gap-2 hover:bg-[#2C3036] p-1.5 rounded-lg transition-colors w-full">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">S</div>
          <span className="text-[14px] font-semibold text-white truncate">Stone AIO</span>
          <ChevronDown className="w-4 h-4 ml-auto text-slate-500" />
        </button>
      </div>

      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-8 pr-8 py-2 bg-[#1B1D22] border border-[#2C3036] rounded-md text-[13px] text-white placeholder-slate-500 focus:outline-none focus:border-[#4f46e5] transition"
          />
          <button className="absolute right-2 top-2 p-0.5 hover:bg-[#2C3036] rounded text-slate-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-1">
        {/* My Inbox */}
        <div className="px-2">
          <button
            onClick={() => selectView('mine')}
            className={`w-full flex items-center gap-3 px-3 py-[7px] rounded-md text-[14px] font-medium transition-colors ${
              isMainActive('mine')
                ? 'bg-[#2C3036] text-white'
                : 'hover:bg-[#2C3036]/50 hover:text-white'
            }`}
          >
            <Inbox className="w-4 h-4 shrink-0" />
            My Inbox
          </button>
        </div>

        {/* Conversations */}
        <div className="px-2 mt-2">
          <button
            onClick={() => setConvOpen(!convOpen)}
            className="w-full flex items-center justify-between px-3 py-[6px] text-[14px] font-medium hover:text-white transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 shrink-0" />
              Conversations
            </div>
            {convOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {convOpen && (
            <div className="mt-1">
              <button
                onClick={() => selectView('all')}
                className={`w-full flex items-center gap-3 pl-10 pr-3 py-[6px] rounded-md text-[13px] transition-colors ${
                  isMainActive('all') ? 'bg-[#28364D] text-[#3B82F6]' : 'hover:bg-[#2C3036]/50 hover:text-white'
                }`}
              >
                All Conversations
              </button>
              <button
                onClick={() => selectView('pending')}
                className={`w-full flex items-center gap-3 pl-10 pr-3 py-[6px] rounded-md text-[13px] transition-colors ${
                  isMainActive('pending') ? 'bg-[#28364D] text-[#3B82F6]' : 'hover:bg-[#2C3036]/50 hover:text-white'
                }`}
              >
                Mentions
              </button>
              <button
                onClick={() => selectView('unassigned')}
                className={`w-full flex items-center gap-3 pl-10 pr-3 py-[6px] rounded-md text-[13px] transition-colors ${
                  isMainActive('unassigned') ? 'bg-[#28364D] text-[#3B82F6]' : 'hover:bg-[#2C3036]/50 hover:text-white'
                }`}
              >
                Unattended
              </button>
            </div>
          )}
        </div>

        {/* Folders */}
        <div className="px-2 mt-3">
          <button
            onClick={() => setFoldersOpen(!foldersOpen)}
            className="w-full flex items-center justify-between px-3 py-[6px] text-[14px] font-medium hover:text-white transition-colors"
          >
            <div className="flex items-center gap-3">
              <Folder className="w-4 h-4 shrink-0" />
              Folders
            </div>
            {foldersOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {foldersOpen && (
            <div className="mt-1">
              <button className="w-full flex items-center gap-3 pl-10 pr-3 py-[6px] rounded-md text-[13px] hover:bg-[#2C3036]/50 hover:text-white transition-colors">
                Priority Conversations
              </button>
            </div>
          )}
        </div>

        {/* Teams */}
        <div className="px-2 mt-3">
          <button
            onClick={() => setTeamsOpen(!teamsOpen)}
            className="w-full flex items-center justify-between px-3 py-[6px] text-[14px] font-medium hover:text-white transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 shrink-0" />
              Teams
            </div>
            {teamsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {teamsOpen && (
            <div className="mt-1">
              {teams.length === 0 && <p className="pl-10 py-1 text-[12px] italic opacity-50">No teams</p>}
              {teams.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTeamId(t.id);
                    setActiveView('all');
                    setInboxChannelId(null);
                    setLabelId(null);
                    setSelectedConversationId(null);
                  }}
                  className={`w-full flex items-center gap-3 pl-10 pr-3 py-[6px] rounded-md text-[13px] transition-colors ${
                    teamId === t.id ? 'bg-[#28364D] text-[#3B82F6]' : 'hover:bg-[#2C3036]/50 hover:text-white'
                  }`}
                >
                  <span className="truncate">{t.name.toLowerCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Channels */}
        <div className="px-2 mt-3">
          <button
            onClick={() => setChannelsOpen(!channelsOpen)}
            className="w-full flex items-center justify-between px-3 py-[6px] text-[14px] font-medium hover:text-white transition-colors"
          >
            <div className="flex items-center gap-3">
              <Hash className="w-4 h-4 shrink-0" />
              Channels
            </div>
            {channelsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {channelsOpen && (
            <div className="mt-1">
              {channels.length === 0 && <p className="pl-10 py-1 text-[12px] italic opacity-50">No channels</p>}
              {channels.map((ch: any) => {
                const Icon = ChannelIcons[ch.channelType] || MessageSquare;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setInboxChannelId(ch.id);
                      setActiveView('all');
                      setTeamId(null);
                      setLabelId(null);
                      setSelectedConversationId(null);
                    }}
                    className={`w-full flex items-center gap-3 pl-10 pr-3 py-[6px] rounded-md text-[13px] transition-colors ${
                      inboxChannelId === ch.id ? 'bg-[#28364D] text-[#3B82F6]' : 'hover:bg-[#2C3036]/50 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{ch.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* User Footer */}
      <div className="shrink-0 border-t border-[#2C3036] p-4 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-sm font-bold">
              M
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#1B1D22]"></div>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white">Mathew M</p>
            <p className="text-[11px] text-slate-500 truncate w-[140px]">mathew@stoneaio.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
