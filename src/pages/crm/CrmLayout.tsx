import { Outlet } from 'react-router-dom';
import CRMAIAssistant from '../../components/crm/CRMAIAssistant';

export default function CrmLayout() {
  return (
    <div className="flex h-full w-full relative">
      <main className="flex-1 overflow-auto bg-bg relative">
        <Outlet />
      </main>
      <CRMAIAssistant />
    </div>
  );
}
