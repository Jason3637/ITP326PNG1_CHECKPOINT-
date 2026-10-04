import { Card, CardTitle } from "@/components/ui/Card";
import { formatPlainDate } from "@/lib/penalties";
import { ledgerEntryLabel, ledgerWithBalance, signedKina } from "@/lib/admin-loans";
import { cn, formatKina } from "@/lib/utils";
import type { AdminLedgerEntry } from "@/lib/types";

// The loan's ledger in the order entries were added - the record every
// balance comes from.
// Entries are only ever added (never edited): the original amount owed,
// any late penalties, each verified repayment.
export function LedgerPanel({ entries, outstanding }: { entries: AdminLedgerEntry[]; outstanding: number }) {
  const rows = ledgerWithBalance(entries);
  const last = rows.at(-1)?.balanceAfter ?? 0;
  return (
    <Card>
      <CardTitle>Ledger</CardTitle>
      <p className="mt-1 text-sm text-neutral-600">
        Every amount added to or paid off this loan, in the order it was recorded. Entries are only ever added, never changed.
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">No ledger entries.</p>
      ) : (
        <ol className="mt-3 flex flex-col divide-y divide-neutral-100">
          {rows.map(({ entry, balanceAfter }) => (
            <li key={entry.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900">{ledgerEntryLabel(entry)}</p>
                <p className="text-xs text-neutral-600">
                  {formatPlainDate(entry.effective_date)} · {entry.created_by_kind === "system" ? "Added by the system" : "Recorded by an administrator"}
                </p>
                {entry.note && <p className="mt-0.5 text-xs text-neutral-700">{entry.note}</p>}
              </div>
              <div className="text-right">
                <p className={cn("text-sm font-semibold", entry.amount < 0 ? "text-success" : "text-neutral-900")}>
                  {signedKina(entry.amount)}
                </p>
                <p className="text-xs text-neutral-600">Balance {formatKina(balanceAfter)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-3 text-sm">
        <span className="font-medium text-neutral-700">Outstanding balance</span>
        <span className="font-display text-lg font-bold text-neutral-900">{formatKina(outstanding)}</span>
      </div>
      {Math.round(last * 100) !== Math.round(outstanding * 100) && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          The entries above add up to {formatKina(last)}, which doesn&apos;t match the outstanding balance the system
          reports. Report this before acting on the loan.
        </p>
      )}
    </Card>
  );
}
