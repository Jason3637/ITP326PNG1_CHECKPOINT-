import Link from "next/link";
import { FileText, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn, focusRing, formatKina } from "@/lib/utils";
import { isTerminalRejected, isActionRequired } from "@/lib/loan-wizard";
import type { LoanApplication } from "@/lib/types";

interface ApplicationStatusCardProps {
  application: LoanApplication;
}

// Live status, from GET /loans/applications/mine (added alongside the
// two-tier officer/admin review chain - previously there was no
// customer-facing way to check status after submission at all, so this
// card only ever showed a snapshot frozen at submission time). Never
// renders the raw backend `status` enum - only `status_label`, which the
// backend computes specifically so internal stages (OFFICER_REVIEW,
// RECOMMENDED_FOR_APPROVAL, ADMIN_REVIEW, ...) never leak to a customer.
export function ApplicationStatusCard({ application }: ApplicationStatusCardProps) {
  const rejected = isTerminalRejected(application.status);
  const actionRequired = isActionRequired(application.status);

  return (
    <Card className="animate-card-enter relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-brand-gradient" />

      <CardHeader>
        <CardTitle>Your application</CardTitle>
        <Badge variant={rejected ? "danger" : actionRequired ? "warning" : "primary"}>
          {application.status_label}
        </Badge>
      </CardHeader>

      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            actionRequired ? "bg-warning-light text-amber-800" : "bg-primary-light text-primary-dark",
          )}
        >
          {actionRequired ? (
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          ) : (
            <FileText className="h-6 w-6" aria-hidden="true" />
          )}
        </span>
        <div>
          <p className="font-display text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            {formatKina(application.amount_requested)}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {rejected
              ? "This application wasn't approved this time."
              : actionRequired
                ? (application.action_required_note ?? "We need a bit more information from you.")
                : "We're reviewing your application and will be in touch about next steps."}
          </p>
        </div>
      </div>

      <Link
        href={
          rejected
            ? "/dashboard/loans/apply"
            : actionRequired
              ? `/dashboard/applications/${application.id}/respond`
              : "/dashboard/applications"
        }
        className={cn(
          "mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary-dark px-5 text-sm font-medium text-white transition-colors hover:opacity-90",
          focusRing,
        )}
      >
        {rejected ? "Apply again" : actionRequired ? "Respond now" : "View details"}
      </Link>
    </Card>
  );
}
