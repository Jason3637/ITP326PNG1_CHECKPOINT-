"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { getStaffDocumentUrl } from "@/lib/actions/staff-documents";
import { cn, focusRing } from "@/lib/utils";

// Takes only the document id - never the document object - so nothing
// else about the file (e.g. its storage path) is serialized to the browser.
export function DocumentViewButton({ documentId, label = "View" }: { documentId: number; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    // Opened synchronously inside the click so popup blockers allow it,
    // then pointed at the signed URL once the server action returns.
    const tab = window.open("", "_blank");
    const result = await getStaffDocumentUrl(documentId);
    setLoading(false);
    if (result.ok) {
      if (tab) {
        tab.opener = null;
        tab.location.href = result.url;
      } else {
        window.location.assign(result.url);
      }
    } else {
      tab?.close();
      setError(result.error);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:text-primary-dark disabled:opacity-50",
          focusRing,
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        )}
        {label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
