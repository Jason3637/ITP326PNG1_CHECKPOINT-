import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { CustomerHistoryView } from "@/components/staff/history/CustomerHistoryView";
import { serverApiFetch, ApiError, UnauthenticatedError } from "@/lib/server-api";
import { formatReviewDate } from "@/lib/application-review";
import { cn, focusRing } from "@/lib/utils";
import type { CustomerHistory } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ applicationId: string }>;
}

// Customer History - reached ONLY through an application: the URL is the
// application's, and so is the API call
// (GET /officer/applications/<id>/customer-history). There is no customer-id
// route or search anywhere, so this can't be used as a general customer
// lookup. The backend enforces the rest: loan officers get 403 once the
// application is no longer under review (admins always see it), and a
// customer's other applications/loans are listed here but not linked.
export default async function CustomerHistoryPage({ params }: PageProps) {
  const { applicationId } = await params;
  if (!/^\d+$/.test(applicationId)) notFound();

  const back = (
    <Link
      href={`/staff/applications/${applicationId}`}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded text-sm font-medium text-primary hover:text-primary-dark",
        focusRing,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to application #{applicationId}
    </Link>
  );

  let history: CustomerHistory;
  try {
    history = await serverApiFetch<CustomerHistory>(`/officer/applications/${applicationId}/customer-history`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    if (err instanceof ApiError && err.status === 404) notFound();
    if (err instanceof ApiError && err.status === 403) {
      return (
        <div className="flex flex-col gap-4">
          {back}
          <Card>
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" aria-hidden="true" />
              <div>
                <CardTitle>Customer history isn&apos;t available</CardTitle>
                <p className="mt-1 text-sm text-neutral-600">
                  Loan officers can see a customer&apos;s history only while the application they reached it from is
                  still under review. Application #{applicationId} has been decided.
                </p>
              </div>
            </div>
          </Card>
        </div>
      );
    }
    throw err;
  }

  return (
    <div className="flex flex-col gap-4">
      {back}
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          Customer history · {history.customer.full_name}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Shown for reviewing application #{history.application_id}
          {history.customer.member_since ? ` · member since ${formatReviewDate(history.customer.member_since)}` : ""}.
          Excludes this application.
        </p>
      </div>
      <CustomerHistoryView history={history} />
    </div>
  );
}
