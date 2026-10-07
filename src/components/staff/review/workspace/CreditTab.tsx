import { ChevronRight, Info, ScrollText } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Card, CardTitle } from "@/components/ui/Card";
import { CompactEmptyState } from "@/components/ui/EmptyState";
import { ADVISORY_DISCLAIMER } from "@/components/staff/review/CreditAdvisoryPanel";
import { CREDIT_CRITERIA, employmentLabel, formatReviewDate, formatReviewDateTime } from "@/lib/application-review";
import { plural } from "@/lib/customer-history";
import { cn, formatKina } from "@/lib/utils";
import { sectionHeading } from "./table";
import type { HistoryResult } from "./history-result";
import type { CreditAdvisory, ReviewApplication, ReviewCustomer } from "@/lib/types";

interface CreditTabProps {
  advisory: CreditAdvisory | null;
  // The backend's own wording: "Advisory - not a decision input".
  label: string;
  application: Pick<ReviewApplication, "amount_requested" | "monthly_income" | "employment_status" | "existing_monthly_debt">;
  customer: Pick<ReviewCustomer, "is_active" | "member_since">;
  history: HistoryResult;
}

function Figure({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-neutral-200 px-3 py-2.5">
      <dt className="text-xs font-medium text-neutral-600">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold tabular-nums text-neutral-900">{value}</dd>
      {hint && <dd className="text-xs text-neutral-500">{hint}</dd>}
    </div>
  );
}

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-neutral-200">
      <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
        {title}
      </summary>
      <div className="border-t border-neutral-100 px-3 py-3">{children}</div>
    </details>
  );
}

const SELF_REPORTED = "Self-reported, not verified";

// The officer's Credit assessment tab. Advisory first and always: the
// backend's label and the one current disclaimer sit above everything else.
// Then what the assessment noted, in its own words, then the key figures it
// worked from, then - on request - what each factor looked at and which
// inputs it used.
//
// What's never shown (stripped in toCreditAdvisory before it gets here):
// the numeric score, the eligible flag, the review/decline recommendation
// and the max eligible amount - any of which would read as the system
// deciding. Nothing here is recalculated: every figure is the backend's
// (application, customer record, customer history). The assessment returns
// no structured flags or severities - only its notes - so none are invented.
export function CreditTab({ advisory, label, application, customer, history }: CreditTabProps) {
  const h = history.status === "ok" ? history.history : null;

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info" role="note" icon={Info} title={label}>
        {ADVISORY_DISCLAIMER} Income and employment are as reported by the customer and are not verified.
      </Alert>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <CardTitle>Credit notes</CardTitle>
          {advisory && (
            <p className="text-xs text-neutral-600">Generated {formatReviewDateTime(advisory.evaluated_at) ?? "at submission"}</p>
          )}
        </div>

        {!advisory ? (
          <CompactEmptyState>No credit notes were produced for this application.</CompactEmptyState>
        ) : (
          <section aria-labelledby="credit-notes" className="flex flex-col gap-2">
            <h3 id="credit-notes" className={sectionHeading}>
              What the assessment noted <span className="font-sans text-sm font-normal text-neutral-500">({advisory.reasons.length})</span>
            </h3>
            {advisory.insufficient_data && (
              <p className="rounded-md bg-warning-light px-3 py-2 text-sm text-amber-800">
                <span className="font-semibold">Incomplete information: </span>
                the customer didn&apos;t report enough information (such as monthly income) for the affordability checks to run.
              </p>
            )}
            <ul className="flex flex-col divide-y divide-neutral-100">
              {advisory.reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 py-2 text-sm text-neutral-800">
                  <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  {reason}
                </li>
              ))}
            </ul>
            <p className="text-xs text-neutral-500">In the assessment&apos;s own words. It doesn&apos;t rank or score these notes here.</p>
          </section>
        )}

        <section aria-labelledby="credit-figures" className="flex flex-col gap-2">
          <h3 id="credit-figures" className={sectionHeading}>
            Key figures
          </h3>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Figure label="Requested amount" value={formatKina(application.amount_requested)} />
            <Figure
              label="Monthly income"
              value={application.monthly_income !== null ? formatKina(application.monthly_income) : "Not reported"}
              hint={SELF_REPORTED}
            />
            <Figure
              label="Existing monthly debt"
              value={application.existing_monthly_debt !== null ? formatKina(application.existing_monthly_debt) : "Not reported"}
              hint={SELF_REPORTED}
            />
            <Figure
              label="Employment status"
              value={employmentLabel(application.employment_status) ?? "Not reported"}
              hint={SELF_REPORTED}
            />
            <Figure
              label="Account standing"
              value={customer.is_active ? "Active" : <span className="text-red-700">Disabled</span>}
            />
            <Figure label="Member since" value={formatReviewDate(customer.member_since) ?? "Not recorded"} />
            {h && (
              <>
                <Figure
                  label="Previous loans"
                  value={plural(h.summary.loans_total, "loan")}
                  hint={`${h.summary.loans_completed} completed${h.summary.loans_defaulted > 0 ? `, ${h.summary.loans_defaulted} defaulted` : ""}`}
                />
                <Figure
                  label="Repayment record"
                  value={`${h.repayment_record.installments_paid_on_time} on time · ${h.repayment_record.installments_paid_late} late`}
                  hint={`${h.repayment_record.installments_currently_overdue} overdue right now`}
                />
              </>
            )}
          </dl>
          {!h && (
            <p className="text-xs text-neutral-500">
              Previous loans and repayment record: not available -{" "}
              {history.status === "unavailable" ? "customer history is shown only while the application is under review." : "customer history couldn't be loaded."}
            </p>
          )}
        </section>

        {advisory && (
          <div className="flex flex-col gap-2">
            <Disclosure title={`Assessment factors (${advisory.criteria_checked.length})`}>
              <ul className="flex flex-col divide-y divide-neutral-100">
                {advisory.criteria_checked.map((key) => {
                  const c = CREDIT_CRITERIA[key];
                  return (
                    <li key={key} className="py-2 text-sm first:pt-0 last:pb-0">
                      <p className="font-medium text-neutral-900">{c?.label ?? "Other check"}</p>
                      <p className="text-xs text-neutral-600">{c?.input ?? "Details not described by the system."}</p>
                    </li>
                  );
                })}
              </ul>
            </Disclosure>
            <Disclosure title="Inputs used from this application">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                {[
                  ["Requested", formatKina(application.amount_requested)],
                  ["Income", application.monthly_income !== null ? formatKina(application.monthly_income) : "not reported"],
                  [
                    "Existing debt",
                    application.existing_monthly_debt !== null ? formatKina(application.existing_monthly_debt) : "not reported",
                  ],
                  ["Employment", employmentLabel(application.employment_status) ?? "not reported"],
                ].map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-neutral-600">{k}</dt>
                    <dd className={cn("tabular-nums text-neutral-900")}>{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-neutral-500">
                The member&apos;s repayment history, previous loans, account standing and membership come from their record.
              </p>
            </Disclosure>
          </div>
        )}
      </Card>
    </div>
  );
}
