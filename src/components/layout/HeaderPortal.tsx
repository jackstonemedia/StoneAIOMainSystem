import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function HeaderPortal({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Use a small timeout to ensure the layout has mounted the target div
    // since the Outlet children render slightly before the parent layout in some React flows.
    const findTarget = () => {
      const el = document.getElementById('crm-header-actions');
      if (el) {
        setTarget(el);
      } else {
        setTimeout(findTarget, 50);
      }
    };
    findTarget();
  }, []);

  if (!target) return null;
  return createPortal(children, target);
}
