import { Loader2 } from "lucide-react";

// Scoped to the /staff dashboard only, via the (overview) route group - do
// not move it back up to staff/. A loading.tsx is a Suspense boundary: once
// its fallback streams, the response is committed as HTTP 200 and a later
// notFound() can only render the 404 page, not set the status. The queue,
// review and customer-history pages call notFound() for unknown queues and
// applications, so they must have no loading boundary above them to return
// a real 404 (see Next's loading.js "Status Codes" docs). The dashboard has
// no notFound() case, so it keeps the instant loading state.
export default function StaffLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-neutral-500">Loading...</p>
    </div>
  );
}
