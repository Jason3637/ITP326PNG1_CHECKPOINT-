import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { cn, focusRing } from "@/lib/utils";

interface PageProps {
  params: Promise<{ applicationId: string }>;
}

// Placeholder for the Application Review Workspace (Phase 6) - exists only
// so queue links land somewhere real instead of a 404 in the meantime.
// Deliberately makes NO backend call: GET /officer/applications/<id> is not
// a pure read (it lazily opens the verification checklist - see
// officer_views.open_checklist_if_needed), and that shouldn't happen from
// a stub page.
export default async function ApplicationReviewPlaceholder({ params }: PageProps) {
  const { applicationId } = await params;
  if (!/^\d+$/.test(applicationId)) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/staff"
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded text-sm font-medium text-primary hover:text-primary-dark",
          focusRing,
        )}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </Link>
      <Card>
        <CardTitle>Application #{applicationId}</CardTitle>
        <p className="mt-2 text-sm text-neutral-600">
          The Application Review Workspace isn&apos;t built yet. It will open here.
        </p>
      </Card>
    </div>
  );
}
