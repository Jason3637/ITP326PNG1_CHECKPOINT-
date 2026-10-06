import { Info } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CREDIT_CRITERIA, employmentLabel, formatReviewDateTime } from "@/lib/application-review";
import { formatKina } from "@/lib/utils";
import type { CreditAdvisory, ReviewApplication } from "@/lib/types";

interface CreditAdvisoryPanelProps {
  advisory: CreditAdvisory | null;
  label: string; // the backend's own wording, e.g. "Advisory - not a decision input"
  application: Pick<ReviewApplication, "amount_requested" | "monthly_income" | "employment_status" | "existing_monthly_debt">;
}

// One disclaimer, shown once. It's the backend's current wording
// (credit_evaluation.DISCLAIMER), kept here rather than read from the
// result: each result stores the disclaimer from when it was produced, so
// older applications still carry superseded developer wording. The
// model/version name (e.g. "interim-v2") isn't shown - it's internal and
// tells an officer nothing.
const ADVISORY_DISCLAIMER =
  "Advisory assessment only. It does not replace the judgment of the Loan Officer or Administrator. " +
  "The assessment criteria are provisional until PRIMESTONE's lending policy is finalised.";

// The credit model's notes, presented as background reading for the
// officer - never as a verdict. What's shown: what was checked, what each
// check looked at, and the notes it produced. What's deliberately NOT
// shown (stripped in toCreditAdvisory before it gets here): the numeric
// score, the eligible flag, the "review"/"decline" recommendation and the
// "max eligible amount" - any of which would read as the system telling
// the officer what to decide.
export function CreditAdvisoryPanel({ advisory, label, application }: CreditAdvisoryPanelProps) {
  return (
    <Card className="border-dashed">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Credit notes</CardTitle>
        <Badge variant="neutral">{label}</Badge>
      </div>

      <div className="mt-3 flex gap-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
        <p>
          {ADVISORY_DISCLAIMER} Income and employment are as reported by the customer and are not verified.
        </p>
      </div>

      {!advisory ? (
        <p className="mt-4 text-sm text-neutral-600">No credit notes were produced for this application.</p>
      ) : (
        <>
          {advisory.insufficient_data && (
            <p className="mt-4 text-sm text-amber-800">
              The customer didn&apos;t report enough information (such as monthly income) for the affordability
              checks to run.
            </p>
          )}

          <h3 className="mt-4 text-sm font-semibold text-neutral-900">Notes</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {advisory.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-neutral-900">What was checked</h3>
          <ul className="mt-1 flex flex-col divide-y divide-neutral-100">
            {advisory.criteria_checked.map((key) => {
              const c = CREDIT_CRITERIA[key];
              return (
                <li key={key} className="py-2 text-sm">
                  <p className="font-medium text-neutral-900">{c?.label ?? "Other check"}</p>
                  <p className="text-xs text-neutral-600">{c?.input ?? "Details not described by the system."}</p>
                </li>
              );
            })}
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-neutral-900">Inputs from this application</h3>
          <p className="mt-1 text-xs text-neutral-600">
            Requested {formatKina(application.amount_requested)} · Income{" "}
            {application.monthly_income !== null ? formatKina(application.monthly_income) : "not reported"} · Existing
            debt{" "}
            {application.existing_monthly_debt !== null ? formatKina(application.existing_monthly_debt) : "not reported"}
            {" · "}Employment {employmentLabel(application.employment_status) ?? "not reported"}
          </p>

          <p className="mt-4 text-xs text-neutral-500">
            Produced {formatReviewDateTime(advisory.evaluated_at) ?? "at submission"}.
          </p>
        </>
      )}
    </Card>
  );
}
