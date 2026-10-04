import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDob, formatReviewDate } from "@/lib/application-review";
import { loanStatusLabel, loanStatusTone, plural } from "@/lib/customer-history";
import { formatPlainDate } from "@/lib/penalties";
import { staffStatusLabel } from "@/lib/officer-queues";
import { cn, formatKina } from "@/lib/utils";
import type { CustomerHistory } from "@/lib/types";

function Stat({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "danger" | "warning" }) {
  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <span
        className={cn(
          "mt-1 font-display text-2xl font-bold tracking-tight",
          tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-800" : "text-neutral-900",
        )}
      >
        {value}
      </span>
      {detail && <span className="mt-auto pt-1 text-xs text-neutral-500">{detail}</span>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

// The history of the customer behind ONE application, as the backend
// computes it - every count and Kina figure is the backend's. Previous
// applications and loans are listed but deliberately not linked: following
// them would turn this into a way to browse the customer's other records,
// which the backend's scoping (history only through an application under
// review) is there to prevent.
export function CustomerHistoryView({ history }: { history: CustomerHistory }) {
  const { summary: s, repayment_record: r, penalties } = history;

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="history-summary">
        <h3 id="history-summary" className="sr-only">
          Summary
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardTitle>Repayment record</CardTitle>
          <p className="mt-1 text-xs text-neutral-600">Across every installment on the customer&apos;s past and current loans.</p>
          <dl className="mt-2 divide-y divide-neutral-100">
            <Row label="Completed loans" value={s.loans_completed} />
            <Row label="On-time repayments" value={r.installments_paid_on_time} />
            <Row
              label="Late repayments"
              value={<span className={r.installments_paid_late > 0 ? "text-amber-800" : undefined}>{r.installments_paid_late}</span>}
            />
            <Row
              label="Overdue right now"
              value={
                <span className={r.installments_currently_overdue > 0 ? "text-red-700" : undefined}>
                  {r.installments_currently_overdue}
                </span>
              }
            />
            <Row label="Ever overdue (paid late or still unpaid)" value={r.installments_ever_overdue} />
          </dl>
          <p className="mt-3 text-xs text-neutral-600">
            Payments: {r.payments_verified} verified · {r.payments_awaiting_verification} awaiting verification ·{" "}
            {r.payments_rejected} rejected
          </p>
        </Card>

        <Card>
          <CardTitle>Penalties</CardTitle>
          {/* Newer backends send real penalty data (policy, total, items);
              older ones send applicable: false with no figures. Never claim
              there's no penalty policy - one exists once the penalty job runs. */}
          {penalties.items && penalties.items.length > 0 ? (
            <>
              <p className="mt-2 text-sm font-medium text-neutral-900">
                {formatKina(penalties.total_charged ?? penalties.items.reduce((sum, i) => sum + i.amount, 0))} charged
                across {penalties.items.length === 1 ? "1 penalty" : `${penalties.items.length} penalties`}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-700">
                {penalties.items.map((item) => (
                  <li key={`${item.loan_id}-${item.tier}-${item.applied_on}`}>
                    Loan #{item.loan_id}: {item.reason}
                    {formatPlainDate(item.applied_on) ? ` (${formatPlainDate(item.applied_on)})` : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm font-medium text-neutral-900">No late penalties charged</p>
          )}
          {penalties.policy && <p className="mt-2 text-xs text-neutral-600">{penalties.policy}</p>}
        </Card>
      </div>

      <Card>
        <CardTitle>Previous applications</CardTitle>
        {history.previous_applications.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">This is the customer&apos;s first application.</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100">
            {history.previous_applications.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-neutral-900">
                    Application #{p.id} · {formatKina(p.amount_requested)}
                    {p.prime_category ? ` · ${p.prime_category}` : ""}
                  </p>
                  <p className="text-xs text-neutral-600">
                    Submitted {formatReviewDate(p.submitted_at) ?? "—"}
                    {p.decided_at ? ` · decided ${formatReviewDate(p.decided_at)}` : ""}
                    {p.loan_id ? ` · became loan #${p.loan_id}` : ""}
                  </p>
                </div>
                <Badge variant={p.status === "rejected" ? "danger" : "neutral"} className="w-fit">
                  {staffStatusLabel(p.status)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Loans</CardTitle>
        {history.loans.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">No loans yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100">
            {history.loans.map((loan) => (
              <li key={loan.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-neutral-900">Loan #{loan.id}</p>
                  <Badge variant={loanStatusTone(loan)}>{loanStatusLabel(loan)}</Badge>
                </div>
                <p className="mt-1 text-neutral-700">
                  {formatKina(loan.principal_amount)} borrowed · {formatKina(loan.total_repayable)} to repay ·{" "}
                  {formatKina(loan.amount_paid)} paid
                  {loan.outstanding > 0 ? ` · ${formatKina(loan.outstanding)} outstanding` : ""}
                </p>
                <p className="mt-0.5 text-xs text-neutral-600">
                  {loan.disbursed_at ? `Disbursed ${formatReviewDate(loan.disbursed_at)}` : "Not disbursed"}
                  {loan.due_date ? ` · due ${formatDob(loan.due_date)}` : ""} · Installments:{" "}
                  {loan.installments.paid_on_time} on time, {loan.installments.paid_late} late, {loan.installments.overdue}{" "}
                  overdue (of {loan.installments.total})
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
