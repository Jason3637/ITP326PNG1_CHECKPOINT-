"use client";

import { type KeyboardEvent, useRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

interface SegmentedControlProps<V extends string> {
  // Names the group for screen readers ("Valid ID checked status").
  label: string;
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  disabled?: boolean;
  className?: string;
  // Extra classes for every segment (e.g. a smaller size in a narrow card).
  itemClassName?: string;
}

// One choice from a few, shown as connected segments - a radio group (WAI-ARIA
// radio pattern): one tab stop, arrow keys move and select, Home/End jump to
// the ends. The chosen segment is marked by a check and weight as well as
// colour. Segments are 32px on mouse screens and 44px on touch screens.
export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className,
  itemClassName,
}: SegmentedControlProps<V>) {
  const refs = useRef(new Map<V, HTMLButtonElement>());
  const current = options.some((o) => o.value === value) ? value : options[0].value;

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const i = options.findIndex((o) => o.value === current);
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % options.length
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + options.length) % options.length
      : e.key === "Home" ? 0
      : e.key === "End" ? options.length - 1
      : null;
    if (next === null) return;
    e.preventDefault();
    const v = options[next].value;
    onChange(v);
    refs.current.get(v)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex flex-wrap rounded-lg border border-neutral-300 bg-white p-0.5", className)}
    >
      {options.map((o) => {
        const checked = o.value === current;
        return (
          <button
            key={o.value}
            ref={(el) => {
              if (el) refs.current.set(o.value, el);
              else refs.current.delete(o.value);
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={onKeyDown}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1 rounded-md px-2.5 text-sm pointer-coarse:h-11 pointer-coarse:px-3.5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
              checked
                ? "bg-primary-light font-semibold text-primary-dark shadow-sm"
                : "font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
              itemClassName,
            )}
          >
            {checked && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
