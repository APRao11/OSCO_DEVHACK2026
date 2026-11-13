import React from 'react';
import { Badge } from './Badge';

export interface MetricStatProps {
  label: string;
  value: string | number;
  unit?: string;
  code?: string; // e.g. "CONF-98", "ICD-10", "HASH-SHA256"
  trend?: string;
  trendVariant?: 'verified' | 'warning' | 'citron' | 'neutral';
  highlightCitron?: boolean;
  className?: string;
}

export const MetricStat: React.FC<MetricStatProps> = ({
  label,
  value,
  unit,
  code,
  trend,
  trendVariant = 'neutral',
  highlightCitron = false,
  className = '',
}) => {
  return (
    <div
      className={`border border-border-subtle bg-white rounded-lg p-4 shadow-[0_1px_3px_rgba(23,59,58,0.02)] flex flex-col justify-between ${
        highlightCitron ? 'border-l-4 border-l-citron' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {label}
        </span>
        {code && (
          <span className="text-[10px] font-mono text-text-muted bg-osco-bg px-1.5 py-0.5 rounded border border-border-subtle">
            {code}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 my-1">
        <span className="text-2xl font-bold font-heading text-forest tracking-tight">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-text-secondary font-mono">{unit}</span>
        )}
      </div>

      {trend && (
        <div className="mt-2 pt-2 border-t border-border-subtle/60 flex items-center justify-between">
          <Badge
            variant={trendVariant}
            size="sm"
            isMono={true}
            className="text-[10px] py-0.5 px-1.5"
          >
            {trend}
          </Badge>
        </div>
      )}
    </div>
  );
};
