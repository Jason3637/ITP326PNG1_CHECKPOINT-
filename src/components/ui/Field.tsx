import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

// The one anatomy every form control shares: label (with an optional
// action on its row), the control, a hint, then the error. Input, Select,
// Textarea and RadioCardGroup all render through this, so labels, helper
// text and errors look and announce the same everywhere.

// The control's own box. Height is separate (controlHeight) because a
// textarea doesn't take one.
export const controlClass =
  "rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary disabled:opacity-50";
export const controlErrorClass = "border-danger focus-visible:ring-danger";
export const controlHeight = "h-10 comfortable:h-11";

export const labelClass = "text-sm font-medium text-neutral-700";
// text-neutral-600, not 400/500: lighter shades measured below AA at this size.
export const hintClass = "text-helper text-neutral-600";
export const errorClass = "text-sm text-danger";

// "(required)" / "(optional)" after the label, in the muted style the admin
// forms already use. Purely visual - pass `required` to the control too.
export type Requirement = "required" | "optional";

// The ids a control points aria-describedby at, hint first.
export function fieldIds(id: string, hint?: ReactNode, error?: string) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return { hintId, errorId, describedBy };
}

export interface FieldProps {
  id: string;
  label?: ReactNode;
  // Shown on the label's row, right-aligned (e.g. a "Forgot password?" link).
  labelAction?: ReactNode;
  requirement?: Requirement;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ id, label, labelAction, requirement, hint, error, className, children }: FieldProps) {
  const { hintId, errorId } = fieldIds(id, hint, error);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || labelAction) && (
        <div className="flex items-center justify-between gap-3">
          {label && (
            <label htmlFor={id} className={labelClass}>
              {label}
              {requirement && <span className="font-normal text-neutral-500"> ({requirement})</span>}
            </label>
          )}
          {labelAction}
        </div>
      )}
      {children}
      {hint && (
        <p id={hintId} className={hintClass}>
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
}
