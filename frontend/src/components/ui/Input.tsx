import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`appearance-none block w-full px-3 py-2 border ${
            error ? 'border-danger focus:ring-danger focus:border-danger' : 'border-border focus:ring-primary focus:border-primary'
          } rounded-md shadow-sm placeholder-muted text-foreground focus:outline-none focus:ring-1 sm:text-sm transition-colors ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
