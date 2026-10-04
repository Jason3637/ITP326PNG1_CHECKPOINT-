import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Info } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CustomerPanel } from "@/components/staff/review/CustomerPanel";
import { ApplicationPanel } from "@/components/staff/review/ApplicationPanel";
import { DocumentsPanel } from "@/components/staff/review/DocumentsPanel";
import { CreditAdvisoryPanel } from "@/components/staff/review/CreditAdvisoryPanel";
import { VerificationChecklist } from "@/components/staff/review/VerificationChecklist";
import { RequestHistoryPanel } from "@/components/staff/review/RequestHistoryPanel";
import { RecommendationHistoryPanel } from "@/components/staff/review/RecommendationHistoryPanel";
import { CustomerHistoryView } from "@/components/staff/history/CustomerHistoryView";
import { OfficerReviewPanel } from "@/components/admin/review/OfficerReviewPanel";
import { FinalDecisionPanel } from "@/components/admin/review/FinalDecisionPanel";
import { serverApiFetch, ApiError, UnauthenticatedError } from "@/lib/server-api";
import { formatReviewDate, formatReviewDateTime, relevantEarlierVersions, toCreditAdvisory } from "@/lib/application-review";
import { pickChecklist } from "@/lib/checklist";
import { ID_DOCUMENT_TYPES } from "@/lib/loan-wizard";
import { staffStatusLabel } from "@/lib/officer-queues";
import { OUTCOME_STATUS, parseOutcome } from "@/lib/admin-decisions";
import { adminLoanHref } from "@/lib/admin-queues";
import { cn, focusRing } from "@/lib/utils";
import type { AdminApplicationReview, CustomerHistory, ReviewDocument } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const linkClass = cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing);

const OUTCOME_BANNER = {
  approved: {
    title: "Approved — Awaiting Disbursement",
    body: "No loan has been created and no money has moved. The loan starts only when it's disbursed; it's now in the Approved — Awaiting Disbursement queue.",
  },
  rejected: { title: "Application rejected", body: "The application is closed." },
  returned: {
    title: "Returned to the loan officer",
    body: "It's in the loan officer's Returned queue with your reason. It comes back to you once they recommend again.",
  },
} as const;

// The Final Application Review screen. Everything the loan officer saw
// (reused panels, read-only), the officer's review, the customer's history,
// and the administrator's three actions: Approve, Reject, Return to Loan
// Officer. Which of those are offered is the backend's call
// (final_decision.can_*), never re-derived here. No amount or term editing.
//
// Data: GET /admin/applications/<id> (the officer review payload plus
// final_decision) and GET /admin/applications/<id>/customer-history.
// As on the officer screen, panels render named fields only.
export default async function AdminApplicationReviewPage({ params, searchParams }: PageProps) {
  const { applicationId } = await params;
  if (!/^\d+$/.test(applicationId)) notFound();
  const outcome = parseOutcome((await searchParams).decided);

  let review: AdminApplicationReview;
  try {
    review = await serverApiFetch<AdminApplicationReview>(`/admin/applications/${applicationId}`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { application, customer, documents, checklist, credit_assessment, final_decision: fd } = review;

  // Supporting reads: a failure in either shouldn't take down the screen.
  const [historyRes, docsRes] = await Promise.allSettled([
    serverApiFetch<CustomerHistory>(`/admin/applications/${application.id}/customer-history`),
    serverApiFetch<{ documents: ReviewDocument[] }>(`/users/${customer.id}/documents?include_superseded=true`),
  ]);
  for (const r of [historyRes, docsRes]) {
    if (r.status === "rejected" && r.reason instanceof UnauthenticatedError) redirect("/login");
  }
  const history: CustomerHistory | null = historyRes.status === "fulfilled" ? historyRes.value : null;
  const earlierVersions: ReviewDocument[] | null = docsRes.status === "fulfilled" ? relevantEarlierVersions(application.id, docsRes.value.documents) : null;

  const latest = review.recommendations.at(-1) ?? null;
  const showOutcome = outcome !== null && application.status === OUTCOME_STATUS[outcome];
  const decidedOn = formatReviewDateTime(fd.decided_at);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin" className={cn("inline-flex w-fit items-center gap-1", linkClass)}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          Application #{application.id} · {customer.full_name}
        </h2>
        <Badge variant={application.status === "awaiting_disbursement" ? "success" : "primary"} className="w-fit">
          {staffStatusLabel(application.status)}
        </Badge>
      </div>

      {showOutcome && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-light p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium text-neutral-900">{OUTCOME_BANNER[outcome].title}</p>
            <p className="mt-0.5 text-neutral-700">{OUTCOME_BANNER[outcome].body}</p>
            <Link href="/admin" className={cn("mt-1 inline-block", linkClass)}>
              Back to the dashboard
            </Link>
          </div>
        </div>
      )}

      {/* Where the application stands when it isn't waiting on a decision. */}
      {!fd.awaiting && !showOutcome && (
        <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" aria-hidden="true" />
          <div className="text-sm text-neutral-700">
            {application.status === "awaiting_disbursement" ? (
              <>
                <p className="font-medium text-neutral-900">Approved — Awaiting Disbursement</p>
                <p className="mt-0.5">
                  Approved{decidedOn ? ` ${decidedOn}` : ""}. The loan isn&apos;t active yet: it&apos;s created when
                  the money is paid out.
                </p>
              </>
            ) : application.status === "disbursed" && fd.loan_id !== null ? (
              <p>
                Paid out.{" "}
                <Link href={adminLoanHref(fd.loan_id)} className={linkClass}>
                  Open loan #{fd.loan_id}
                </Link>
              </p>
            ) : application.status === "rejected" ? (
              <p>Rejected{decidedOn ? ` ${decidedOn}` : ""}.</p>
            ) : (
              <p>With the loan officer. It isn&apos;t ready for a final decision yet.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <OfficerReviewPanel review={review} />
        <FinalDecisionPanel
          applicationId={application.id}
          canApprove={fd.can_approve}
          canReject={fd.can_reject}
          canReturn={fd.can_return_to_officer}
          latestRecommendation={latest?.recommendation ?? null}
        />
      </div>

      {(review.recommendations.length > 1 || review.admin_returns.length > 0) && (
        <RecommendationHistoryPanel recommendations={review.recommendations} adminReturns={review.admin_returns} />
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <CustomerPanel
            customer={customer}
            applicationId={application.id}
            applicant={{
              residentialAddress: application.residential_address,
              employerName: application.employer_name,
              employmentStatus: application.employment_status,
            }}
          />
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
        </div>
      </div>

      <VerificationChecklist
        applicationId={application.id}
        idDocuments={documents
          .filter((d) => d.document_type === "id_verification" && d.is_current)
          .map((d) => ({
            id: d.id,
            label: `${ID_DOCUMENT_TYPES.find((t) => t.value === d.id_document_type)?.label ?? "ID document"} #${d.id}`,
          }))}
        initial={pickChecklist(checklist)}
        editable={false}
        lockedReason="Read-only here. Checks are the loan officer's; return the application if something needs another look."
      />
      <RequestHistoryPanel requests={review.information_requests} />

      <section aria-labelledby="customer-history-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="customer-history-heading" className="font-display text-xl font-bold tracking-tight text-neutral-900">
            Customer history
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {customer.full_name}&apos;s other applications, loans and repayments
            {history?.customer.member_since ? ` · member since ${formatReviewDate(history.customer.member_since)}` : ""}.
            Excludes this application.
          </p>
        </div>
        {history ? (
          <CustomerHistoryView history={history} />
        ) : (
          <Card>
            <CardTitle>Customer history couldn&apos;t be loaded</CardTitle>
            <p className="mt-1 text-sm text-neutral-600">Refresh the page to try again.</p>
          </Card>
        )}
      </section>
    </div>
  );
}
