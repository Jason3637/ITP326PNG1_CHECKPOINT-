import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DetailList, DetailRow } from "./DetailList";
import { ageFromDob, formatDob, formatReviewDate } from "@/lib/application-review";
import type { ReviewCustomer } from "@/lib/types";

// The backend has no field for a customer's residence or employer - not
// on the user, the verification record, or the application (which only
// has employment *status*; employer names exist only on referees). Shown
// as explicitly "not collected" rather than left out, so the gap is
// visible to the officer instead of looking like an empty record.
const NOT_COLLECTED = "Not collected by the system";

export function CustomerPanel({ customer }: { customer: ReviewCustomer }) {
  const v = customer.verification;
  const age = ageFromDob(v?.date_of_birth ?? null);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Customer</CardTitle>
        {v ? <Badge variant="success">Verified customer</Badge> : <Badge variant="warning">Not yet verified</Badge>}
      </div>

      <DetailList className="mt-3">
        <DetailRow label="Customer ID" value={`#${customer.id}`} />
        <DetailRow label="Name" value={customer.full_name} />
        <DetailRow
          label="Date of birth"
          value={v ? `${formatDob(v.date_of_birth)}${age !== null ? ` (age ${age})` : ""}` : null}
          fallback="Recorded when the customer is verified"
        />
        <DetailRow label="Mobile" value={customer.phone_number} />
        <DetailRow label="Email" value={customer.email} />
        <DetailRow label="Residence" value={null} fallback={NOT_COLLECTED} />
        <DetailRow label="Employer" value={null} fallback={NOT_COLLECTED} />
        <DetailRow label="Member since" value={formatReviewDate(customer.member_since)} />
        <DetailRow
          label="Account"
          value={customer.is_active ? "Active" : <span className="text-red-700">Disabled</span>}
        />
        <DetailRow
          label="Verification"
          value={v ? `Verified ${formatReviewDate(v.verified_at) ?? ""}`.trim() : null}
          fallback="No current verification"
          hint={v ? `Valid until ${formatDob(v.valid_until)}` : undefined}
        />
      </DetailList>
    </Card>
  );
}
