import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, History } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CustomerPanel } from "@/components/staff/review/CustomerPanel";
import { ApplicationPanel } from "@/components/staff/review/ApplicationPanel";
import { DocumentsPanel } from "@/components/staff/review/DocumentsPanel";
import { CreditAdvisoryPanel } from "@/components/staff/review/CreditAdvisoryPanel";
import { VerificationChecklist } from "@/components/staff/review/VerificationChecklist";
import { serverApiFetch, ApiError, UnauthenticatedError } from "@/lib/server-api";
import { relevantEarlierVersions, toCreditAdvisory } from "@/lib/application-review";
import { checklistLockedReason, pickChecklist } from "@/lib/checklist";
import { assignmentLabel, staffStatusLabel } from "@/lib/officer-queues";
import { cn, focusRing } from "@/lib/utils";
import type { ApplicationReview, ReviewDocument } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ applicationId: string }>;
}

const linkClass = cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing);

// The Application Review screen. The verification checklist is editable
// here (each item saves on its own); review decisions are a later phase.
//
// Data: GET /officer/applications/<id>, the backend's one-call review
// payload. Note it isn't a pure read: for an application already with an
// officer, it lazily creates any missing verification-checklist rows
// (officer_views.open_checklist_if_needed) - idempotent, and intended for
// exactly this screen.
//
// What reaches the browser: everything here is a Server Component except
// DocumentViewButton (receives only a document id) and
// VerificationChecklist (receives pickChecklist()'s field-picked copy).
// Panels render named fields only - nothing spreads or dumps the raw
// response - and the response types (ApplicationReview etc.) declare only
// rendered fields.
// Fields the backend sends that are deliberately never shown: document
// storage_path, internal user ids (user_id, decided_by, verified_by), the
// credit model's score/eligible/recommendation/max amount, recommendation
// snapshots and information-request internals (internal_note, requester
// ids, field_changes). allowed_actions is read to decide what's editable,
// never displayed.
export default async function ApplicationReviewPage({ params }: PageProps) {
  const { applicationId } = await params;
  if (!/^\d+$/.test(applicationId)) notFound();

  let review: ApplicationReview;
  try {
    review = await serverApiFetch<ApplicationReview>(`/officer/applications/${applicationId}`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { application, customer, documents, checklist, assignment, credit_assessment } = review;
  // The backend's rule for this viewer (assigned officer or admin, in an
  // editable status) - not re-derived here.
  const canEditChecklist = review.allowed_actions.includes("update_checklist");

  // Earlier (superseded) versions: the review payload only carries current
  // documents. Failure here shouldn't take down the whole screen.
  let earlierVersions: ReviewDocument[] | null;
  try {
    const all = await serverApiFetch<{ documents: ReviewDocument[] }>(
      `/users/${customer.id}/documents?include_superseded=true`,
    );
    earlierVersions = relevantEarlierVersions(application.id, all.documents);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    earlierVersions = null;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/staff" className={cn("inline-flex w-fit items-center gap-1", linkClass)}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
            Application #{application.id} · {customer.full_name}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {assignmentLabel({
              is_mine: assignment.is_mine,
              assigned_officer_id: assignment.officer_id,
              assigned_officer_name: assignment.officer_name,
            })}
          </p>
        </div>
        <Badge variant="primary" className="w-fit">
          {staffStatusLabel(application.status)}
        </Badge>
      </div>

      <VerificationChecklist
        applicationId={application.id}
        initial={pickChecklist(checklist)}
        editable={canEditChecklist}
        lockedReason={checklistLockedReason({
          started: checklist.started,
          status: application.status,
          isMine: assignment.is_mine,
          officerName: assignment.officer_name,
        })}
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <CustomerPanel customer={customer} />
          <DocumentsPanel
            documents={documents}
            earlierVersions={earlierVersions}
            referees={application.referees}
            checklist={checklist}
            informationRequests={review.information_requests}
            verifiedIdDocumentId={customer.verification?.id_document_id ?? null}
          />
        </div>
        <div className="flex flex-col gap-4">
          <ApplicationPanel application={application} customer={customer} />
          <CreditAdvisoryPanel
            advisory={toCreditAdvisory(credit_assessment.result)}
            label={credit_assessment.label}
            application={application}
          />
          <Card className="p-0">
            <Link
              href={`/staff/applications/${application.id}/customer-history`}
              className={cn("flex items-center gap-3 rounded-xl p-5 hover:bg-neutral-50", focusRing)}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-dark">
                <History className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-neutral-900">Customer history</span>
                <span className="block text-sm text-neutral-600">
                  {customer.full_name}&apos;s past applications, loans and repayments.
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden="true" />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
