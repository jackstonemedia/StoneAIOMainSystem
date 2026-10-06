import { NavLink, Outlet } from 'react-router-dom';
import { Mail, Users, Tag, MessageSquareText, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const tabs = [
  { to: '/inbox/settings/channels', label: 'Channels', icon: Mail },
  { to: '/inbox/settings/teams', label: 'Teams', icon: Users },
  { to: '/inbox/settings/labels', label: 'Labels', icon: Tag },
  { to: '/inbox/settings/canned-responses', label: 'Canned Responses', icon: MessageSquareText },
];

export default function InboxSettings() {
  const navigate = useNavigate();
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="h-[57px] border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center px-6 gap-4 shrink-0">
        <button
          onClick={() => navigate('/inbox')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors text-[13px] font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inbox
        </button>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
        <h1 className="text-[14px] font-bold text-slate-900 dark:text-white">Inbox Settings</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <div className="w-[200px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <nav className="space-y-0.5">
            {tabs.map(t => (
              <NavLink
                key={t.to}
                to={t.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                <t.icon className="w-4 h-4 shrink-0" />
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
