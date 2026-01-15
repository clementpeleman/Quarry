'use client';

import { ConnectionProvider } from '@/lib/connections/store';
import { CanvasProvider } from '@/lib/canvas/store';
import { ReactNode, useEffect } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  // Suppress benign ResizeObserver errors commonly caused by Monaco/ReactFlow interactions
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      if (e.message && (
        e.message.includes('ResizeObserver loop limit exceeded') ||
        e.message.includes('ResizeObserver loop completed with undelivered notifications')
      )) {
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  return (
    <ConnectionProvider>
      <CanvasProvider>
        {children}
      </CanvasProvider>
    </ConnectionProvider>
  );
}
