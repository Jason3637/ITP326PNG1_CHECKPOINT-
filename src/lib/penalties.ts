import type { Loan } from "./types";

// Plain calendar date ("2026-09-22") -> "Sep 22, 2026", without timezone shift.
export function formatPlainDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// What the customer still owes on a loan, penalties included, when the
// backend provides the ledger balance; null on older backends (callers keep
// their previous figure).
export function loanOutstanding(loan: Pick<Loan, "balance">): number | null {
  return loan.balance ? loan.balance.outstanding : null;
}

export function loanPenalties(loan: Pick<Loan, "balance">) {
  const b = loan.balance;
  return { total: b?.penalties ?? 0, items: b?.penalty_items ?? [] };
}
