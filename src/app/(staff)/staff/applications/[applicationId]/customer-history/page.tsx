import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { cn, focusRing } from "@/lib/utils";

interface PageProps {
  params: Promise<{ applicationId: string }>;
}

// Placeholder for Customer History (Phase 10) - so the review screen's
// link lands somewhere real in the meantime. Scoped by application, not
// customer id, matching the backend: an officer reaches a customer's
// history only through an open application
// (GET /officer/applications/<id>/customer-history).
export default async function CustomerHistoryPlaceholder({ params }: PageProps) {
  const { applicationId } = await params;
  if (!/^\d+$/.test(applicationId)) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/staff/applications/${applicationId}`}
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded text-sm font-medium text-primary hover:text-primary-dark",
          focusRing,
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to application #{applicationId}
      </Link>
      <Card>
        <CardTitle>Customer history</CardTitle>
        <p className="mt-2 text-sm text-neutral-600">Customer history isn&apos;t built yet. It will open here.</p>
      </Card>
    </div>
  );
}
