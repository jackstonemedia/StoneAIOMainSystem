import { NavLink } from 'react-router-dom';
import { Inbox, Users, Book, Settings, PieChart, Send } from 'lucide-react';

export default function InboxNavigation() {
  const navItems = [
    { icon: Inbox, path: '/inbox', label: 'Inbox', exact: true },
    { icon: Users, path: '/inbox/contacts', label: 'Contacts' },
    { icon: PieChart, path: '/inbox/reports', label: 'Reports' },
    { icon: Send, path: '/inbox/campaigns', label: 'Campaigns' },
    { icon: Book, path: '/inbox/help-center', label: 'Help Center' },
    { icon: Settings, path: '/inbox/settings/channels', label: 'Settings' },
  ];

  return (
    <div className="w-[60px] flex-shrink-0 bg-[#16191D] border-r border-[#2C3036] flex flex-col items-center py-4 space-y-4 font-inter">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.exact}
          className={({ isActive }) =>
            `p-2.5 rounded-xl transition-all group relative ${
              isActive 
                ? 'bg-[#28364D] text-[#3B82F6]' 
                : 'text-[#A6ADB4] hover:bg-[#2C3036] hover:text-white'
            }`
          }
        >
          <item.icon className="w-5 h-5" />
          
          {/* Tooltip */}
          <div className="absolute left-full ml-3 px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[12px] font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
            {item.label}
          </div>
        </NavLink>
      ))}
      
      <div className="mt-auto pb-4">
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-sm font-bold cursor-pointer">
          M
        </div>
      </div>
    </div>
  );
}
