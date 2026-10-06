import { type ReactNode, type SelectHTMLAttributes, forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field, controlClass, controlErrorClass, controlHeight, fieldIds, type Requirement } from "./Field";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
  requirement?: Requirement;
  // Class for the wrapper around the select and its chevron (e.g. a width).
  wrapperClassName?: string;
  children: ReactNode; // <option>s and <optgroup>s
}

// A native <select>, styled like Input. Native on purpose: it keeps the
// platform picker on phones and works in a plain GET form with no JS.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, label, error, hint, requirement, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const { describedBy } = fieldIds(selectId, hint, error);

    return (
      <Field id={selectId} label={label} requirement={requirement} hint={hint} error={error}>
        <div className={cn("relative", wrapperClassName)}>
          <select
            ref={ref}
            id={selectId}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={cn(controlClass, controlHeight, "w-full appearance-none pr-9", error && controlErrorClass, className)}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
            aria-hidden="true"
          />
        </div>
      </Field>
    );
  },
);
Select.displayName = "Select";
