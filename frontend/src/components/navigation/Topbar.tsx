import React from 'react';
import { Menu } from 'lucide-react';
import type { PortalType } from '../../types/navigation';

export interface TopbarProps {
  portal: PortalType;
  activeSectionTitle: string;
  onOpenMobileMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  portal,
  activeSectionTitle,
  onOpenMobileMenu,
}) => (
  <header
    className={`sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border-subtle bg-white px-4 sm:px-6 ${
      portal === 'doctor' ? 'lg:hidden' : ''
    }`}
  >
    <div className="flex min-w-0 items-center gap-3">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="rounded-md p-2 text-text-secondary hover:bg-osco-bg hover:text-text-main lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>
      {portal === 'patient' && (
        <div className="flex min-w-0 items-center gap-2 truncate font-mono text-xs text-text-muted">
          <span className="font-semibold uppercase text-forest">OSCO</span>
          <span>/</span>
          <span className="uppercase tracking-wider">Patient Portal</span>
          <span>/</span>
          <span className="truncate font-heading text-sm font-semibold tracking-normal text-text-main">
            {activeSectionTitle}
          </span>
        </div>
      )}
    </div>
  </header>
);
