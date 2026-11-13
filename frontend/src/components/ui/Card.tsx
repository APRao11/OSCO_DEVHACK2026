import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: 'none' | 'forest' | 'citron' | 'warning' | 'eucalyptus';
  isMuted?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  accent = 'none',
  isMuted = false,
  className = '',
  ...props
}) => {
  const accentClasses = {
    none: '',
    forest: 'border-t-2 border-t-forest',
    citron: 'border-t-2 border-t-citron',
    warning: 'border-t-2 border-t-warning',
    eucalyptus: 'border-t-2 border-t-eucalyptus',
  };

  return (
    <div
      className={`border border-border-subtle rounded-lg ${
        isMuted ? 'bg-[#FAFCFB]' : 'bg-white'
      } shadow-[0_1px_3px_rgba(23,59,58,0.03)] transition-all ${accentClasses[accent]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  metadata?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  badge,
  action,
  metadata,
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`px-5 py-4 border-b border-border-subtle flex flex-col gap-2 ${className}`}
      {...props}
    >
      {children ? (
        children
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              {title && (
                <h3 className="text-base font-semibold text-text-main font-heading tracking-tight">
                  {title}
                </h3>
              )}
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-text-secondary leading-relaxed">{subtitle}</p>
            )}
            {metadata && (
              <div className="text-[11px] font-mono text-text-muted">{metadata}</div>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
    </div>
  );
};

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

export const CardContent: React.FC<CardContentProps> = ({
  children,
  compact = false,
  className = '',
  ...props
}) => {
  return (
    <div className={`${compact ? 'p-3.5' : 'p-5'} ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`px-5 py-3 border-t border-border-subtle bg-[#FBFDFD] rounded-b-lg flex items-center justify-between text-xs text-text-secondary ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
