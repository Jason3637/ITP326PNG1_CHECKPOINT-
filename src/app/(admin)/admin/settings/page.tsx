import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PolicyEditor } from "@/components/admin/settings/PolicyEditor";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { formatReviewDateTime } from "@/lib/application-review";
import { CHANGE_WARNING, formatPct, penaltyRowsFrom, pricingRowsFrom } from "@/lib/admin-settings";
import { formatKina } from "@/lib/utils";
import type { PenaltyTier, PolicyVersion, PolicyVersions, PricingTier } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function VersionMeta({ v }: { v: PolicyVersion<unknown> }) {
  return (
    <p className="text-xs text-neutral-600">
      {v.label}
      {v.created_at ? ` · saved ${formatReviewDateTime(v.created_at)}` : ""}
      {v.note ? ` · “${v.note}”` : ""}
    </p>
  );
}

function History<T>({ versions, render }: { versions: PolicyVersion<T>[]; render: (v: PolicyVersion<T>) => string }) {
  const past = versions.filter((v) => !v.is_current);
  if (past.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-medium text-neutral-700">Earlier versions ({past.length})</summary>
      <ul className="mt-2 flex flex-col gap-2">
        {past.map((v) => (
          <li key={v.id} className="text-sm">
            <VersionMeta v={v} />
            <p className="text-neutral-700">{render(v)}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

// Parameter management: only the deliberately limited, versioned settings -
// the PRIME pricing table and the late-penalty tiers (GET/POST
// /admin/pricing, /admin/penalty-policy). Not a dump of every backend
// setting. A save never edits the current version: it creates a new one,
// for applications submitted from then on.
export default async function AdminSettingsPage({ searchParams }: PageProps) {
  const saved = (await searchParams).saved;

  let pricing: PolicyVersions<PricingTier>;
  let penalty: PolicyVersions<PenaltyTier>;
  try {
    [pricing, penalty] = await Promise.all([
      serverApiFetch<PolicyVersions<PricingTier>>("/admin/pricing"),
      serverApiFetch<PolicyVersions<PenaltyTier>>("/admin/penalty-policy"),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  const savedLabel = saved === "pricing" ? pricing.current.label : saved === "penalty" ? penalty.current.label : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-neutral-900">Pricing &amp; penalties</h2>
        <p className="mt-1 text-sm text-neutral-600">The PRIME loan pricing table and the late-payment penalty tiers.</p>
      </div>

      <div role="note" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-light p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden="true" />
        <div>
          <p className="font-semibold text-neutral-900">Changes affect new applications only - never existing loans</p>
          <p className="mt-0.5 text-neutral-800">{CHANGE_WARNING}</p>
        </div>
      </div>

      {savedLabel && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-light p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <p className="font-medium text-neutral-900">
            Saved as {savedLabel}. It applies to applications submitted from now on.
          </p>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>PRIME pricing</CardTitle>
            <Badge variant="primary">Current: {pricing.current.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            The loan amount picks the category; its flat rate is charged once over the 14-day term.
          </p>
          <VersionMeta v={pricing.current} />
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-600">
                <th className="py-1 font-medium">Category</th>
                <th className="py-1 font-medium">Loan amount</th>
                <th className="py-1 text-right font-medium">Interest (flat)</th>
              </tr>
            </thead>
            <tbody>
              {pricing.current.tiers.map((t) => (
                <tr key={t.category} className="border-b border-neutral-100">
                  <td className="py-1.5 text-neutral-900">{t.category}</td>
                  <td className="py-1.5 tabular-nums text-neutral-700">
                    {formatKina(t.min_amount)} – {formatKina(t.max_amount)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-neutral-900">{formatPct(t.interest_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <History
            versions={pricing.history}
            render={(v) => v.tiers.map((t) => `${t.category} ${formatKina(t.min_amount)}–${formatKina(t.max_amount)} at ${formatPct(t.interest_rate)}`).join(" · ")}
          />
        </Card>
        <PolicyEditor
          key={pricing.current.id}
          kind="pricing"
          title="New PRIME pricing"
          description="Ranges must follow on with no gaps or overlaps, in whole Kina. Rates are flat for the whole term."
          currentLabel={pricing.current.label}
          initialRows={pricingRowsFrom(pricing.current.tiers)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Late penalties</CardTitle>
            <Badge variant="primary">Current: {penalty.current.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            Each tier is added once, when a loan becomes that many days late, as a percentage of the loan&apos;s original
            interest - never of its balance.
          </p>
          <VersionMeta v={penalty.current} />
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-600">
                <th className="py-1 font-medium">Tier</th>
                <th className="py-1 font-medium">When</th>
                <th className="py-1 text-right font-medium">Penalty</th>
              </tr>
            </thead>
            <tbody>
              {penalty.current.tiers.map((t) => (
                <tr key={t.tier} className="border-b border-neutral-100">
                  <td className="py-1.5 text-neutral-900">{t.tier}</td>
                  <td className="py-1.5 text-neutral-700">{t.days_late} days late</td>
                  <td className="py-1.5 text-right tabular-nums text-neutral-900">
                    {formatPct(t.pct_of_original_interest)} of the original interest
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <History
            versions={penalty.history}
            render={(v) => v.tiers.map((t) => `${t.days_late} days: ${formatPct(t.pct_of_original_interest)}`).join(" · ")}
          />
        </Card>
        <PolicyEditor
          key={penalty.current.id}
          kind="penalty"
          title="New late-penalty tiers"
          description="Each tier needs a different number of days late. The percentage is of the loan's original interest."
          currentLabel={penalty.current.label}
          initialRows={penaltyRowsFrom(penalty.current.tiers)}
        />
      </section>

      <p className="text-xs text-neutral-600">From the system: {pricing.applies_to}</p>
    </div>
  );
}
