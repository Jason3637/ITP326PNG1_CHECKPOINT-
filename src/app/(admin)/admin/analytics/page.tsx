import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MetricGroup, MetricTile } from "@/components/admin/analytics/MetricTile";
import { ChartCard } from "@/components/admin/analytics/ChartCard";
import { serverApiFetch, ApiError, UnauthenticatedError, customerSafeMessage } from "@/lib/server-api";
import {
  analyticsHref,
  categoryRows,
  formatHours,
  formatRate,
  lastDays,
  parseDateParam,
  weeklyWindows,
} from "@/lib/admin-analytics";
import { formatPlainDate } from "@/lib/penalties";
import { cn, focusRing, formatKina } from "@/lib/utils";
import type { AdminAnalytics, ProcessingTime } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

const TREND_WEEKS = 8;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const pillClass = (active: boolean) =>
  cn(
    "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium",
    focusRing,
    active
      ? "border-primary bg-primary-light text-primary-dark"
      : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  );

function hoursValue(t: ProcessingTime): string {
  return t.count === 0 ? "—" : `${formatHours(t.median_hours)} median`;
}

function hoursDefinition(definition: string, t: ProcessingTime): string {
  return t.count === 0 ? `${definition} None in the period.` : `${definition} Average ${formatHours(t.average_hours)} over ${t.count}.`;
}

// Administrator analytics, all from GET /admin/analytics. Every figure is
// the backend's, shown with the backend's own definition; nothing is added
// up in the browser. Figures are grouped by what they measure - money paid
// out, money received, the portfolio right now - and each group says
// whether it counts events in the period or is a snapshot as of now, so
// principal disbursed, exposure, expected repayment, verified repayments,
// outstanding and overdue value never read as the same number.
//
// Charts are kept for genuine comparisons (PRIME categories, the weekly
// trend). The trend is TREND_WEEKS more calls to the same endpoint, one
// per week, so each point is the backend's own figure for that week.
export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to);
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);

  let a: AdminAnalytics;
  try {
    a = await serverApiFetch<AdminAnalytics>(`/admin/analytics${query.size ? `?${query}` : ""}`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    if (err instanceof ApiError && err.status === 400) {
      return (
        <Card className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
          <div>
            <p className="font-medium text-neutral-900">That date range can&apos;t be used</p>
            <p className="mt-1 text-sm text-neutral-600">
              {/from must be on or before to/.test(err.message)
                ? "The start date has to be on or before the end date."
                : customerSafeMessage(err)}
            </p>
            <Link href={analyticsHref()} className={cn("mt-2 inline-block rounded text-sm font-medium text-primary", focusRing)}>
              Show the last 30 days
            </Link>
          </div>
        </Card>
      );
    }
    throw err;
  }

  // Weekly trend - a failure here shouldn't take down the figures.
  const weeks = weeklyWindows(a.window.to, TREND_WEEKS);
  const weekly = await Promise.allSettled(
    weeks.map((w) => serverApiFetch<AdminAnalytics>(`/admin/analytics?from=${w.from}&to=${w.to}`)),
  );
  for (const r of weekly) if (r.status === "rejected" && r.reason instanceof UnauthenticatedError) redirect("/login");
  const trendOk = weekly.every((r) => r.status === "fulfilled");
  const trend = trendOk ? (weekly as PromiseFulfilledResult<AdminAnalytics>[]).map((r) => r.value) : [];

  const apps = a.applications;
  const disb = a.disbursements;
  const port = a.portfolio;
  const reps = a.repayments;
  const times = a.processing_times;
  const period = `${formatPlainDate(a.window.from)} – ${formatPlainDate(a.window.to)}`;
  const appCats = categoryRows(apps.by_prime_category.value);
  const disbCats = categoryRows(disb.by_prime_category.value);
  const presets = [7, 30, 90].map((d) => ({ days: d, ...lastDays(a.as_of, d) }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-neutral-900">Analytics</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {period}, Port Moresby time. Period figures count what happened in these dates; portfolio figures are as of{" "}
            {formatPlainDate(a.as_of)}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <nav aria-label="Date range" className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Link
                key={p.days}
                href={analyticsHref(p)}
                aria-current={a.window.from === p.from && a.window.to === p.to ? "page" : undefined}
                className={pillClass(a.window.from === p.from && a.window.to === p.to)}
              >
                Last {p.days} days
              </Link>
            ))}
          </nav>
          <form method="get" action="/admin/analytics" className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
              From
              <input type="date" name="from" defaultValue={a.window.from} required className="h-9 rounded-lg border border-neutral-300 bg-white px-2 text-sm text-neutral-900" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
              To
              <input type="date" name="to" defaultValue={a.window.to} max={a.as_of} required className="h-9 rounded-lg border border-neutral-300 bg-white px-2 text-sm text-neutral-900" />
            </label>
            <Button type="submit" variant="secondary" size="sm">
              Apply
            </Button>
          </form>
        </div>
      </div>

      <MetricGroup title="Money paid out" scope="In the period">
        <MetricTile label="Principal disbursed" value={formatKina(disb.principal_disbursed.value)} definition={disb.principal_disbursed.definition} />
        <MetricTile label="Interest contracted" value={formatKina(disb.interest_contracted.value)} definition={disb.interest_contracted.definition} />
        <MetricTile label="Expected repayment" value={formatKina(disb.expected_repayment.value)} definition={disb.expected_repayment.definition} />
        <MetricTile label="Loans disbursed" value={String(disb.loans_disbursed.value)} definition={disb.loans_disbursed.definition} />
      </MetricGroup>

      <MetricGroup title="Money received" scope="In the period">
        <MetricTile label="Verified repayments" value={formatKina(reps.verified_repayments.value)} definition={reps.verified_repayments.definition} />
        <MetricTile label="Penalties charged" value={formatKina(reps.penalties_charged.value)} definition={reps.penalties_charged.definition} />
      </MetricGroup>

      <MetricGroup title="Portfolio" scope={`As of ${formatPlainDate(a.as_of)}`}>
        <MetricTile label="Outstanding" value={formatKina(port.outstanding_value.value)} definition={port.outstanding_value.definition} />
        <MetricTile label="Active principal exposure" value={formatKina(port.active_principal_exposure.value)} definition={port.active_principal_exposure.definition} />
        <MetricTile label="Overdue value" value={formatKina(port.overdue_value.value)} definition={port.overdue_value.definition} />
        <MetricTile label="Active loans" value={String(port.active_loans.value)} definition={port.active_loans.definition} />
        <MetricTile label="Overdue loans" value={String(port.overdue_loans.value)} definition={port.overdue_loans.definition} />
      </MetricGroup>

      <MetricGroup title="Applications" scope="In the period">
        <MetricTile label="Received" value={String(apps.received.value)} definition={apps.received.definition} />
        <MetricTile label="Approved" value={String(apps.approved.value)} definition={apps.approved.definition} />
        <MetricTile label="Rejected" value={String(apps.rejected.value)} definition={apps.rejected.definition} />
        <MetricTile label="Approval rate" value={formatRate(apps.approval_rate.value)} definition={apps.approval_rate.definition} />
        <MetricTile label="Rejection rate" value={formatRate(apps.rejection_rate.value)} definition={apps.rejection_rate.definition} />
      </MetricGroup>

      <MetricGroup title="Processing times" scope="In the period">
        <MetricTile label="Submission to decision" value={hoursValue(times.submitted_to_decided.value)} definition={hoursDefinition(times.submitted_to_decided.definition, times.submitted_to_decided.value)} />
        <MetricTile label="Approval to disbursement" value={hoursValue(times.approved_to_disbursed.value)} definition={hoursDefinition(times.approved_to_disbursed.definition, times.approved_to_disbursed.value)} />
        <MetricTile label="Submission to disbursement" value={hoursValue(times.submitted_to_disbursed.value)} definition={hoursDefinition(times.submitted_to_disbursed.definition, times.submitted_to_disbursed.value)} />
      </MetricGroup>

      <section aria-labelledby="by-category-heading" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h3 id="by-category-heading" className="font-display text-lg font-bold tracking-tight text-neutral-900">
            By PRIME category
          </h3>
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">In the period</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartCard
            title="Applications received"
            subtitle={apps.by_prime_category.definition}
            emptyMessage="No applications in the period."
            spec={{
              kind: "bar", unit: "count", seriesLabel: "Applications",
              ariaLabel: `Applications received by PRIME category: ${appCats.map((c) => `${c.category} ${c.count}`).join(", ") || "none"}`,
              labels: appCats.map((c) => c.category), values: appCats.map((c) => c.count),
            }}
            table={{ headers: ["Category", "Applications"], rows: appCats.map((c) => [c.category, String(c.count)]) }}
          />
          <ChartCard
            title="Principal disbursed"
            subtitle={disb.by_prime_category.definition}
            emptyMessage="No loans disbursed in the period."
            spec={{
              kind: "bar", unit: "kina", seriesLabel: "Principal",
              ariaLabel: `Principal disbursed by PRIME category: ${disbCats.map((c) => `${c.category} ${formatKina(c.amount)}`).join(", ") || "none"}`,
              labels: disbCats.map((c) => c.category), values: disbCats.map((c) => c.amount),
            }}
            table={{ headers: ["Category", "Principal"], rows: disbCats.map((c) => [c.category, `${formatKina(c.amount)} (${c.count})`]) }}
          />
        </div>
      </section>

      <section aria-labelledby="trend-heading" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h3 id="trend-heading" className="font-display text-lg font-bold tracking-tight text-neutral-900">
            Weekly trend
          </h3>
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {TREND_WEEKS} weeks to {formatPlainDate(a.window.to)} · each point is the week starting that day
          </span>
        </div>
        {trendOk ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard
              title="Applications received per week"
              subtitle="Applications submitted in each 7-day week."
              emptyMessage="No applications in these weeks."
              spec={{
                kind: "line", unit: "count", seriesLabel: "Applications",
                ariaLabel: `Applications received per week: ${weeks.map((w, i) => `${w.label} ${trend[i].applications.received.value}`).join(", ")}`,
                labels: weeks.map((w) => w.axisLabel), tooltipTitles: weeks.map((w) => `Week of ${w.label}`), values: trend.map((t) => t.applications.received.value),
              }}
              table={{ headers: ["Week", "Applications"], rows: weeks.map((w, i) => [w.label, String(trend[i].applications.received.value)]) }}
            />
            <ChartCard
              title="Principal disbursed per week"
              subtitle="Principal paid out on loans disbursed in each 7-day week."
              emptyMessage="No loans disbursed in these weeks."
              spec={{
                kind: "line", unit: "kina", seriesLabel: "Principal",
                ariaLabel: `Principal disbursed per week: ${weeks.map((w, i) => `${w.label} ${formatKina(trend[i].disbursements.principal_disbursed.value)}`).join(", ")}`,
                labels: weeks.map((w) => w.axisLabel), tooltipTitles: weeks.map((w) => `Week of ${w.label}`), values: trend.map((t) => t.disbursements.principal_disbursed.value),
              }}
              table={{ headers: ["Week", "Principal"], rows: weeks.map((w, i) => [w.label, formatKina(trend[i].disbursements.principal_disbursed.value)]) }}
            />
          </div>
        ) : (
          <Card>
            <p className="text-sm text-neutral-600">The weekly trend couldn&apos;t be loaded. Refresh to try again.</p>
          </Card>
        )}
      </section>
    </div>
  );
}
