import { notFound, redirect } from "next/navigation";
import { RespondForm } from "@/components/dashboard/respond/RespondForm";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import type { LoanApplicationList } from "@/lib/types";

// See (dashboard)/layout.tsx.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ applicationId: string }>;
}

export default async function RespondPage({ params }: PageProps) {
  const { applicationId } = await params;

  let applications: LoanApplicationList;
  try {
    applications = await serverApiFetch<LoanApplicationList>("/loans/applications/mine");
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  // GET /loans/applications/mine only ever returns the caller's own
  // applications, so finding it in this list is itself the ownership check
  // - same pattern as the report-repayment page's loan lookup.
  const application = applications.applications.find((a) => String(a.id) === applicationId);
  if (!application) notFound();
  if (application.status !== "customer_action_required") {
    redirect("/dashboard/applications");
  }

  return <RespondForm application={application} />;
}
