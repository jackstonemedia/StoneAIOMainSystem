import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function HeaderPortal({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const findTarget = () => {
      if (cancelled) return;
      const el = document.getElementById('crm-header-actions');
      if (el) {
        setTarget(el);
      } else {
        timer = setTimeout(findTarget, 50);
      }
    };
    findTarget();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!target) return null;
  return createPortal(children, target);
}
