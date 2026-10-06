import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert, type AlertTone } from "@/components/ui/Alert";
import { buttonClasses } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { CustomerPanel } from "@/components/staff/review/CustomerPanel";
import { ApplicationPanel } from "@/components/staff/review/ApplicationPanel";
import { DocumentsPanel } from "@/components/staff/review/DocumentsPanel";
import { CreditAdvisoryPanel } from "@/components/staff/review/CreditAdvisoryPanel";
import { VerificationChecklist } from "@/components/staff/review/VerificationChecklist";
import { RequestHistoryPanel } from "@/components/staff/review/RequestHistoryPanel";
import { RecommendationHistoryPanel } from "@/components/staff/review/RecommendationHistoryPanel";
import { DetailList, DetailRow } from "@/components/staff/review/DetailList";
import { CustomerHistoryView } from "@/components/staff/history/CustomerHistoryView";
import { OfficerReviewPanel } from "@/components/admin/review/OfficerReviewPanel";
import { FinalDecisionPanel } from "@/components/admin/review/FinalDecisionPanel";
import { DisbursementForm } from "@/components/admin/review/DisbursementForm";
import { DisbursementRecordPanel } from "@/components/admin/review/DisbursementRecordPanel";
import { serverApiFetch, ApiError, UnauthenticatedError } from "@/lib/server-api";
import { formatDob, formatReviewDate, formatReviewDateTime, relevantEarlierVersions, toCreditAdvisory } from "@/lib/application-review";
import { pickChecklist } from "@/lib/checklist";
import { ID_DOCUMENT_TYPES } from "@/lib/loan-wizard";
import { purposeLabel, staffStatusLabel } from "@/lib/officer-queues";
import { OUTCOME_STATUS, parseOutcome } from "@/lib/admin-decisions";
import { isDisbursementMethod, maskAccount } from "@/lib/disbursement";
import { recommendationLabel } from "@/lib/recommendations";
import { cn, formatKina } from "@/lib/utils";
import { formatPlainDate } from "@/lib/penalties";
import type { AdminApplicationReview, AdminLoanDetail, CustomerHistory, ReviewCustomer, ReviewDocument } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

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

const TAB_IDS = ["overview", "verification", "documents", "credit", "history"] as const;
type TabId = (typeof TAB_IDS)[number];

function parseTab(value: string | string[] | undefined): TabId {
  return TAB_IDS.find((t) => t === value) ?? "overview";
}

// Where the action panel is, for the status bar's jump link.
const ACTION_PANEL_ID = "action-panel";

// The Final Application Review workspace - and, once approved, where the
// disbursement is recorded. A compact header and the application's current
// state with its next step come first; the administrator's action (Approve
// / Reject / Return, or Record disbursement) sits in its own panel beside
// the information, outside the tabs, so it's always in reach and never
// loses what was typed. Which actions are offered is the backend's call
// (final_decision.can_*), never re-derived here. No amount or term editing.
//
// The information - everything the loan officer saw (reused panels, read-
// only), the officer's review and the customer's history - is split into
// tabs. All tabs are rendered; only one is shown (see ui/Tabs). ?tab=
// picks the first one shown.
//
// Data: GET /admin/applications/<id> (the officer review payload plus
// final_decision) and GET /admin/applications/<id>/customer-history.
// As on the officer screen, panels render named fields only.
export default async function AdminApplicationReviewPage({ params, searchParams }: PageProps) {
  const { applicationId } = await params;
  if (!/^\d+$/.test(applicationId)) notFound();
  const sp = await searchParams;
  const outcome = parseOutcome(sp.decided);
  const disbursedParam = typeof sp.disbursed === "string" && /^\d+$/.test(sp.disbursed) ? Number(sp.disbursed) : null;

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

  // A disbursed application's loan, read back from the backend. Its status
  // is the only source of "Loan Active" on this screen.
  let loan: AdminLoanDetail | null = null;
  if (fd.loan_id !== null) {
    try {
      loan = await serverApiFetch<AdminLoanDetail>(`/admin/loans/${fd.loan_id}`);
    } catch (err) {
      if (err instanceof UnauthenticatedError) redirect("/login");
      loan = null;
    }
  }
  const justDisbursed = loan !== null && disbursedParam === loan.loan_id && loan.status === "active";

  const latest = review.recommendations.at(-1) ?? null;
  const showOutcome = outcome !== null && application.status === OUTCOME_STATUS[outcome];
  const decidedOn = formatReviewDateTime(fd.decided_at);
  const canDecide = fd.can_approve || fd.can_reject || fd.can_return_to_officer;

  // ---- header ---------------------------------------------------------------
  const amount = application.pricing?.amount ?? application.amount_requested;
  const category = application.pricing?.category ?? application.prime_category;
  const purpose = purposeLabel(application.purpose_category);
  const submitted = formatReviewDate(application.submitted_at);

  // ---- the action panel -------------------------------------------------------
  const action = fd.can_disburse ? (
    <DisbursementForm
      applicationId={application.id}
      amount={application.pricing?.amount ?? application.amount_requested}
      totalRepayable={application.pricing?.total_repayable ?? null}
      requestedMethod={isDisbursementMethod(application.disbursement_method_requested) ? application.disbursement_method_requested : null}
      maskedDestination={maskAccount(application.disbursement_account_reference)}
    />
  ) : loan ? (
    <DisbursementRecordPanel loan={loan} />
  ) : application.status === "disbursed" ? (
    <Card>
      <CardTitle>Disbursement</CardTitle>
      <p className="mt-1 text-sm text-neutral-600">The loan record couldn&apos;t be loaded. Refresh to try again.</p>
    </Card>
  ) : canDecide ? (
    <FinalDecisionPanel
      applicationId={application.id}
      canApprove={fd.can_approve}
      canReject={fd.can_reject}
      canReturn={fd.can_return_to_officer}
      latestRecommendation={latest?.recommendation ?? null}
    />
  ) : null;

  // ---- the tabs -----------------------------------------------------------------
  const twoUp = "grid gap-4 @3xl:grid-cols-2 @3xl:items-start";

  const overview = (
    <div className="@container flex flex-col gap-4">
      <OfficerReviewPanel review={review} />
      {(review.recommendations.length > 1 || review.admin_returns.length > 0) && (
        <RecommendationHistoryPanel recommendations={review.recommendations} adminReturns={review.admin_returns} />
      )}
      <div className={twoUp}>
        <CustomerPanel
          customer={customer}
          applicationId={application.id}
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
    <div className="@container flex flex-col gap-4">
      <CustomerVerificationSummary customer={customer} />
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
    </div>
  );

  const documentsTab = (
    <DocumentsPanel
      documents={documents}
      earlierVersions={earlierVersions}
      referees={application.referees}
      checklist={checklist}
      informationRequests={review.information_requests}
      verifiedIdDocumentId={customer.verification?.id_document_id ?? null}
    />
  );

  const credit = (
    <CreditAdvisoryPanel advisory={toCreditAdvisory(credit_assessment.result)} label={credit_assessment.label} application={application} />
  );

  const historyTab = (
    <section aria-labelledby="customer-history-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="customer-history-heading" className="font-display text-section-title font-bold tracking-tight text-neutral-900">
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
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: "/admin", label: "Back to dashboard" }}
        title={`Application #${application.id}`}
        meta={<StatusBadge status={application.status}>{staffStatusLabel(application.status)}</StatusBadge>}
        description={
          <>
            <span className="block text-base font-semibold text-neutral-900">{customer.full_name}</span>
            <span className="mt-0.5 block">
              <span className="font-medium tabular-nums text-neutral-900">{formatKina(amount)}</span>
              {category ? ` · ${category}` : ""}
              {purpose ? ` · ${purpose}` : ""}
            </span>
            {submitted && <span className="mt-0.5 block text-helper">Submitted {submitted}</span>}
          </>
        }
      />

      <StatusBar
        status={application.status}
        showOutcome={showOutcome ? outcome : null}
        justDisbursed={justDisbursed && loan ? loan : null}
        awaitingDecision={fd.awaiting}
        canDecide={canDecide}
        canDisburse={fd.can_disburse}
        decidedOn={decidedOn}
        latestRecommendation={latest ? { label: recommendationLabel(latest.recommendation), officer: latest.officer_name } : null}
        loanId={fd.loan_id}
      />

      <div className={cn("grid gap-6", action && "xl:grid-cols-[minmax(0,1fr)_23rem] xl:items-start")}>
        {/* The action comes first in reading order (it's the task), and
            moves to the right-hand column on wide screens. */}
        {action && (
          <div id={ACTION_PANEL_ID} className="scroll-mt-24 xl:col-start-2 xl:row-start-1">
            {action}
          </div>
        )}
        <Tabs<TabId>
          label="Application details"
          initialTab={parseTab(sp.tab)}
          className="min-w-0 xl:col-start-1 xl:row-start-1"
          tabs={[
            { id: "overview", label: "Overview", content: overview },
            { id: "verification", label: "Verification", content: verification },
            { id: "documents", label: "Documents", count: documents.length, content: documentsTab },
            { id: "credit", label: "Credit assessment", content: credit },
            { id: "history", label: "History", content: historyTab },
          ]}
        />
      </div>
    </div>
  );
}

// ---- status bar ---------------------------------------------------------------

interface StatusBarProps {
  status: string;
  showOutcome: keyof typeof OUTCOME_BANNER | null;
  justDisbursed: AdminLoanDetail | null;
  awaitingDecision: boolean;
  canDecide: boolean;
  canDisburse: boolean;
  decidedOn: string | null;
  latestRecommendation: { label: string; officer: string | null } | null;
  loanId: number | null;
}

// Where the application stands and what happens next, in one place under
// the header. A just-made decision or payout is announced (role="status");
// the standing state is plain text, so it isn't re-announced on every visit.
function StatusBar(p: StatusBarProps) {
  const jump = (label: string) => (
    <a href={`#${ACTION_PANEL_ID}`} className={buttonClasses()}>
      {label}
    </a>
  );

  if (p.justDisbursed) {
    return (
      <Alert tone="success" role="status" title="Disbursement recorded · Loan Active">
        Loan #{p.justDisbursed.loan_id} is active. {formatKina(p.justDisbursed.terms.original_total_due)} is due{" "}
        {formatPlainDate(p.justDisbursed.terms.due_date)}.
      </Alert>
    );
  }

  if (p.showOutcome) {
    const banner = OUTCOME_BANNER[p.showOutcome];
    return (
      <Alert
        tone="success"
        role="status"
        title={banner.title}
        actions={
          p.showOutcome === "approved" && p.canDisburse ? jump("Record disbursement") : (
            <Link href="/admin" className={buttonClasses({ variant: "secondary" })}>
              Back to the dashboard
            </Link>
          )
        }
      >
        {banner.body}
      </Alert>
    );
  }

  let tone: AlertTone;
  let title: string;
  let body: React.ReactNode;
  let actions: React.ReactNode = null;

  if (p.awaitingDecision) {
    tone = "warning";
    title = "Waiting on your final decision";
    body = p.latestRecommendation
      ? `${p.latestRecommendation.officer ?? "The loan officer"}: ${p.latestRecommendation.label.toLowerCase()}. Approve, reject or return it to the loan officer.`
      : "Approve, reject or return it to the loan officer.";
    if (p.canDecide) actions = jump("Make the decision");
  } else if (p.status === "awaiting_disbursement") {
    tone = "warning";
    title = "Approved — Awaiting Disbursement";
    body = (
      <>
        Approved{p.decidedOn ? ` ${p.decidedOn}` : ""}. The loan isn&apos;t active yet: it&apos;s created when the money is paid
        out.
      </>
    );
    if (p.canDisburse) actions = jump("Record disbursement");
  } else if (p.status === "disbursed") {
    tone = "success";
    title = "Disbursed";
    body = p.loanId !== null ? `Paid out as loan #${p.loanId}. The disbursement record is with this application.` : "Paid out.";
  } else if (p.status === "rejected") {
    tone = "danger";
    title = "Rejected";
    body = `Rejected${p.decidedOn ? ` ${p.decidedOn}` : ""}.`;
  } else {
    tone = "info";
    title = "With the loan officer";
    body = "With the loan officer. It isn't ready for a final decision yet.";
  }

  return (
    <Alert tone={tone} role={null} title={title} actions={actions}>
      {body}
    </Alert>
  );
}

// ---- verification tab -------------------------------------------------------------

// The customer's identity verification at a glance, from the same record
// the Customer panel reads (customer.verification) - so the Verification
// tab holds every check without moving the panel off the Overview.
function CustomerVerificationSummary({ customer }: { customer: ReviewCustomer }) {
  const v = customer.verification;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Customer verification</CardTitle>
        {v ? <Badge variant="success">Verified customer</Badge> : <Badge variant="warning">Not yet verified</Badge>}
      </div>
      <DetailList className="mt-3">
        <DetailRow
          label="Verified"
          value={v ? [formatReviewDate(v.verified_at), v.verified_by_name ? `by ${v.verified_by_name}` : null].filter(Boolean).join(" ") : null}
          fallback="No current verification"
        />
        {v && <DetailRow label="Valid until" value={formatDob(v.valid_until)} />}
        {v?.id_expiry_date && <DetailRow label="ID expires" value={formatDob(v.id_expiry_date)} />}
      </DetailList>
    </Card>
  );
}
