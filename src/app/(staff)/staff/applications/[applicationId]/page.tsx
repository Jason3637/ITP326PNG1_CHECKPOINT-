import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronRight, History } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CustomerPanel } from "@/components/staff/review/CustomerPanel";
import { ApplicationPanel } from "@/components/staff/review/ApplicationPanel";
import { DocumentsPanel } from "@/components/staff/review/DocumentsPanel";
import { CreditAdvisoryPanel } from "@/components/staff/review/CreditAdvisoryPanel";
import { VerificationChecklist } from "@/components/staff/review/VerificationChecklist";
import { RequestInformationForm } from "@/components/staff/review/RequestInformationForm";
import { RequestHistoryPanel } from "@/components/staff/review/RequestHistoryPanel";
import { RecommendationForm } from "@/components/staff/review/RecommendationForm";
import { RecommendationHistoryPanel } from "@/components/staff/review/RecommendationHistoryPanel";
import { ReviewWorkflowPanel } from "@/components/staff/review/ReviewWorkflowPanel";
import { serverApiFetch, ApiError, UnauthenticatedError } from "@/lib/server-api";
import { relevantEarlierVersions, toCreditAdvisory } from "@/lib/application-review";
import { checklistLockedReason, pickChecklist } from "@/lib/checklist";
import { assignmentLabel, staffStatusLabel } from "@/lib/officer-queues";
import { RECOMMENDATION_COPY, isRecommendationType } from "@/lib/recommendations";
import { cn, focusRing } from "@/lib/utils";
import type { ApplicationReview, ReviewDocument } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const linkClass = cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing);

// The Application Review screen. A new application is claimed here (and a
// returned or waiting one resumed) via ReviewWorkflowPanel; after that the
// verification checklist is editable
// here (each item saves on its own); the officer can send a Request More
// Information round, or recommend approval/rejection to the administrator.
// A recommendation never decides the application, creates a loan or moves
// money - the backend does none of that at this step, and the copy here
// never implies it (see RECOMMENDATION_COPY).
//
// Data: GET /officer/applications/<id>, the backend's one-call review
// payload. Note it isn't a pure read: for an application already with an
// officer, it lazily creates any missing verification-checklist rows
// (officer_views.open_checklist_if_needed) - idempotent, and intended for
// exactly this screen.
//
// What reaches the browser: everything here is a Server Component except
// DocumentViewButton (receives only a document id), VerificationChecklist
// (receives pickChecklist()'s field-picked copy), RequestInformationForm
// (only the application id) and RecommendationForm (id plus a checklist
// summary of counts and labels).
// Panels render named fields only - nothing spreads or dumps the raw
// response - and the response types (ApplicationReview etc.) declare only
// rendered fields.
// Fields the backend sends that are deliberately never shown: document
// storage_path, internal user ids (user_id, decided_by, verified_by), the
// credit model's score/eligible/recommendation/max amount, recommendation
// snapshots' frozen credit result and requester/canceller user ids. Request internal notes and
// field changes ARE shown, in the request history - that's staff evidence
// the officer is entitled to. allowed_actions is read to decide what's
// offered, never displayed.
export default async function ApplicationReviewPage({ params, searchParams }: PageProps) {
  const { applicationId } = await params;
  // Set by RequestInformationForm after a successful send.
  const requestedRaw = (await searchParams).requested;
  const justRequested = typeof requestedRaw === "string" && /^\d+$/.test(requestedRaw) ? Number(requestedRaw) : null;
  // Set by RecommendationForm after a successful send.
  const recommendedRaw = (await searchParams).recommended;
  const justRecommended = isRecommendationType(recommendedRaw) ? recommendedRaw : null;
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
  const canRequestInformation = review.allowed_actions.includes("request_information");
  const canRecommendApproval = review.allowed_actions.includes("recommend_approval");
  const canRecommendRejection = review.allowed_actions.includes("recommend_rejection");
  const canClaim = review.allowed_actions.includes("claim");
  const canResume = review.allowed_actions.includes("resume_review");
  const checklistLabel = (key: string) => checklist.items.find((i) => i.item_type === key)?.label ?? key;

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

      {justRequested !== null && application.status === "customer_action_required" && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-light p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium text-neutral-900">
              {justRequested === 1 ? "Request sent to the customer." : `${justRequested} requests sent to the customer.`}
            </p>
            <p className="mt-0.5 text-neutral-700">
              Application #{application.id} is now waiting on the customer. It comes back to you under review once they
              respond.
            </p>
          </div>
        </div>
      )}

      {justRecommended &&
        ["recommended_for_approval", "recommended_for_rejection", "admin_review"].includes(application.status) && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-light p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium text-neutral-900">{RECOMMENDATION_COPY.sentTitle(justRecommended)}</p>
              <p className="mt-0.5 text-neutral-700">{RECOMMENDATION_COPY.sentBody(application.id)}</p>
              <Link href="/staff" className={cn("mt-1 inline-block", linkClass)}>
                Back to your queues
              </Link>
            </div>
          </div>
        )}

      <ReviewWorkflowPanel
        applicationId={application.id}
        canClaim={canClaim}
        canResume={canResume}
        status={application.status}
      />

      <VerificationChecklist
        // VerificationChecklist seeds its state from `initial` once. Remount
        // it when the application changes stage (claim, resume, customer
        // response) so a router.refresh() shows the newly opened checklist
        // instead of the empty one from before the claim.
        key={`${application.status}:${checklist.started}`}
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

      {canRequestInformation && <RequestInformationForm applicationId={application.id} />}
      {(canRecommendApproval || canRecommendRejection) && (
        <RecommendationForm
          applicationId={application.id}
          canRecommendApproval={canRecommendApproval}
          canRecommendRejection={canRecommendRejection}
          checklist={{
            started: checklist.started,
            required: checklist.summary.required,
            requiredComplete: checklist.summary.required_complete,
            outstanding: checklist.summary.blocking_items
              .filter((k) => checklist.items.find((i) => i.item_type === k)?.status !== "failed")
              .map(checklistLabel),
            failed: checklist.items.filter((i) => i.status === "failed").map((i) => i.label),
            ready: checklist.summary.ready_for_approval_recommendation,
          }}
        />
      )}
      <RecommendationHistoryPanel recommendations={review.recommendations} adminReturns={review.admin_returns} />
      <RequestHistoryPanel requests={review.information_requests} />

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
