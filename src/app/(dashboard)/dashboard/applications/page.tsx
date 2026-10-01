import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Inbox } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn, focusRing, formatKina } from "@/lib/utils";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { isTerminalRejected, isActionRequired } from "@/lib/loan-wizard";
import type { LoanApplicationList } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Live, via GET /loans/applications/mine (added alongside the two-tier
// officer/admin review chain) - lists every application this customer has
// ever submitted, newest first, each with the backend's own customer-facing
// status_label (never the raw internal status enum).
export default async function ApplicationsPage() {
  let data: LoanApplicationList;
  try {
    data = await serverApiFetch<LoanApplicationList>("/loans/applications/mine");
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  return (
    <Card>
      <CardTitle>My applications</CardTitle>

      {data.applications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Inbox className="h-8 w-8 text-neutral-300" aria-hidden="true" />
          <p className="text-sm text-neutral-600">You haven&apos;t applied for a loan yet.</p>
          <Link
            href="/dashboard/loans/apply"
            className={cn(
              "mt-2 inline-flex h-10 items-center justify-center rounded-lg bg-primary-dark px-5 text-sm font-medium text-white transition-colors hover:opacity-90",
              focusRing,
            )}
          >
            Apply for a Loan
          </Link>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-neutral-100">
          {data.applications.map((application) => {
            const rejected = isTerminalRejected(application.status);
            const actionRequired = isActionRequired(application.status);
            return (
              <li key={application.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-dark">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-900">Application #{application.id}</p>
                    <Badge variant={rejected ? "danger" : actionRequired ? "warning" : "primary"}>
                      {application.status_label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">
                    {formatKina(application.amount_requested)} requested
                    {application.prime_category ? ` — ${application.prime_category}` : ""}
                  </p>
                  <p className="text-xs text-neutral-600">Submitted {formatDate(application.submitted_at)}</p>

                  {actionRequired && application.action_required_note && (
                    <p className="mt-2 text-xs text-amber-800">{application.action_required_note}</p>
                  )}

                  {actionRequired && (
                    <Link
                      href={`/dashboard/applications/${application.id}/respond`}
                      className={cn(
                        "mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-primary-dark px-4 text-xs font-medium text-white transition-colors hover:opacity-90",
                        focusRing,
                      )}
                    >
                      Respond now
                    </Link>
                  )}

                  {rejected && (
                    <Link
                      href="/dashboard/loans/apply"
                      className={cn(
                        "mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-primary-dark px-4 text-xs font-medium text-white transition-colors hover:opacity-90",
                        focusRing,
                      )}
                    >
                      Apply again
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
