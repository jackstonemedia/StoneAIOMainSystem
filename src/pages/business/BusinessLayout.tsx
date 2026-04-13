import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { 
  LayoutDashboard, BarChart3, Calendar, FileText, Users, Star,
  Mail, ChevronRight
} from 'lucide-react';
import BusinessOnboarding from './BusinessOnboarding';

export default function BusinessLayout() {
  const location = useLocation();
  const [hasOnboarded, setHasOnboarded] = useState(false);
  
  // Build breadcrumb from path
  const segments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    path: '/' + segments.slice(0, i + 1).join('/'),
  }));

  if (!hasOnboarded) {
    return <BusinessOnboarding onComplete={() => setHasOnboarded(true)} />;
  }

  return (
    <div className="flex h-full w-full">
      <main className="flex-1 overflow-hidden bg-bg flex flex-col w-full">
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
