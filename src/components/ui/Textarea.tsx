import { type ReactNode, type TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { Field, controlClass, controlErrorClass, fieldIds, type Requirement } from "./Field";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
  requirement?: Requirement;
  // Shows "12 / 500" under the field when maxLength is set.
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, requirement, showCount = false, id, rows = 3, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const { describedBy } = fieldIds(textareaId, hint, error);
    const length = typeof props.value === "string" ? props.value.length : null;
    const counter =
      showCount && props.maxLength !== undefined && length !== null ? (
        <span className="tabular-nums">
          {length} / {props.maxLength}
        </span>
      ) : null;

    return (
      <Field
        id={textareaId}
        label={label}
        requirement={requirement}
        hint={hint || counter ? <span className="flex justify-between gap-3"><span>{hint}</span>{counter}</span> : undefined}
        error={error}
      >
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(controlClass, "py-2.5", error && controlErrorClass, className)}
          {...props}
        />
      </Field>
    );
  },
);
Textarea.displayName = "Textarea";
