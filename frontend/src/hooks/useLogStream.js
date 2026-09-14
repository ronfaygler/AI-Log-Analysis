import { useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function useLogStream(onEvent) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let source = null;

    function connect() {
      if (document.visibilityState === 'hidden') return;
      source = new EventSource(`${API_URL}/logs/stream`, { withCredentials: true });

      source.addEventListener('log.updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          onEventRef.current?.('log.updated', data);
        } catch {
          onEventRef.current?.('log.updated', null);
        }
      });

      source.addEventListener('log.deleted', (e) => {
        try {
          const data = JSON.parse(e.data);
          onEventRef.current?.('log.deleted', data);
        } catch {
          onEventRef.current?.('log.deleted', null);
        }
      });

      source.onerror = () => {
        source?.close();
        source = null;
      };
    }

    function disconnect() {
      source?.close();
      source = null;
    }

    function handleVisibility() {
      if (document.visibilityState === 'hidden') {
        disconnect();
      } else {
        connect();
      }
    }

    connect();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      disconnect();
    };
  }, []);
}
