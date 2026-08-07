import { type InputHTMLAttributes, type ReactNode, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="flex items-start gap-2 text-sm text-neutral-700">
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={errorId}
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              className,
            )}
            {...props}
          />
          <span>{label}</span>
        </label>
        {error && (
          <p id={errorId} className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Checkbox.displayName = "Checkbox";
