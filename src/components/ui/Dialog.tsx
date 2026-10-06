"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";

export interface DialogProps {
  open: boolean;
  // Called when the dialog asks to close: Escape, the close button or a
  // click on the backdrop - unless `dismissible` is false.
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  // Pinned under the scrolling body: the step's buttons.
  footer?: ReactNode;
  // False while something is in flight, so the dialog can't be closed
  // half-way through (Escape, backdrop and the close button all do nothing).
  dismissible?: boolean;
  className?: string;
}

// A modal for a focused task. The native <dialog> in modal mode: the
// browser traps focus inside, makes the page behind inert, closes on
// Escape and gives focus back to whatever opened it. The children stay
// mounted while closed, so reopening shows what was entered.
export function Dialog({ open, onClose, title, description, children, footer, dismissible = true, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Escape: the browser would close it itself; keep the open prop in charge.
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      // A click on the backdrop lands on the <dialog> element itself.
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-hidden rounded-2xl bg-white p-0 text-neutral-900 shadow-xl backdrop:bg-neutral-900/50",
        "open:flex open:flex-col",
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-section-title font-bold tracking-tight text-neutral-900">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="mt-0.5 text-sm text-neutral-600">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={!dismissible}
          aria-label="Close"
          className={cn(
            "-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40",
            focusRing,
          )}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}
