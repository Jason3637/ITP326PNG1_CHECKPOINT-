import { Receipt, HandCoins, ListChecks, Calculator } from "lucide-react";
import { ActionTiles, type ActionTile } from "./ActionTiles";

// "Check Eligibility" (Phase R3) was dropped - the real backend has no
// pre-application eligibility check, only a result computed as part of
// applying (see BorrowingPowerCard). "My Loans" replaces it with a real,
// previously-unused backend capability (GET /api/loans/mine) instead of a
// misleading link. "Loan Calculator" has no backend support yet - it's
// still a placeholder route, unlike the other three.
const actions: ActionTile[] = [
  { label: "Repayment History", href: "/dashboard/repayment-history", icon: Receipt },
  { label: "Apply for Loan", href: "/dashboard/loans/apply", icon: HandCoins, primary: true },
  { label: "My Loans", href: "/dashboard/loans", icon: ListChecks },
  { label: "Loan Calculator", href: "/dashboard/loans/calculator", icon: Calculator },
];

// Used for the active-loan dashboard state. "Apply for Loan" is left out
// while the customer can't apply (one PRIME loan at a time - see
// apply-eligibility.ts), rather than shown and then refused.
export function QuickActions({ canApply = true }: { canApply?: boolean }) {
  return <ActionTiles actions={canApply ? actions : actions.filter((a) => a.href !== "/dashboard/loans/apply")} />;
}
