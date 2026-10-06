import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RepaymentListItem } from "@/components/admin/repayments/RepaymentListItem";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { adminRepaymentsHref, pageCount, type RepaymentFilter } from "@/lib/admin-queues";
import { parsePage } from "@/lib/officer-queues";
import { cn, focusRing } from "@/lib/utils";
import type { AdminRepaymentPage } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

const FILTERS: { value: RepaymentFilter; label: string; empty: string }[] = [
  { value: "awaiting", label: "Awaiting verification", empty: "No repayments are waiting to be verified." },
  { value: "verified", label: "Verified", empty: "No verified repayments yet." },
  { value: "rejected", label: "Rejected", empty: "No rejected repayments." },
  { value: "all", label: "All", empty: "No repayments reported yet." },
];

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const linkClass = cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing);
// Previous / Next: standalone targets, so at least 24px tall.
const pagerLinkClass = cn(linkClass, "inline-flex min-h-6 items-center px-1");

// The Repayment Verification queue: GET /admin/repayments, oldest report
// first while awaiting (the backend's order). Each payment opens its
// verification workspace.
export default async function AdminRepaymentsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.value === sp.status) ?? FILTERS[0];
  const requestedPage = parsePage(sp.page);

  let data: AdminRepaymentPage;
  try {
    data = await serverApiFetch<AdminRepaymentPage>(
      `/admin/repayments?status=${filter.value}&page=${requestedPage}&per_page=${PER_PAGE}`,
    );
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  const pages = pageCount(data.total, data.per_page);
  const first = data.total === 0 ? 0 : (data.page - 1) * data.per_page + 1;
  const last = Math.min(data.page * data.per_page, data.total);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin" className={cn("inline-flex w-fit items-center gap-1 py-1", linkClass)}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to dashboard
      </Link>

      <Card className="px-2 sm:px-5">
        <div className="px-3 sm:px-0">
          <div className="flex items-center gap-2">
            <CardTitle>Repayment verification</CardTitle>
            <Badge variant={data.total > 0 ? "primary" : "neutral"}>{data.total}</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            Payments customers have reported. A payment reduces a balance only once it&apos;s verified.
          </p>
          <nav aria-label="Filter by status" className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = f.value === filter.value;
              return (
                <Link
                  key={f.value}
                  href={adminRepaymentsHref(f.value)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium",
                    focusRing,
                    active
                      ? "border-primary bg-primary-light text-primary-dark"
                      : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                  )}
                >
                  {f.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {data.items.length === 0 ? (
          <EmptyState
            action={
              data.total > 0 && (
                <Link href={adminRepaymentsHref(filter.value)} className={linkClass}>
                  Go to the first page
                </Link>
              )
            }
          >
            {data.total > 0 ? "Nothing on this page." : filter.empty}
          </EmptyState>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
            {data.items.map((item) => (
              <RepaymentListItem key={item.payment_id} item={item} />
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav
            aria-label="Pagination"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-3 pt-4 sm:px-0"
          >
            <p className="text-sm text-neutral-600">
              {first}–{last} of {data.total}
            </p>
            <div className="flex items-center gap-4">
              {data.page > 1 && (
                <Link href={adminRepaymentsHref(filter.value, data.page - 1)} className={pagerLinkClass}>
                  Previous
                </Link>
              )}
              <span className="text-sm text-neutral-600">
                Page {data.page} of {pages}
              </span>
              {data.page < pages && (
                <Link href={adminRepaymentsHref(filter.value, data.page + 1)} className={pagerLinkClass}>
                  Next
                </Link>
              )}
            </div>
          </nav>
        )}
      </Card>
    </div>
  );
}
