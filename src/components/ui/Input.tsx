import { type InputHTMLAttributes, type ReactNode, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  // Shown on the label's row, right-aligned (e.g. a "Forgot password?" link).
  labelAction?: ReactNode;
  // Shown inside the field at its right edge (e.g. a show/hide toggle).
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, labelAction, trailing, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;

    const input = (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={errorId}
        className={cn(
          "h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary disabled:opacity-50",
          error && "border-danger focus-visible:ring-danger",
          trailing && "w-full pr-11",
          className,
        )}
        {...props}
      />
    );

    return (
      <div className="flex flex-col gap-1.5">
        {(label || labelAction) && (
          <div className="flex items-center justify-between gap-3">
            {label && (
              <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
                {label}
              </label>
            )}
            {labelAction}
          </div>
        )}
        {trailing ? (
          <div className="relative">
            {input}
            <div className="absolute inset-y-0 right-0 flex items-center pr-1">{trailing}</div>
          </div>
        ) : (
          input
        )}
        {error && (
          <p id={errorId} className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
