"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { requestReverification } from "@/lib/actions/customer-verification";

// Shown on a verified customer, for the officer working the application:
// invalidates the verification (e.g. the customer has a new ID) so the
// identity checks are done again.
export function RequestReverification({ applicationId }: { applicationId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 rounded text-xs font-medium text-primary hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Request re-verification
      </button>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await requestReverification(applicationId, note);
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      setNote("");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-neutral-200 p-3">
      <label htmlFor="reverify-note" className="text-xs font-medium text-neutral-700">
        Why does this customer need re-verifying?
      </label>
      <textarea
        id="reverify-note"
        rows={2}
        maxLength={1000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Customer has a new ID card."
        className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="secondary" onClick={submit} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Invalidate verification
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
