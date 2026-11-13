import React from 'react';
import type { PortalType } from '../../types/navigation';
import { Stethoscope, User } from 'lucide-react';

export interface PortalSwitcherProps {
  currentPortal: PortalType;
  onPortalChange: (portal: PortalType) => void;
  patientSelected?: boolean;
}

export const PortalSwitcher: React.FC<PortalSwitcherProps> = ({
  currentPortal,
  onPortalChange,
  patientSelected = false,
}) => {
  return (
    <div className="bg-[#122F2E] p-1 rounded-lg border border-white/10 flex items-center gap-1">
      <button
        type="button"
        onClick={() => onPortalChange('patient')}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded text-xs font-medium transition-all ${
          currentPortal === 'patient'
            ? 'bg-white text-forest shadow-xs font-semibold'
            : 'text-[#96ACA8] hover:text-white hover:bg-white/5'
        }`}
      >
        <User size={13} className="shrink-0" />
        <span>Patient</span>
      </button>

      <button
        type="button"
        onClick={() => onPortalChange('doctor')}
        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded text-xs font-medium transition-all relative ${
          currentPortal === 'doctor'
            ? 'bg-white text-forest shadow-xs font-semibold'
            : 'text-[#96ACA8] hover:text-white hover:bg-white/5'
        }`}
      >
        <Stethoscope size={13} className="shrink-0" />
        <span>Doctor</span>
        {patientSelected && currentPortal !== 'doctor' && (
          <span className="w-1.5 h-1.5 rounded-full bg-citron shrink-0" title="Patient selected" />
        )}
      </button>
    </div>
  );
};
