"use client";

import { type ReactNode, useId } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { errorClass, fieldIds, hintClass, labelClass } from "./Field";

export interface RadioCardOption<V extends string> {
  value: V;
  label: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  // Overrides the icon's colour (e.g. text-success for an "approve" choice).
  iconClassName?: string;
  disabled?: boolean;
}

export interface RadioCardGroupProps<V extends string> {
  legend: ReactNode;
  // Keeps the legend for screen readers when a heading above already says it.
  hideLegend?: boolean;
  name?: string;
  value: V | "";
  onChange: (value: V) => void;
  options: RadioCardOption<V>[];
  hint?: ReactNode;
  error?: string;
  disabled?: boolean;
  // Grid columns from sm up; one column on phones.
  columns?: 1 | 2 | 3;
  className?: string;
}

const COLUMNS = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" } as const;

// A choice between a few options, each a card. Native radio inputs, so the
// browser handles arrow keys, tab order and the radiogroup semantics; the
// input itself is visually hidden and the card shows its state.
export function RadioCardGroup<V extends string>({
  legend,
  hideLegend = false,
  name,
  value,
  onChange,
  options,
  hint,
  error,
  disabled = false,
  columns = 1,
  className,
}: RadioCardGroupProps<V>) {
  const generatedId = useId();
  const groupName = name ?? generatedId;
  const { hintId, errorId, describedBy } = fieldIds(generatedId, hint, error);

  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)} aria-describedby={describedBy} disabled={disabled}>
      <legend className={cn(labelClass, "mb-1.5", hideLegend && "sr-only")}>{legend}</legend>
      <div className={cn("grid gap-2", COLUMNS[columns])}>
        {options.map((o) => {
          const Icon = o.icon;
          return (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left transition-colors hover:bg-neutral-50",
                "has-[:checked]:border-primary has-[:checked]:bg-primary-light",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-1",
                "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
                error && "border-danger",
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={o.value}
                checked={value === o.value}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="peer sr-only"
              />
              {/* The radio's visible state - a filled ring when checked. */}
              <span
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-neutral-400 bg-white peer-checked:border-primary peer-checked:[&>span]:block"
                aria-hidden="true"
              >
                <span className="hidden h-2 w-2 rounded-full bg-primary" />
              </span>
              {Icon && <Icon className={cn("mt-0.5 h-5 w-5 shrink-0 text-primary", o.iconClassName)} aria-hidden="true" />}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-neutral-900">{o.label}</span>
                {o.description && <span className="mt-0.5 block text-helper text-neutral-600">{o.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
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
    </fieldset>
  );
}
