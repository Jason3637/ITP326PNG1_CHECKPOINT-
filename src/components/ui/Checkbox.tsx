import { type InputHTMLAttributes, type ReactNode, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { errorClass, fieldIds, hintClass } from "./Field";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, hint, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const { hintId, errorId, describedBy } = fieldIds(inputId, hint, error);

    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={inputId}
          className={cn("flex items-start gap-2 text-sm text-neutral-700", props.disabled && "opacity-50")}
        >
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              className,
            )}
            {...props}
          />
          <span>{label}</span>
        </label>
        {hint && (
          <p id={hintId} className={cn(hintClass, "pl-6")}>
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className={errorClass}>
            {error}
          </p>
        )}
      </div>
    );
  },
);
Checkbox.displayName = "Checkbox";
