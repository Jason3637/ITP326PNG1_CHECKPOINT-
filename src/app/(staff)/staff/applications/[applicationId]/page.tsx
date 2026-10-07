import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, History } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CompactEmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { ProgressSummary } from "@/components/ui/ProgressSummary";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { CustomerPanel } from "@/components/staff/review/CustomerPanel";
import { ApplicationPanel } from "@/components/staff/review/ApplicationPanel";
import { DetailList, DetailRow } from "@/components/staff/review/DetailList";
import { DocumentsTab } from "@/components/staff/review/workspace/DocumentsTab";
import { CreditAdvisoryPanel } from "@/components/staff/review/CreditAdvisoryPanel";
import { VerificationChecklist } from "@/components/staff/review/VerificationChecklist";
import { RequestInformationForm } from "@/components/staff/review/RequestInformationForm";
import { RequestHistoryPanel } from "@/components/staff/review/RequestHistoryPanel";
import { RecommendationForm } from "@/components/staff/review/RecommendationForm";
import { RecommendationHistoryPanel } from "@/components/staff/review/RecommendationHistoryPanel";
import { ReviewWorkflowPanel } from "@/components/staff/review/ReviewWorkflowPanel";
import { serverApiFetch, ApiError, UnauthenticatedError } from "@/lib/server-api";
import { formatReviewDate, formatReviewDateTime, relevantEarlierVersions, toCreditAdvisory } from "@/lib/application-review";
import { checklistLockedReason, pickChecklist } from "@/lib/checklist";
import { ID_DOCUMENT_TYPES } from "@/lib/loan-wizard";
import { assignmentLabel, daysWaiting, purposeLabel, waitingLabel } from "@/lib/officer-queues";
import { RECOMMENDATION_COPY, isRecommendationType, recommendationLabel } from "@/lib/recommendations";
import { statusPresentation } from "@/lib/status-presentation";
import { cn, focusRing, formatKina } from "@/lib/utils";
import type { ApplicationReview, ReviewDocument } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const TAB_IDS = ["overview", "verification", "documents", "credit", "history"] as const;
type TabId = (typeof TAB_IDS)[number];

function parseTab(value: string | string[] | undefined): TabId {
  return TAB_IDS.find((t) => t === value) ?? "overview";
}

// Focused after a claim or resume, so the officer lands in the workspace.
const HEADING_ID = "workspace-heading";
// The action column, for the header's jump link below xl.
const ACTIONS_ID = "actions";
// The request-more-information panel, opened from the checklist's header.
const REQUEST_INFORMATION_ID = "request-information";

// Stages where an assigned officer works the application.
const OFFICER_STAGES = ["officer_review", "customer_action_required", "returned_to_officer"];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The Application Review workspace. A compact header and the review's
// progress come first; then the claim/resume banner when the backend offers
// one; then the information in URL tabs (?tab=overview|verification|
// documents|credit|history - unknown values open Overview). The officer's
// actions (send a recommendation, request more information) sit in their
// own column beside the tabs on wide screens and after them on narrower
// ones, with a jump link in the header - reachable from every tab.
//
// All tab panels stay mounted and only the selected one is shown, so
// switching tabs never loses an unsaved note, draft or comment. Each switch
// is a history entry (Back/Forward move between tabs) written with the
// native History API - no server round trip. Saving a check refreshes the
// server data in place; client state survives it (the router keys the page
// without its search params).
//
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
// (only the application id), RecommendationForm (id plus a checklist
// summary of counts and labels), ReviewWorkflowPanel (id, flags, status)
// and Tabs (the rendered panels).
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
  const sp = await searchParams;
  // Set by RequestInformationForm after a successful send.
  const requestedRaw = sp.requested;
  const justRequested = typeof requestedRaw === "string" && /^\d+$/.test(requestedRaw) ? Number(requestedRaw) : null;
  // Set by RecommendationForm after a successful send.
  const justRecommended = isRecommendationType(sp.recommended) ? sp.recommended : null;
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
  const canRecommend = canRecommendApproval || canRecommendRejection;
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

  // ---- derived, for the header and Overview -----------------------------------
  const status = statusPresentation("application", application.status);
  const assigned = assignmentLabel({
    is_mine: assignment.is_mine,
    assigned_officer_id: assignment.officer_id,
    assigned_officer_name: assignment.officer_name,
  });
  const purpose = purposeLabel(application.purpose_category);
  const submitted = formatReviewDate(application.submitted_at);
  const age = waitingLabel(daysWaiting(application.submitted_at));
  const { summary } = checklist;
  const failedItems = checklist.items.filter((i) => i.status === "failed");
  const openRequests = review.information_requests.filter((r) => r.status === "open");
  const answeredRequests = review.information_requests.filter((r) => r.status === "responded");
  const cancelledRequests = review.information_requests.filter((r) => r.status === "cancelled");
  const latestReturn = review.admin_returns.at(-1) ?? null;
  const latestRecommendation = review.recommendations.at(-1) ?? null;
  const hasActions = canRecommend || canRequestInformation;
  // Read-only because it's another officer's, or nobody's (an officer's
  // account was removed) - the rules themselves stay the backend's.
  const othersWork = !assignment.is_mine && assignment.officer_id !== null && OFFICER_STAGES.includes(application.status);
  const unassignedWork = assignment.officer_id === null && OFFICER_STAGES.includes(application.status);

  // ---- header -------------------------------------------------------------------
  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: "Assigned",
      value: <span className={assignment.is_mine ? "text-primary-dark" : undefined}>{assigned}</span>,
    },
    { label: "Requested", value: <span className="tabular-nums">{formatKina(application.amount_requested)}</span> },
    ...(application.prime_category ? [{ label: "PRIME", value: application.prime_category }] : []),
    ...(purpose ? [{ label: "Purpose", value: purpose }] : []),
    ...(submitted ? [{ label: "Submitted", value: age ? `${submitted} · ${age}` : submitted }] : []),
  ];

  // ---- tabs -----------------------------------------------------------------------
  const attention = [
    application.status === "returned_to_officer" && latestReturn && (
      <Alert key="returned" tone="warning" title={`Returned by ${latestReturn.returned_by_name ?? "the administrator"}`}>
        {latestReturn.reason}
      </Alert>
    ),
    failedItems.length > 0 && (
      <Alert key="failed" tone="danger" role="note" title={`Problem found: ${plural(failedItems.length, "check")}`}>
        {failedItems.map((i) => i.label).join(", ")}. See the Verification tab.
      </Alert>
    ),
    openRequests.length > 0 && (
      <Alert key="requests" tone="warning" title={`${plural(openRequests.length, "open information request")}`}>
        Waiting on the customer since {formatReviewDateTime(openRequests[0].requested_at) ?? "the last request"}. The
        rounds are in the Verification tab.
      </Alert>
    ),
    !customer.is_active && (
      <Alert key="disabled" tone="danger" role="note" title="The customer's account is disabled">
        See the customer details below.
      </Alert>
    ),
  ].filter(Boolean);

  const overview = (
    <div className="@container flex flex-col gap-4">
      {attention.length > 0 && (
        <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
          <h3 id="attention-heading" className="sr-only">
            Needs attention
          </h3>
          {attention}
        </section>
      )}
      <Panel title="Workflow" as="h3">
        <DetailList>
          <DetailRow
            label="Status"
            value={
              <StatusBadge tone={status.tone} icon={status.icon}>
                {status.label}
              </StatusBadge>
            }
          />
          <DetailRow
            label="Assigned"
            value={assigned}
            hint={assignment.assigned_at ? `Since ${formatReviewDateTime(assignment.assigned_at)}` : undefined}
          />
          <DetailRow
            label="Required checks"
            value={
              checklist.started
                ? `${summary.required_complete} of ${summary.required} done · ${summary.blocking_items.length} outstanding`
                : null
            }
            fallback="Start once the application is claimed"
          />
          <DetailRow
            label="Information requests"
            value={
              review.information_requests.length > 0
                ? `${openRequests.length} open · ${answeredRequests.length} answered · ${cancelledRequests.length} cancelled`
                : null
            }
            fallback="None requested"
          />
          <DetailRow
            label="Recommendations"
            value={
              latestRecommendation
                ? `${recommendationLabel(latestRecommendation.recommendation)}${latestRecommendation.officer_name ? ` by ${latestRecommendation.officer_name}` : ""}`
                : null
            }
            hint={
              latestRecommendation
                ? `${plural(review.recommendations.length, "recommendation")} sent${latestRecommendation.created_at ? ` · latest ${formatReviewDateTime(latestRecommendation.created_at)}` : ""}. See the History tab.`
                : undefined
            }
            fallback="None sent yet"
          />
        </DetailList>
      </Panel>
      <div className="grid gap-4 @3xl:grid-cols-2 @3xl:items-start">
        <CustomerPanel
          customer={customer}
          applicationId={application.id}
          canRequestReverification={canEditChecklist}
          applicant={{
            residentialAddress: application.residential_address,
            employerName: application.employer_name,
            employmentStatus: application.employment_status,
          }}
        />
        <ApplicationPanel application={application} customer={customer} />
      </div>
    </div>
  );

  const verification = (
    <div className="flex flex-col gap-4">
      <VerificationChecklist
        // VerificationChecklist seeds its state from `initial` once. Remount
        // it when the application changes stage (claim, resume, customer
        // response) so a router.refresh() shows the newly opened checklist
        // instead of the empty one from before the claim.
        key={`${application.status}:${checklist.started}`}
        applicationId={application.id}
        idDocuments={documents
          .filter((d) => d.document_type === "id_verification" && d.is_current)
          .map((d) => ({
            id: d.id,
            label: `${ID_DOCUMENT_TYPES.find((t) => t.value === d.id_document_type)?.label ?? "ID document"} #${d.id}`,
          }))}
        initial={pickChecklist(checklist)}
        editable={canEditChecklist}
        variant="compact"
        requestInformationTargetId={canRequestInformation ? REQUEST_INFORMATION_ID : undefined}
        lockedReason={checklistLockedReason({
          started: checklist.started,
          status: application.status,
          isMine: assignment.is_mine,
          officerName: assignment.officer_name,
        })}
      />
      <RequestHistoryPanel requests={review.information_requests} />
    </div>
  );

  const documentsTab = (
    <DocumentsTab
      documents={documents}
      earlierVersions={earlierVersions}
      referees={application.referees}
      checklist={checklist}
      informationRequests={review.information_requests}
      verifiedIdDocumentId={customer.verification?.id_document_id ?? null}
    />
  );

  const credit = (
    <CreditAdvisoryPanel
      advisory={toCreditAdvisory(credit_assessment.result)}
      label={credit_assessment.label}
      application={application}
    />
  );

  const historyTab = (
    <div className="flex flex-col gap-4">
      {review.recommendations.length > 0 ? (
        <RecommendationHistoryPanel recommendations={review.recommendations} adminReturns={review.admin_returns} />
      ) : (
        <Panel title="Recommendations" as="h3">
          <CompactEmptyState>No recommendation has been sent for this application yet.</CompactEmptyState>
        </Panel>
      )}
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
  );

  // ---- actions -----------------------------------------------------------------
  const actions = hasActions && (
    <div className="flex flex-col gap-4">
      {canRecommend && (
        <RecommendationForm
          applicationId={application.id}
          canRecommendApproval={canRecommendApproval}
          canRecommendRejection={canRecommendRejection}
          checklist={{
            started: checklist.started,
            required: summary.required,
            requiredComplete: summary.required_complete,
            outstanding: summary.blocking_items
              .filter((k) => checklist.items.find((i) => i.item_type === k)?.status !== "failed")
              .map(checklistLabel),
            failed: failedItems.map((i) => i.label),
            ready: summary.ready_for_approval_recommendation,
          }}
        />
      )}
      {canRequestInformation && <RequestInformationForm applicationId={application.id} id={REQUEST_INFORMATION_ID} />}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <PageHeader
          back={{ href: "/staff", label: "Back to dashboard" }}
          titleId={HEADING_ID}
          title={`Application #${application.id} · ${customer.full_name}`}
          meta={
            <StatusBadge tone={status.tone} icon={status.icon}>
              {status.label}
            </StatusBadge>
          }
          actions={
            hasActions && (
              <a href={`#${ACTIONS_ID}`} className={buttonClasses({ variant: "secondary", size: "sm", className: "xl:hidden" })}>
                Your actions
              </a>
            )
          }
        />
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{f.label}</dt>
              <dd className="mt-0.5 break-words text-sm font-medium text-neutral-900">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {checklist.started && (
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 sm:px-5">
          <ProgressSummary
            label="Required checks"
            value={summary.required_complete}
            total={summary.required}
            valueText={`${summary.required_complete} of ${summary.required} complete · ${summary.blocking_items.length} remaining`}
            status={
              summary.ready_for_approval_recommendation
                ? { tone: "success", label: "All required checks done" }
                : failedItems.length > 0
                  ? { tone: "danger", label: `${plural(failedItems.length, "problem")} found` }
                  : { tone: "warning", label: `${summary.blocking_items.length} outstanding` }
            }
          />
        </div>
      )}

      {justRequested !== null && application.status === "customer_action_required" && (
        <Alert tone="success" title={justRequested === 1 ? "Request sent to the customer." : `${justRequested} requests sent to the customer.`}>
          Application #{application.id} is now waiting on the customer. It comes back to you under review once they respond.
        </Alert>
      )}

      {justRecommended &&
        ["recommended_for_approval", "recommended_for_rejection", "admin_review"].includes(application.status) && (
          <Alert
            tone="success"
            title={RECOMMENDATION_COPY.sentTitle(justRecommended)}
            actions={
              <Link href="/staff" className={cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing)}>
                Back to your queues
              </Link>
            }
          >
            {RECOMMENDATION_COPY.sentBody(application.id)}
          </Alert>
        )}

      <ReviewWorkflowPanel
        applicationId={application.id}
        canClaim={canClaim}
        canResume={canResume}
        status={application.status}
        focusTargetId={HEADING_ID}
      />

      {othersWork && (
        <Alert tone="neutral" title={`Assigned to ${assignment.officer_name ?? "another officer"}`}>
          You can see everything here. Only they or an administrator can update the checks, request information or send a
          recommendation.
        </Alert>
      )}
      {unassignedWork && (
        <Alert tone="neutral" title="No officer is assigned">
          An administrator needs to assign this application before anyone can work on it.
        </Alert>
      )}

      <div className={cn("grid gap-6", hasActions && "xl:grid-cols-[minmax(0,1fr)_23rem] xl:items-start")}>
        <Tabs<TabId>
          label="Application review"
          initialTab={parseTab(sp.tab)}
          history="push"
          className="min-w-0"
          tabs={[
            { id: "overview", label: "Overview", content: overview },
            {
              id: "verification",
              label: "Verification",
              ...(checklist.started && summary.blocking_items.length > 0
                ? { count: summary.blocking_items.length, countTone: "attention" as const, countLabel: "outstanding" }
                : {}),
              content: verification,
            },
            {
              id: "documents",
              label: "Documents",
              count: documents.length,
              countLabel: documents.length === 1 ? "document" : "documents",
              content: documentsTab,
            },
            { id: "credit", label: "Credit assessment", content: credit },
            { id: "history", label: "History", content: historyTab },
          ]}
        />
        {actions && (
          <aside
            id={ACTIONS_ID}
            aria-label="Your actions"
            className="scroll-mt-24 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto"
          >
            {actions}
          </aside>
        )}
      </div>
    </div>
  );
}
