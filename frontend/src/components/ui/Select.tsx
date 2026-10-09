import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { label: string; value: string | number }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, id, options, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-foreground mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`block w-full pl-3 pr-10 py-2 text-base border ${
            error ? 'border-danger focus:ring-danger focus:border-danger' : 'border-border focus:ring-primary focus:border-primary'
          } rounded-md focus:outline-none sm:text-sm bg-card text-foreground transition-colors ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
