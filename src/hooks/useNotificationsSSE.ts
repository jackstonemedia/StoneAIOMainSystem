import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getStoredToken } from '../lib/apiClient';

const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3000';

export function useNotificationsSSE({ withAuth = true }: { withAuth?: boolean } = {}) {
  const queryClient = useQueryClient();

  const [isConnected, setIsConnected] = useState(false);
  // Keep a stable ref so the effect closure always has the latest queryClient
  const qcRef = useRef(queryClient);
  qcRef.current = queryClient;

  useEffect(() => {
    if (!qcRef.current) return; // No query client — skip SSE setup

    let eventSource: EventSource | null = null;
    let isSubscribed = true;

    async function connect() {
      const token = withAuth ? await getStoredToken() : 'dev_bypass_token';
      if (!isSubscribed) return;

      const url = token
        ? `${API_BASE_URL}/api/notifications/sse?token=${token}`
        : `${API_BASE_URL}/api/notifications/sse`;

      eventSource = new EventSource(url);

      eventSource.onopen = () => setIsConnected(true);
      eventSource.onerror = () => setIsConnected(false);

      eventSource.addEventListener('notification', () => {
        qcRef.current?.invalidateQueries({ queryKey: ['notifications'] });
        qcRef.current?.invalidateQueries({ queryKey: ['unread-notifications-count'] });
      });

      eventSource.addEventListener('trigger', () => {
        qcRef.current?.invalidateQueries({ queryKey: ['contacts'] });
        qcRef.current?.invalidateQueries({ queryKey: ['dashboard'] });
      });

      eventSource.addEventListener('metrics', () => {
        qcRef.current?.invalidateQueries({ queryKey: ['campaigns'] });
        qcRef.current?.invalidateQueries({ queryKey: ['ads-dashboard'] });
      });
    }

    connect();

    return () => {
      isSubscribed = false;
      eventSource?.close();
      setIsConnected(false);
    };
  }, [withAuth]); // qcRef is stable, no need to list it

  return { isConnected };
}
