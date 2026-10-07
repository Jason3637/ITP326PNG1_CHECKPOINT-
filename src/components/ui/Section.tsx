import { type ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";
import { cn } from "@/lib/utils";

export interface SectionProps {
  // The section's id (an in-page link target); its heading is `${id}-heading`.
  id: string;
  title: ReactNode;
  // h2 for a section directly under the page title, h3 beneath an h2.
  as?: "h2" | "h3";
  description?: ReactNode;
  scope?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

// A page section: a SectionHeader over its cards or panels, named by its
// heading so screen readers can list and jump to it. scroll-mt keeps the
// heading clear of the sticky header when a link jumps to it.
export function Section({ id, title, as, description, scope, actions, children, className }: SectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("flex scroll-mt-24 flex-col gap-4", className)}>
      <SectionHeader id={headingId} title={title} as={as} description={description} scope={scope} actions={actions} />
      {children}
    </section>
  );
}
