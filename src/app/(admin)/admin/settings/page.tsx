import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PolicyEditor } from "@/components/admin/settings/PolicyEditor";
import { ParametersEditor } from "@/components/admin/settings/ParametersEditor";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { formatReviewDateTime } from "@/lib/application-review";
import { CHANGE_WARNING, PARAMETER_SPECS, formatPct, parameterDisplay, penaltyRowsFrom, pricingRowsFrom } from "@/lib/admin-settings";
import { formatKina } from "@/lib/utils";
import type { PenaltyTier, PolicyVersion, PolicyVersions, PricingTier, SystemParameters } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function VersionMeta({ v }: { v: PolicyVersion<unknown> }) {
  return (
    <p className="text-helper text-neutral-600">
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
    <details className="border-t border-neutral-100 px-5 py-3">
      <summary className="cursor-pointer text-sm font-medium text-neutral-700">Earlier versions ({past.length})</summary>
      <ul className="mt-2 flex flex-col gap-3">
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

const th = "px-5 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500";
const td = "px-5 py-2.5";

// One versioned table: the current version's rows, then its history.
function PolicyTable({ head, children }: { head: [string, string, string]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50">
          <tr className="border-y border-neutral-200">
            <th className={th}>{head[0]}</th>
            <th className={th}>{head[1]}</th>
            <th className={`${th} text-right`}>{head[2]}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">{children}</tbody>
      </table>
    </div>
  );
}

// Parameter management: the deliberately limited set an administrator can
// change - the versioned PRIME pricing table and late-penalty tiers (GET/POST
// /admin/pricing, /admin/penalty-policy; a save creates a new version for
// applications submitted from then on), and the backend's three live
// settings (GET/PUT /admin/parameters). Every change applies going forward
// only; nothing already quoted, disbursed, produced or verified changes -
// the page says so first, in full, before any setting.
export default async function AdminSettingsPage({ searchParams }: PageProps) {
  const saved = (await searchParams).saved;

  let pricing: PolicyVersions<PricingTier>;
  let penalty: PolicyVersions<PenaltyTier>;
  let params: SystemParameters;
  try {
    [pricing, penalty, params] = await Promise.all([
      serverApiFetch<PolicyVersions<PricingTier>>("/admin/pricing"),
      serverApiFetch<PolicyVersions<PenaltyTier>>("/admin/penalty-policy"),
      serverApiFetch<SystemParameters>("/admin/parameters"),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  const savedLabel = saved === "pricing" ? pricing.current.label : saved === "penalty" ? penalty.current.label : null;
  const paramSpecs = PARAMETER_SPECS.filter((s) => params.parameters[s.key]);

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Settings"
          description="PRIME loan pricing, late-payment penalties, and the settings behind credit notes and customer verification."
        />

        {/* Plain, always-visible text - never a tooltip or a collapsed
            section - so it reads the same by mouse, keyboard, touch and
            screen reader. */}
        <Alert tone="warning" title="Changes affect new applications only - never existing loans">
          {CHANGE_WARNING}
        </Alert>

        {saved === "parameters" && <Alert tone="success" title="Settings saved. They apply from now on." />}
        {savedLabel && (
          <Alert tone="success" title={`Saved as ${savedLabel}. It applies to applications submitted from now on.`} />
        )}
      </div>

      <section aria-labelledby="pricing-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="pricing-heading"
          title="PRIME pricing"
          description="The loan amount picks the category; its flat interest rate is charged once over the 14-day term."
          actions={<Badge variant="primary">Current: {pricing.current.label}</Badge>}
        />
        <Card className="p-0">
          <div className="px-5 py-3">
            <VersionMeta v={pricing.current} />
          </div>
          <PolicyTable head={["Category", "Loan amount", "Interest (flat)"]}>
            {pricing.current.tiers.map((t) => (
              <tr key={t.category}>
                <td className={`${td} font-medium text-neutral-900`}>{t.category}</td>
                <td className={`${td} tabular-nums text-neutral-700`}>
                  {formatKina(t.min_amount)} – {formatKina(t.max_amount)}
                </td>
                <td className={`${td} text-right font-semibold tabular-nums text-neutral-900`}>{formatPct(t.interest_rate)}</td>
              </tr>
            ))}
          </PolicyTable>
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

      <section aria-labelledby="penalty-heading" className="flex flex-col gap-3">
        <SectionHeader
          id="penalty-heading"
          title="Late penalties"
          description="Each tier is added once, when a loan becomes that many days late, as a percentage of the loan's original interest - never of its balance."
          actions={<Badge variant="primary">Current: {penalty.current.label}</Badge>}
        />
        <Card className="p-0">
          <div className="px-5 py-3">
            <VersionMeta v={penalty.current} />
          </div>
          <PolicyTable head={["Tier", "When", "Penalty"]}>
            {penalty.current.tiers.map((t) => (
              <tr key={t.tier}>
                <td className={`${td} font-medium text-neutral-900`}>{t.tier}</td>
                <td className={`${td} text-neutral-700`}>{t.days_late} days late</td>
                <td className={`${td} text-right tabular-nums text-neutral-900`}>
                  {formatPct(t.pct_of_original_interest)} of the original interest
                </td>
              </tr>
            ))}
          </PolicyTable>
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

      {paramSpecs.length > 0 && (
        <section aria-labelledby="params-heading" className="flex flex-col gap-3">
          <SectionHeader
            id="params-heading"
            title={"Credit notes & verification"}
            description="Each applies from the moment it's saved. Credit notes already produced and verifications already given keep what they were made with, and none of these changes a loan."
          />
          <Card className="py-0">
            <dl className="flex flex-col divide-y divide-neutral-100">
              {paramSpecs.map((s) => {
                const p = params.parameters[s.key]!;
                return (
                  <div key={s.key} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                    <div className="min-w-0">
                      <dt className="font-medium text-neutral-900">{s.label}</dt>
                      <p className="mt-0.5 text-sm text-neutral-600">{s.summary}</p>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-helper font-medium text-neutral-700">How it&apos;s used</summary>
                        <p className="mt-1 text-helper text-neutral-600">{s.details}</p>
                      </details>
                    </div>
                    <dd className="shrink-0 text-left sm:text-right">
                      <p className="font-display text-2xl font-bold tabular-nums text-neutral-900">{parameterDisplay(s, p.value)}</p>
                      <p className="text-helper text-neutral-600">
                        {p.source === "default" ? "Default" : `Changed ${formatReviewDateTime(p.updated_at) ?? ""}`.trim()}
                        {s.key === "customer_verification_validity_months" && p.source === "default"
                          ? " · still to be confirmed by PRIMESTONE"
                          : ""}
                      </p>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>
          <ParametersEditor initial={Object.fromEntries(paramSpecs.map((s) => [s.key, params.parameters[s.key]!.value]))} />
        </section>
      )}

      <p className="text-helper text-neutral-600">From the system: {pricing.applies_to}</p>
    </div>
  );
}
