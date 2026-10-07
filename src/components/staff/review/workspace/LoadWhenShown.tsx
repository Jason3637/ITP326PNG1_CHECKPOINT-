"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Stands in for content the page only fetches when its tab is open (see
// HistoryResult "deferred"). Every tab panel is rendered up front and
// hidden, so this waits until its own panel is shown - the officer opened
// the tab - and then refreshes the page once. The tab is in the URL by
// then, so the server render includes the content.
export function LoadWhenShown({ label }: { label: string }) {
  const router = useRouter();
  const ref = useRef<HTMLParagraphElement>(null);
  const requested = useRef(false);

  useEffect(() => {
    const panel = ref.current?.closest<HTMLElement>("[role=tabpanel]");
    if (!panel) return;
    const load = () => {
      if (requested.current || panel.hidden) return;
      requested.current = true;
      router.refresh();
    };
    load();
    const observer = new MutationObserver(load);
    observer.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
    return () => observer.disconnect();
  }, [router]);

  return (
    <p ref={ref} role="status" className="flex items-center gap-2 text-sm text-neutral-600">
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {label}
    </p>
  );
}
