import React from 'react';
import { Search, X } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  prefixText?: string;
  isMono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      prefixText,
      isMono = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-text-main mb-1.5 uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixText && (
            <span className="inline-flex items-center pl-3 pr-2 text-xs font-mono text-text-muted select-none border-r border-border-subtle mr-2">
              {prefixText}
            </span>
          )}
          {leftIcon && !prefixText && (
            <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-white text-text-main placeholder-text-muted/60 text-sm border rounded-md transition-colors duration-150 py-2 ${
              leftIcon ? 'pl-9' : prefixText ? 'pl-1' : 'pl-3'
            } ${rightIcon ? 'pr-9' : 'pr-3'} ${
              isMono ? 'font-mono' : 'font-body'
            } ${
              error
                ? 'border-warning focus:border-warning focus:ring-1 focus:ring-warning'
                : 'border-border-subtle hover:border-border-medium focus:border-forest focus:ring-1 focus:ring-forest focus:outline-none'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-text-muted">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-warning font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-text-secondary">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  compact?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search records, ICD-10, medications...',
  compact = false,
  className = '',
  ...props
}) => {
  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <Search
        size={compact ? 14 : 16}
        className="absolute left-3 text-text-muted pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white text-text-main placeholder-text-muted/70 text-sm border border-border-subtle rounded-md pl-9 pr-8 transition-colors duration-150 hover:border-border-medium focus:border-forest focus:ring-1 focus:ring-forest focus:outline-none ${
          compact ? 'py-1.5 text-xs' : 'py-2'
        }`}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          className="absolute right-2.5 p-0.5 text-text-muted hover:text-text-main rounded transition-colors"
          title="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
