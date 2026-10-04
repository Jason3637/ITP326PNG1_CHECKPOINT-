import { Card } from "@/components/ui/Card";
import { cn, focusRing, formatKina } from "@/lib/utils";
import { formatPlainDate } from "@/lib/penalties";
import { plural } from "@/lib/customer-history";
import type { AdminAnalytics, AdminQueue, AdminQueueCounts } from "@/lib/types";

interface DashboardSummaryProps {
  counts: AdminQueueCounts;
  analytics: AdminAnalytics;
}

function SummaryCard({ title, children, definition }: { title: string; children: React.ReactNode; definition?: string }) {
  return (
    <li>
      <Card className="flex h-full flex-col p-4">
        <h3 className="text-sm font-semibold text-neutral-700">{title}</h3>
        <div className="mt-2 flex flex-1 flex-col gap-1">{children}</div>
        {definition && <p className="mt-3 text-xs text-neutral-500">{definition}</p>}
      </Card>
    </li>
  );
}

function BigFigure({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-3xl font-bold tracking-tight text-neutral-900">{children}</p>;
}

// A queue count that jumps to that queue's section below.
function CountLink({ queue, label, count, extra }: { queue: AdminQueue; label: string; count: number; extra?: string }) {
  return (
    <a
      href={`#queue-${queue}`}
      className={cn("flex items-baseline justify-between gap-3 rounded px-1 py-0.5 text-sm hover:bg-neutral-50", focusRing)}
    >
      <span className="text-neutral-700">{label}</span>
      <span className="text-right">
        <span className="font-display text-xl font-bold text-neutral-900">{count}</span>
        {extra && <span className="ml-1 text-xs text-neutral-600">{extra}</span>}
      </span>
    </a>
  );
}

// The five questions the dashboard answers. Every figure is the backend's:
// queue counts from GET /admin/queues, money from GET /admin/analytics
// (each with its own definition, shown under it). Nothing here is added
// up from the queue lists, which are only a page of each queue anyway.
export function DashboardSummary({ counts, analytics }: DashboardSummaryProps) {
  const q = counts.queues;
  const { disbursements: d, portfolio: p, window } = analytics;
  const from = formatPlainDate(window.from);
  const to = formatPlainDate(window.to);
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <SummaryCard title="Needs your attention">
        <CountLink queue="awaiting_decision" label="Waiting on a final decision" count={q.awaiting_decision.count} />
        <CountLink queue="awaiting_disbursement" label="Approved, waiting to be paid out" count={q.awaiting_disbursement.count} />
      </SummaryCard>

      <SummaryCard title="Disbursed" definition={d.principal_disbursed.definition}>
        <BigFigure>{formatKina(d.principal_disbursed.value)}</BigFigure>
        <p className="text-sm text-neutral-600">
          {plural(d.loans_disbursed.value, "loan")} paid out, {from} – {to}
        </p>
      </SummaryCard>

      <SummaryCard title="Outstanding" definition={p.outstanding_value.definition}>
        <BigFigure>{formatKina(p.outstanding_value.value)}</BigFigure>
        <p className="text-sm text-neutral-600">Across {plural(p.active_loans.value, "active loan")}</p>
      </SummaryCard>

      <SummaryCard title="Due and overdue" definition={p.overdue_value.definition}>
        <CountLink queue="due_today" label="Due today" count={q.due_today.count} />
        <CountLink queue="due_this_week" label="Due this week" count={q.due_this_week.count} />
        <CountLink
          queue="overdue"
          label="Overdue"
          count={q.overdue.count}
          extra={`${formatKina(p.overdue_value.value)} owed`}
        />
      </SummaryCard>

      <SummaryCard title="Awaiting verification">
        <a href="#queue-repayments_awaiting_verification" className={cn("w-fit rounded", focusRing)}>
          <BigFigure>{q.repayments_awaiting_verification.count}</BigFigure>
        </a>
        <p className="text-sm text-neutral-600">
          Repayments reported by customers. They don&apos;t reduce a balance until you verify them.
        </p>
      </SummaryCard>
    </ul>
  );
}
