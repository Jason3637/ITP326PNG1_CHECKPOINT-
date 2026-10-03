import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DetailList, DetailRow } from "./DetailList";
import { RequestReverification } from "./RequestReverification";
import { ageFromDob, formatDob, formatReviewDate } from "@/lib/application-review";
import type { ReviewCustomer } from "@/lib/types";

// Residence and employer are given by the customer on each application
// (application.residential_address / employer_name). Applications made
// before the apply form asked for them have neither - shown as such, so it
// doesn't look like an empty record (the officer can request them).
const NOT_ON_APPLICATION = "Not provided on this application";

export interface ApplicantDetails {
  residentialAddress: string | null;
  employerName: string | null;
  employmentStatus: string | null;
}

export function CustomerPanel({
  customer,
  applicant,
  applicationId,
  canRequestReverification = false,
}: {
  customer: ReviewCustomer;
  applicant: ApplicantDetails;
  applicationId?: number;
  canRequestReverification?: boolean;
}) {
  // "Verified customer" comes only from the current verification record.
  const v = customer.verification;
  // Date of birth is on the customer record (recorded from the ID at the
  // Age 18+ check), so it shows whether or not a verification is current.
  const dob = customer.date_of_birth ?? v?.date_of_birth ?? null;
  const age = ageFromDob(dob);

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
          value={dob ? `${formatDob(dob)}${age !== null ? ` (age ${age})` : ""}` : null}
          fallback="Recorded at the Age 18+ check"
        />
        <DetailRow label="Mobile" value={customer.phone_number} />
        <DetailRow label="Email" value={customer.email} />
        <DetailRow label="Residence" value={applicant.residentialAddress} fallback={NOT_ON_APPLICATION} />
        <DetailRow
          label={applicant.employmentStatus === "self_employed" ? "Business" : "Employer"}
          value={applicant.employerName}
          fallback={
            applicant.employmentStatus && !["employed", "self_employed"].includes(applicant.employmentStatus)
              ? `None (${applicant.employmentStatus.replace("_", " ")})`
              : NOT_ON_APPLICATION
          }
        />
        <DetailRow label="Member since" value={formatReviewDate(customer.member_since)} />
        <DetailRow
          label="Account"
          value={customer.is_active ? "Active" : <span className="text-red-700">Disabled</span>}
        />
        <DetailRow
          label="Verification"
          value={
            v
              ? [
                  `Verified ${formatReviewDate(v.verified_at) ?? ""}`.trim(),
                  v.verified_by_name ? `by ${v.verified_by_name}` : null,
                ]
                  .filter(Boolean)
                  .join(" ")
              : null
          }
          fallback="No current verification"
          hint={v ? `Valid until ${formatDob(v.valid_until)}` : undefined}
        />
      </DetailList>
      {v && canRequestReverification && applicationId !== undefined && (
        <RequestReverification applicationId={applicationId} />
      )}
    </Card>
  );
}
