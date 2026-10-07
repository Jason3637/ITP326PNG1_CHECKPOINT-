import { type ReactNode } from "react";
import { Card, cardTitleClass } from "./Card";
import { cn } from "@/lib/utils";

export interface PanelProps {
  title: ReactNode;
  // For a heading other content points at (aria-labelledby, an in-page link).
  id?: string;
  // h2 for a panel directly under the page title; h3 inside a section or
  // tab that has its own h2.
  as?: "h2" | "h3";
  description?: ReactNode;
  // Next to the title, e.g. a StatusBadge or a count.
  meta?: ReactNode;
  // Right of the heading on wide screens, under it on phones.
  actions?: ReactNode;
  // Below the body, separated by a rule - the panel's own buttons.
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

interface PanelFrameProps extends PanelProps {
  variant: "default" | "emphasis";
  eyebrow?: ReactNode;
}

function PanelFrame({
  title,
  id,
  as: Heading = "h2",
  description,
  meta,
  actions,
  footer,
  children,
  className,
  bodyClassName,
  variant,
  eyebrow,
}: PanelFrameProps) {
  return (
    <Card variant={variant} className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-dark">{eyebrow}</p>}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Heading id={id} className={cardTitleClass}>
              {title}
            </Heading>
            {meta}
          </div>
          {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children !== undefined && children !== null && children !== false && (
        <div className={cn("mt-4", bodyClassName)}>{children}</div>
      )}
      {footer && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">{footer}</div>
      )}
    </Card>
  );
}

// A titled block of information on a review screen: heading, optional
// badge and description, then the content. Built on Card, so it sits with
// the panels that already exist.
export function Panel(props: PanelProps) {
  return <PanelFrame {...props} variant="default" />;
}

export interface ImportantPanelProps extends PanelProps {
  // A short label above the title saying why this panel matters
  // ("Your next step").
  eyebrow?: ReactNode;
}

// The one panel on a screen where the officer acts - claim, resume, send a
// recommendation. Card's emphasis treatment; use one per screen or it
// stops standing out.
export function ImportantPanel(props: ImportantPanelProps) {
  return <PanelFrame {...props} variant="emphasis" />;
}
