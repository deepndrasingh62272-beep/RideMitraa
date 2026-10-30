import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, icon, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5 group">
        {label && (
          <label className="text-sm font-medium text-gray-700 ml-1 transition-colors group-focus-within:text-orange-600">
            {label}
          </label>
        )}
        <div className="relative group transition-all duration-300">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors">
              {icon}
            </div>
          )}
          <input
            className={cn(
              'h-12 w-full rounded-xl border border-gray-200 bg-white/50 backdrop-blur-sm px-4 py-2 text-base shadow-sm transition-all duration-300',
              'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500',
              'disabled:cursor-not-allowed disabled:opacity-50',
              icon && 'pl-11',
              error && 'border-red-500 focus:ring-red-500/20 focus:border-red-500',
              className
            )}
            ref={ref}
            suppressHydrationWarning
            {...props}
          />
        </div>
        {error && <p className="text-xs font-medium text-red-500 ml-1 animate-in fade-in slide-in-from-top-1">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
