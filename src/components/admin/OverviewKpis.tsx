import Link from "next/link";
import { Banknote, CalendarX, ReceiptText, Scale } from "lucide-react";
import { MetricCard, type MetricTone } from "@/components/ui/MetricCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { adminQueueHref } from "@/lib/admin-queues";
import { formatPlainDate } from "@/lib/penalties";
import { plainDefinition } from "@/lib/plain-definition";
import { plural } from "@/lib/customer-history";
import { cn, focusRing, formatKina } from "@/lib/utils";
import type { AdminAnalytics, AdminQueueCounts } from "@/lib/types";

interface OverviewKpisProps {
  counts: AdminQueueCounts;
  analytics: AdminAnalytics;
}

// Waiting work reads loud only when there is some; zero goes quiet, so
// the cards that need the administrator are the ones that stand out.
const waiting = (count: number, loud: MetricTone = "attention"): MetricTone => (count > 0 ? loud : "calm");

const subLink = cn("rounded font-medium text-primary hover:text-primary-dark", focusRing);

// The Overview's figures, in two tiers. First, "what needs me?": the four
// queues of work waiting on an administrator, each opening its queue.
// Then the portfolio, smaller. Every figure is the backend's - queue
// counts from GET /admin/queues, money from GET /admin/analytics, each
// with its own definition - never added up from the listed items.
export function OverviewKpis({ counts, analytics }: OverviewKpisProps) {
  const q = counts.queues;
  const { disbursements: d, portfolio: p, window } = analytics;
  const decision = q.awaiting_decision.count;
  const payout = q.awaiting_disbursement.count;
  const verify = q.repayments_awaiting_verification.count;
  const overdue = q.overdue.count;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
        <SectionHeader id="attention-heading" as="h3" title="Needs your attention" />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            as="li"
            href={adminQueueHref("awaiting_decision")}
            icon={Scale}
            tone={waiting(decision)}
            label="Needs decision"
            value={decision}
            status={decision > 0 ? "Recommended and waiting on you" : "Nothing waiting"}
          />
          <MetricCard
            as="li"
            href={adminQueueHref("awaiting_disbursement")}
            icon={Banknote}
            tone={waiting(payout)}
            label="Awaiting disbursement"
            value={payout}
            status={payout > 0 ? "Approved, waiting to be paid out" : "Nothing to pay out"}
          />
          <MetricCard
            as="li"
            href={adminQueueHref("repayments_awaiting_verification")}
            icon={ReceiptText}
            tone={waiting(verify)}
            label="Repayments to verify"
            value={verify}
            status={verify > 0 ? "Not counted until you verify them" : "Nothing to verify"}
          />
          <MetricCard
            as="li"
            href={adminQueueHref("overdue")}
            icon={CalendarX}
            tone={waiting(overdue, "critical")}
            label="Overdue"
            value={overdue}
            status={`${formatKina(p.overdue_value.value)} owed`}
            definition={plainDefinition(p.overdue_value.definition)}
          />
        </ul>
      </section>

      <section aria-labelledby="portfolio-heading" className="flex flex-col gap-3">
        <SectionHeader id="portfolio-heading" as="h3" title="Portfolio" scope={`As of ${formatPlainDate(counts.as_of)}`} />
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard
            as="li"
            size="sm"
            label="Active loans"
            value={p.active_loans.value}
            definition={plainDefinition(p.active_loans.definition)}
          >
            <p className="text-sm text-neutral-600">
              <Link href={adminQueueHref("due_today")} className={subLink}>
                {q.due_today.count} due today
              </Link>
              {" · "}
              <Link href={adminQueueHref("due_this_week")} className={subLink}>
                {q.due_this_week.count} due this week
              </Link>
            </p>
          </MetricCard>
          <MetricCard
            as="li"
            size="sm"
            label="Outstanding"
            value={formatKina(p.outstanding_value.value)}
            definition={plainDefinition(p.outstanding_value.definition)}
          />
          <MetricCard
            as="li"
            size="sm"
            label="Disbursed, last 30 days"
            value={formatKina(d.principal_disbursed.value)}
            status={`${plural(d.loans_disbursed.value, "loan")} paid out, ${formatPlainDate(window.from)} – ${formatPlainDate(window.to)}`}
            definition={plainDefinition(d.principal_disbursed.definition)}
          />
        </ul>
      </section>
    </div>
  );
}
