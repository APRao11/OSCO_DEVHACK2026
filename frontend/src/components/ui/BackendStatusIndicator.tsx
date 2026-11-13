import { useEffect, useState } from 'react';
import { getBackendHealth } from '../../api/queries.js';

type BackendStatus = 'checking' | 'online' | 'offline';

const STATUS_LABELS: Record<BackendStatus, string> = {
  checking: 'Checking',
  online: 'Backend Online',
  offline: 'Backend Offline',
};

const STATUS_COLORS: Record<BackendStatus, string> = {
  checking: 'bg-text-muted',
  online: 'bg-eucalyptus-dark',
  offline: 'bg-warning',
};

export function BackendStatusIndicator() {
  const [status, setStatus] = useState<BackendStatus>('checking');

  useEffect(() => {
    let active = true;

    const checkStatus = async () => {
      try {
        const health = await getBackendHealth();
        if (active) setStatus(health.status === 'ok' ? 'online' : 'offline');
      } catch {
        if (active) setStatus('offline');
      }
    };

    void checkStatus();
    const intervalId = window.setInterval(() => void checkStatus(), 30_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-white px-3 py-1.5 text-[11px] font-medium text-text-secondary shadow-sm"
    >
      <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[status]}`} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </div>
  );
}