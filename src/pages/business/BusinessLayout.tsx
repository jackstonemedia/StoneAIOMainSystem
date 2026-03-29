import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, BarChart3, Calendar, FileText, Users, Star,
  Mail, ChevronRight
} from 'lucide-react';

export default function BusinessLayout() {
  const location = useLocation();
  
  // Build breadcrumb from path
  const segments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    path: '/' + segments.slice(0, i + 1).join('/'),
  }));

  return (
    <div className="flex h-full w-full">
      <main className="flex-1 overflow-hidden bg-bg flex flex-col w-full">
        {/* Breadcrumb */}
        <div className="px-6 py-3 border-b border-border bg-surface/50 flex items-center gap-1.5 text-xs text-text-muted shrink-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              <span className={i === breadcrumbs.length - 1 ? 'text-text-main font-medium' : ''}>
                {crumb.label}
              </span>
            </span>
          ))}
        </div>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
