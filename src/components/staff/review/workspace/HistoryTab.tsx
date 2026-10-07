import { Lock } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { CompactEmptyState } from "@/components/ui/EmptyState";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RecommendationHistoryPanel } from "@/components/staff/review/RecommendationHistoryPanel";
import { formatDob, formatReviewDate } from "@/lib/application-review";
import { loanStatusLabel, loanStatusTone, plural } from "@/lib/customer-history";
import { formatPlainDate } from "@/lib/penalties";
import { statusPresentation } from "@/lib/status-presentation";
import { cn, formatKina } from "@/lib/utils";
import { num, scrollRegion, sectionHeading, table, tableWrap, td, th } from "./table";
import type { HistoryResult } from "./history-result";
import type { CustomerHistory, ReviewAdminReturn, ReviewRecommendation } from "@/lib/types";

interface HistoryTabProps {
  applicationId: number;
  recommendations: ReviewRecommendation[];
  adminReturns: ReviewAdminReturn[];
  history: HistoryResult;
}

const TONE_TEXT = { danger: "text-red-700", warning: "text-amber-800" } as const;

function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "danger" | "warning" }) {
  return (
    <div className="min-w-0 rounded-lg border border-neutral-200 px-3 py-2.5">
      <dt className="text-xs font-medium text-neutral-600">{label}</dt>
      <dd className={cn("mt-0.5 font-display text-xl font-bold tabular-nums tracking-tight", tone ? TONE_TEXT[tone] : "text-neutral-900")}>
        {value}
      </dd>
      <dd className="text-xs text-neutral-500">{detail}</dd>
    </div>
  );
}

function Section({ id, title, count, children }: { id: string; title: string; count?: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className={sectionHeading}>
        {title}
        {count !== undefined && <span className="font-sans text-sm font-normal text-neutral-500"> ({count})</span>}
      </h3>
      {children}
    </section>
  );
}

function Headers({ cols }: { cols: (string | [string, "num"])[] }) {
  return (
    <thead>
      <tr>
        {cols.map((c) => {
          const [label, kind] = Array.isArray(c) ? c : [c, null];
          return (
            <th key={label} scope="col" className={cn(th, kind === "num" && "text-right")}>
              {label}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

// The customer's record, as the backend computes it - every count and Kina
// figure is the backend's. Previous applications and loans are listed but
// deliberately not linked (the backend scopes history to the application
// under review, so this mustn't become a way to browse other records).
function CustomerRecord({ history, applicationId }: { history: CustomerHistory; applicationId: number }) {
  const { summary: s, repayment_record: r, penalties } = history;
  const penaltyItems = penalties.items ?? [];

  return (
    <Card className="flex flex-col gap-6">
      <div>
        <CardTitle>Customer history</CardTitle>
        <p className="mt-1 text-sm text-neutral-600">
          {history.customer.full_name}
          {history.customer.member_since ? ` · member since ${formatReviewDate(history.customer.member_since)}` : ""}. Shown
          for reviewing application #{history.application_id ?? applicationId}; excludes this application.
        </p>
      </div>

      <Section id="history-summary" title="Summary">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Previous applications"
            value={String(s.previous_applications)}
            detail={s.previous_applications_rejected > 0 ? `${s.previous_applications_rejected} rejected` : "None rejected"}
          />
          <Stat
            label="Previous loans"
            value={String(s.loans_total)}
            detail={`${s.loans_completed} completed${s.loans_defaulted > 0 ? `, ${s.loans_defaulted} defaulted` : ""}`}
            tone={s.loans_defaulted > 0 ? "danger" : undefined}
          />
          <Stat label="Total borrowed" value={formatKina(s.total_borrowed)} detail={`${formatKina(s.total_repaid)} repaid so far`} />
          <Stat
            label="Current exposure"
            value={formatKina(s.current_exposure)}
            detail={
              s.loans_active + s.loans_overdue > 0
                ? `Outstanding on ${plural(s.loans_active + s.loans_overdue, "open loan")}`
                : "No open loans"
            }
            tone={s.loans_overdue > 0 ? "danger" : s.current_exposure > 0 ? "warning" : undefined}
          />
        </dl>
      </Section>

      <Section id="history-repayments" title="Repayment record">
          <p className="text-xs text-neutral-600">Across every installment on the customer&apos;s past and current loans.</p>
          <dl className="grid max-w-xl grid-cols-[minmax(0,1fr)_auto] gap-x-4 text-sm">
            {(
              [
                ["Completed loans", s.loans_completed],
                ["On-time repayments", r.installments_paid_on_time],
                ["Late repayments", r.installments_paid_late, r.installments_paid_late > 0 ? "warning" : undefined],
                ["Overdue right now", r.installments_currently_overdue, r.installments_currently_overdue > 0 ? "danger" : undefined],
                ["Ever overdue (paid late or still unpaid)", r.installments_ever_overdue],
              ] as [string, number, ("warning" | "danger")?][]
            ).map(([label, value, tone]) => (
              <div key={label} className="contents">
                <dt className="border-b border-neutral-100 py-1.5 text-neutral-600">{label}</dt>
                <dd className={cn("border-b border-neutral-100 py-1.5 text-right font-medium tabular-nums", tone ? TONE_TEXT[tone] : "text-neutral-900")}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-neutral-600">
            Payments: {r.payments_verified} verified · {r.payments_awaiting_verification} awaiting verification · {r.payments_rejected}{" "}
            rejected
          </p>
        </Section>

      <Section id="history-penalties" title="Penalties" count={penaltyItems.length}>
          {/* Newer backends send real penalty data (policy, total, items);
              older ones send applicable: false with no figures. Never claim
              there's no penalty policy - one exists once the penalty job runs. */}
          {penaltyItems.length > 0 ? (
            <>
              <p className="text-sm font-medium text-neutral-900">
                {formatKina(penalties.total_charged ?? penaltyItems.reduce((sum, i) => sum + i.amount, 0))} charged across{" "}
                {plural(penaltyItems.length, "penalty", "penalties")}
              </p>
              <div className={tableWrap} {...scrollRegion("Penalties")}>
                <table className={table}>
                  <caption className="sr-only">Penalties</caption>
                  <Headers cols={["Loan", "Applied", "Reason", ["Amount", "num"]]} />
                  <tbody>
                    {penaltyItems.map((item) => (
                      <tr key={`${item.loan_id}-${item.tier}-${item.applied_on}`}>
                        <td className={cn(td, "whitespace-nowrap")}>#{item.loan_id}</td>
                        <td className={cn(td, "whitespace-nowrap")}>{formatPlainDate(item.applied_on) ?? "—"}</td>
                        <td className={td}>{item.reason}</td>
                        <td className={cn(td, num)}>{formatKina(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <CompactEmptyState>No late penalties charged.</CompactEmptyState>
          )}
          {penalties.policy && <p className="text-xs text-neutral-600">{penalties.policy}</p>}
        </Section>

      <Section id="history-applications" title="Previous applications" count={history.previous_applications.length}>
        {history.previous_applications.length === 0 ? (
          <CompactEmptyState>This is the customer&apos;s first application.</CompactEmptyState>
        ) : (
          <div className={tableWrap} {...scrollRegion("Previous applications")}>
            <table className={table}>
              <caption className="sr-only">Previous applications</caption>
              <Headers cols={["Application", "Dates", ["Amount", "num"], "PRIME", "Status", "Loan"]} />
              <tbody>
                {history.previous_applications.map((p) => {
                  const st = statusPresentation("application", p.status);
                  return (
                    <tr key={p.id}>
                      <td className={cn(td, "whitespace-nowrap font-medium text-neutral-900")}>#{p.id}</td>
                      <td className={td}>
                        <span className="block">Submitted {formatReviewDate(p.submitted_at) ?? "—"}</span>
                        {p.decided_at && <span className="block text-xs text-neutral-600">Decided {formatReviewDate(p.decided_at)}</span>}
                      </td>
                      <td className={cn(td, num)}>{formatKina(p.amount_requested)}</td>
                      <td className={cn(td, "whitespace-nowrap")}>{p.prime_category ?? "—"}</td>
                      <td className={td}>
                        <StatusBadge tone={st.tone} icon={st.icon}>
                          {st.label}
                        </StatusBadge>
                      </td>
                      <td className={cn(td, "whitespace-nowrap")}>{p.loan_id ? `Loan #${p.loan_id}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="history-loans" title="Loans" count={history.loans.length}>
        {history.loans.length === 0 ? (
          <CompactEmptyState>No previous loans.</CompactEmptyState>
        ) : (
          <div className={tableWrap} {...scrollRegion("Loans")}>
            <table className={table}>
              <caption className="sr-only">Loans</caption>
              <Headers cols={["Loan", "Dates", ["Borrowed", "num"], ["Paid / to repay", "num"], ["Outstanding", "num"]]} />
              <tbody>
                {history.loans.map((loan) => (
                  <tr key={loan.id}>
                    <td className={td}>
                      <span className="block whitespace-nowrap font-medium text-neutral-900">#{loan.id}</span>
                      <StatusBadge tone={loanStatusTone(loan)} icon className="mt-1">
                        {loanStatusLabel(loan)}
                      </StatusBadge>
                      <span className="mt-1 block text-xs text-neutral-600">
                        Installments: {loan.installments.paid_on_time} on time, {loan.installments.paid_late} late,{" "}
                        {loan.installments.overdue} overdue (of {loan.installments.total})
                      </span>
                    </td>
                    <td className={td}>
                      <span className="block">{loan.disbursed_at ? `Disbursed ${formatReviewDate(loan.disbursed_at)}` : "Not disbursed"}</span>
                      {loan.due_date && <span className="block text-xs text-neutral-600">Due {formatDob(loan.due_date)}</span>}
                    </td>
                    <td className={cn(td, num)}>{formatKina(loan.principal_amount)}</td>
                    <td className={cn(td, num)}>
                      {formatKina(loan.amount_paid)} <span className="text-neutral-500">/ {formatKina(loan.total_repayable)}</span>
                    </td>
                    <td className={cn(td, num, loan.outstanding > 0 && "font-medium text-neutral-900")}>{formatKina(loan.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Card>
  );
}

// The officer's History tab: the recommendations made on this application
// (and any returns), then the customer's record. History visibility is the
// backend's: officers get a 403 once the application is decided, shown as
// "not available" - never as an empty record.
export function HistoryTab({ applicationId, recommendations, adminReturns, history }: HistoryTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {recommendations.length > 0 ? (
        <RecommendationHistoryPanel recommendations={recommendations} adminReturns={adminReturns} />
      ) : (
        <Panel title="Recommendations" as="h3">
          <CompactEmptyState>No recommendation has been sent for this application yet.</CompactEmptyState>
        </Panel>
      )}

      {history.status === "ok" ? (
        <CustomerRecord history={history.history} applicationId={applicationId} />
      ) : history.status === "unavailable" ? (
        <Card>
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" aria-hidden="true" />
            <div>
              <CardTitle>Customer history isn&apos;t available</CardTitle>
              <p className="mt-1 text-sm text-neutral-600">
                Loan officers can see a customer&apos;s history only while the application they reached it from is still under
                review. Application #{applicationId} has been decided.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <CardTitle>Customer history</CardTitle>
          <p className="mt-1 text-sm text-neutral-600">Customer history couldn&apos;t be loaded. Refresh the page to try again.</p>
        </Card>
      )}
    </div>
  );
}
