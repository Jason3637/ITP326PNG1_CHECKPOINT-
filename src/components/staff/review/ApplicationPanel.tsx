import { Card, CardTitle } from "@/components/ui/Card";
import { DetailList, DetailRow } from "./DetailList";
import { disbursementLabel, employmentLabel, formatReviewDateTime } from "@/lib/application-review";
import { purposeLabel } from "@/lib/officer-queues";
import { formatKina } from "@/lib/utils";
import type { ReviewApplication, ReviewCustomer } from "@/lib/types";

function differs(a: string | null, b: string | null) {
  return !!a && !!b && a.trim().toLowerCase() !== b.trim().toLowerCase();
}

// Every money figure here is exactly what the backend returned in
// `pricing` - nothing is recalculated in the browser. The backend's
// pricing block has no interest *rate* field (prime_pricing computes one,
// but the API serializer drops it), so only the interest amount is shown;
// deriving a rate from amount/interest here would be exactly the client-
// side recalculation this screen must not do.
export function ApplicationPanel({
  application: a,
  customer,
}: {
  application: ReviewApplication;
  customer: ReviewCustomer;
}) {
  const purpose = purposeLabel(a.purpose_category);
  const pricing = a.pricing;

  const contactMismatch = [
    differs(a.confirmed_full_name, customer.full_name) && "name",
    differs(a.confirmed_email, customer.email) && "email",
    differs(a.confirmed_phone_number, customer.phone_number) && "mobile",
  ].filter(Boolean) as string[];

  return (
    <Card>
      <CardTitle>Application</CardTitle>

      <DetailList className="mt-3">
        <DetailRow label="Application ID" value={`#${a.id}`} />
        <DetailRow label="Submitted" value={formatReviewDateTime(a.submitted_at)} />
        <DetailRow label="Requested amount" value={formatKina(a.amount_requested)} />
        <DetailRow label="PRIME category" value={a.prime_category} />
        <DetailRow
          label="Purpose"
          value={purpose}
          hint={a.purpose ? <span className="whitespace-pre-line">&ldquo;{a.purpose}&rdquo;</span> : undefined}
        />
        <DetailRow
          label="Disbursement preference"
          value={disbursementLabel(a.disbursement_method_requested)}
          hint={a.disbursement_account_reference ? `Account: ${a.disbursement_account_reference}` : undefined}
        />
      </DetailList>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-500">Pricing (from the system)</h3>
      {pricing ? (
        <DetailList className="mt-1">
          <DetailRow label="Interest" value={formatKina(pricing.interest_amount)} />
          <DetailRow label="Total repayment" value={formatKina(pricing.total_repayable)} />
          <DetailRow label="Term" value={`${pricing.term_days} days`} />
        </DetailList>
      ) : (
        <p className="mt-2 text-sm text-neutral-600">
          The system didn&apos;t return pricing for this application. Figures aren&apos;t estimated here.
        </p>
      )}

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Self-reported by the customer
      </h3>
      <DetailList className="mt-1">
        <DetailRow label="Employment status" value={employmentLabel(a.employment_status)} />
        <DetailRow label="Monthly income" value={a.monthly_income !== null ? formatKina(a.monthly_income) : null} />
        <DetailRow
          label="Existing monthly debt"
          value={a.existing_monthly_debt !== null ? formatKina(a.existing_monthly_debt) : null}
        />
        <DetailRow
          label="Confirmed contact details"
          value={[a.confirmed_full_name, a.confirmed_email, a.confirmed_phone_number].filter(Boolean).join(" · ") || null}
          hint={
            contactMismatch.length > 0 ? (
              <span className="text-amber-800">Differs from the customer&apos;s profile: {contactMismatch.join(", ")}</span>
            ) : undefined
          }
        />
      </DetailList>
    </Card>
  );
}
