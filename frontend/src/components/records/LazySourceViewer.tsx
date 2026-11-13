import React, { Suspense, lazy } from 'react';
import type { SourceViewerProps } from './SourceViewer';

// pdf.js is large, so the viewer is only downloaded when a source is first opened.
const SourceViewer = lazy(() => import('./SourceViewer').then((module) => ({ default: module.SourceViewer })));

export const LazySourceViewer: React.FC<SourceViewerProps> = ({ target, onClose }) =>
  target ? (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 text-sm text-white">Opening source…</div>
      }
    >
      <SourceViewer target={target} onClose={onClose} />
    </Suspense>
  ) : null;
