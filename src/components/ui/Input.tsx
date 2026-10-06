import { type InputHTMLAttributes, type ReactNode, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { Field, controlClass, controlErrorClass, controlHeight, fieldIds, type Requirement } from "./Field";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  // Helper text under the field, announced with it.
  hint?: ReactNode;
  // "(required)" / "(optional)" after the label.
  requirement?: Requirement;
  // Shown on the label's row, right-aligned (e.g. a "Forgot password?" link).
  labelAction?: ReactNode;
  // Shown inside the field at its right edge (e.g. a show/hide toggle).
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, requirement, labelAction, trailing, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const { describedBy } = fieldIds(inputId, hint, error);

    const input = (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={cn(controlClass, controlHeight, error && controlErrorClass, trailing && "w-full pr-11", className)}
        {...props}
      />
    );

    return (
      <Field id={inputId} label={label} labelAction={labelAction} requirement={requirement} hint={hint} error={error}>
        {trailing ? (
          <div className="relative">
            {input}
            <div className="absolute inset-y-0 right-0 flex items-center pr-1">{trailing}</div>
          </div>
        ) : (
          input
        )}
      </Field>
    );
  },
);
Input.displayName = "Input";
