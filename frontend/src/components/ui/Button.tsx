import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'citron' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      leftIcon,
      rightIcon,
      isLoading = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    // Exact palette styling
    const baseClasses =
      'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none border tracking-tight';

    const sizeClasses = {
      sm: 'text-xs px-2.5 py-1.5 rounded gap-1.5 font-medium',
      md: 'text-sm px-3.5 py-2 rounded-md gap-2 font-medium',
      lg: 'text-base px-5 py-2.5 rounded-md gap-2.5 font-medium',
    };

    const variantClasses = {
      // Primary Dark Forest (#173B3A)
      primary:
        'bg-forest text-white border-forest hover:bg-forest-dark active:bg-forest-dark shadow-sm',
      // Secondary Eucalyptus (#6E9991) subtle container with strong forest text
      secondary:
        'bg-eucalyptus/15 text-forest border-eucalyptus/40 hover:bg-eucalyptus/25 active:bg-eucalyptus/30',
      // Clean white card outline with subtle border (#DCE5E1)
      outline:
        'bg-white text-text-main border-border-subtle hover:bg-osco-bg hover:border-border-medium active:bg-[#e6eeea] shadow-[0_1px_2px_rgba(23,59,58,0.03)]',
      // Accent Citron (#C7D957) reserved for primary callouts / verified confirmations
      citron:
        'bg-citron text-forest border-citron font-semibold hover:bg-citron-hover shadow-sm',
      // Warning / Contradiction (#B65D4B)
      warning:
        'bg-warning-subtle text-warning border-warning/30 hover:bg-warning/15 active:bg-warning/20 font-medium',
      // Ghost: transparent
      ghost:
        'bg-transparent text-text-secondary border-transparent hover:text-text-main hover:bg-eucalyptus-subtle',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
