import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminQueueItems } from "@/components/admin/AdminQueueItems";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { adminQueueDefinition, adminQueueHref, isAdminQueue, pageCount } from "@/lib/admin-queues";
import { parsePage } from "@/lib/officer-queues";
import { cn, focusRing } from "@/lib/utils";
import type { AdminQueuePage } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

interface PageProps {
  params: Promise<{ queue: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const linkClass = cn("rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing);
// Previous / Next: standalone targets, so at least 24px tall.
const pagerLinkClass = cn(linkClass, "inline-flex min-h-6 items-center px-1");

// One full admin queue, in the backend's order, 25 per page. The page
// number lives in the URL so a view can be refreshed or shared.
export default async function AdminQueuePageView({ params, searchParams }: PageProps) {
  const { queue } = await params;
  if (!isAdminQueue(queue)) notFound();
  // Repayments have their own verification queue screen.
  if (queue === "repayments_awaiting_verification") redirect(adminQueueHref(queue));

  const requestedPage = parsePage((await searchParams).page);
  const definition = adminQueueDefinition(queue);

  let data: AdminQueuePage;
  try {
    data = await serverApiFetch<AdminQueuePage>(`/admin/queues/${queue}?page=${requestedPage}&per_page=${PER_PAGE}`);
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
            <CardTitle>{definition.title}</CardTitle>
            <Badge variant={data.total > 0 ? "primary" : "neutral"}>{data.total}</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-600">{definition.description}</p>
        </div>

        {data.items.length === 0 ? (
          <EmptyState
            action={
              data.total > 0 && (
                <Link href={adminQueueHref(queue)} className={linkClass}>
                  Go to the first page
                </Link>
              )
            }
          >
            {data.total > 0 ? "Nothing on this page." : definition.emptyMessage}
          </EmptyState>
        ) : (
          <AdminQueueItems page={data} />
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
                <Link href={adminQueueHref(queue, data.page - 1)} className={pagerLinkClass}>
                  Previous
                </Link>
              )}
              <span className="text-sm text-neutral-600">
                Page {data.page} of {pages}
              </span>
              {data.page < pages && (
                <Link href={adminQueueHref(queue, data.page + 1)} className={pagerLinkClass}>
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
