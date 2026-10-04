import { Loader2 } from "lucide-react";

// Scoped to the /admin dashboard only, via the (overview) route group - do
// not move it back up to admin/. A loading.tsx is a Suspense boundary: once
// its fallback streams, the response is committed as HTTP 200 and a later
// notFound() can only render the 404 page, not set the status. The queue
// and detail pages call notFound() for unknown queues and items, so they
// must have no loading boundary above them to return a real 404 (see Next's
// loading.js "Status Codes" docs). The dashboard has no notFound() case, so
// it keeps the instant loading state.
export default function AdminLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-neutral-500">Loading...</p>
    </div>
  );
}
