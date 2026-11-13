import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'forest' | 'secondary' | 'citron' | 'warning' | 'neutral' | 'outline' | 'verified';
  size?: 'sm' | 'md';
  isMono?: boolean;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  isMono = false,
  dot = false,
  className = '',
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center gap-1.5 font-medium border select-none transition-colors';

  const sizeClasses = {
    sm: 'text-[11px] leading-tight px-2 py-0.5 rounded',
    md: 'text-xs leading-tight px-2.5 py-1 rounded',
  };

  const fontClass = isMono ? 'font-mono tracking-tight' : 'font-body';

  const variantClasses = {
    // Primary Dark Forest (#173B3A)
    forest: 'bg-forest text-white border-forest',
    // Secondary Eucalyptus (#6E9991)
    secondary: 'bg-[#EBF2EF] text-forest border-[#C2D8D2]',
    // Accent Citron (#C7D957) highlight
    citron: 'bg-[#F4F8D8] text-forest border-[#C7D957]',
    // Warning / Contradiction (#B65D4B)
    warning: 'bg-warning-subtle text-warning border-[#E7BFB7]',
    // Neutral grey-green
    neutral: 'bg-white text-text-secondary border-border-subtle',
    // Outline crisp
    outline: 'bg-transparent text-text-main border-border-medium',
    // Clinical Verified
    verified: 'bg-[#E8F1EE] text-forest border-eucalyptus/50 font-semibold',
  };

  const dotColors = {
    forest: 'bg-white',
    secondary: 'bg-eucalyptus',
    citron: 'bg-[#8A9C12]',
    warning: 'bg-warning',
    neutral: 'bg-text-muted',
    outline: 'bg-text-secondary',
    verified: 'bg-forest',
  };

  return (
    <span
      className={`${baseClasses} ${sizeClasses[size]} ${fontClass} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
};
