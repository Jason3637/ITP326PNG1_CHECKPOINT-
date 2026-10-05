import { redirect } from "next/navigation";
import { LoanApplyWizard } from "@/components/dashboard/loan-apply/LoanApplyWizard";
import { ApplyBlockedNotice } from "@/components/dashboard/ApplyBlockedNotice";
import { applyBlock } from "@/lib/apply-eligibility";
import { serverApiFetch, UnauthenticatedError } from "@/lib/server-api";
import { getLastApplicationDraft } from "@/lib/session";
import type { Document, DocumentList, LoanApplicationList, MyLoans, Profile } from "@/lib/types";

// See (dashboard)/layout.tsx — same reason, applied again since this page
// calls serverApiFetch independently.
export const dynamic = "force-dynamic";

// GET /users/documents is genuinely customer-scoped (verified live —
// unlike GET /loans/applications, which looks the same in swagger but is
// actually loan_officer/admin-only). Used here to offer "still current?"
// instead of forcing a re-upload of a document the customer already has on
// file. There's no expiry/validity field on Document at all, so "still
// current" is never decided automatically — only ever confirmed by the
// customer (see the wizard's returning-customer step).
async function latestDocument(documentType: "id_verification" | "loan_file"): Promise<Document | undefined> {
  const list = await serverApiFetch<DocumentList>(`/users/documents?document_type=${documentType}`);
  return list.documents.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0];
}

export default async function LoanApplyPage() {
  // Someone who can't apply right now (one PRIME loan at a time) is told
  // why here, instead of filling in the whole form to be refused at the end.
  let applications: LoanApplicationList;
  let loans: MyLoans;
  try {
    [applications, loans] = await Promise.all([
      serverApiFetch<LoanApplicationList>("/loans/applications/mine"),
      serverApiFetch<MyLoans>("/loans/mine"),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }
  const block = applyBlock(applications.applications, loans.loans);
  if (block) return <ApplyBlockedNotice block={block} />;

  let profile: Profile;
  let existingIdDocument: Document | undefined;
  let existingIncomeDocument: Document | undefined;
  try {
    [profile, existingIdDocument, existingIncomeDocument] = await Promise.all([
      serverApiFetch<Profile>("/users/profile"),
      latestDocument("id_verification"),
      latestDocument("loan_file"),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect("/login");
    throw err;
  }

  const draft = await getLastApplicationDraft();

  return (
    <LoanApplyWizard
      profile={profile}
      draft={draft}
      existingIdDocument={existingIdDocument}
      existingIncomeDocument={existingIncomeDocument}
    />
  );
}
