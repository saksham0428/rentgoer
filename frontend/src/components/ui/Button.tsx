import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'inverted';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', fullWidth = false, children, ...props }, ref) => {
    const baseStyles = 'inline-flex justify-center items-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer select-none';
    
    const variants = {
      primary: 'bg-primary text-white shadow-xs hover:bg-primary-hover hover:shadow focus-visible:ring-primary',
      secondary: 'bg-muted/15 text-foreground hover:bg-muted/25 focus-visible:ring-muted',
      outline: 'border border-border bg-card text-foreground hover:bg-muted/10 hover:border-border/80 focus-visible:ring-primary',
      ghost: 'text-foreground/80 hover:text-foreground hover:bg-muted/10 focus-visible:ring-primary',
      inverted: 'bg-white text-primary shadow-xs hover:bg-stone-100 hover:shadow focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2.5',
    };

    const classes = [
      baseStyles,
      variants[variant],
      sizes[size],
      fullWidth ? 'w-full' : '',
      className,
    ].join(' ');

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
