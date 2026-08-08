import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, HandCoins, Receipt, type LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { mockTransactions } from "@/lib/mock-data";
import { cn, formatKina } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

const TYPE_META: Record<Transaction["type"], { icon: LucideIcon; direction: "in" | "out" }> = {
  deposit: { icon: ArrowDownLeft, direction: "in" },
  loan_disbursement: { icon: HandCoins, direction: "in" },
  withdrawal: { icon: ArrowUpRight, direction: "out" },
  repayment: { icon: Receipt, direction: "out" },
};

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function RecentTransactions() {
  const recent = mockTransactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <Card id="recent-transactions" className="animate-card-enter scroll-mt-20">
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <Link href="/dashboard/transactions" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>

      <ul className="flex flex-col divide-y divide-neutral-100">
        {recent.map((txn) => {
          const { icon: Icon, direction } = TYPE_META[txn.type];
          const isIn = direction === "in";

          return (
            <li key={txn.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  isIn ? "bg-success-light text-success" : "bg-neutral-100 text-neutral-600",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{txn.description}</p>
                <p className="text-xs text-neutral-500">{formatDate(txn.date)}</p>
              </div>

              <p
                className={cn(
                  "tabular-nums text-sm font-semibold",
                  isIn ? "text-success" : "text-neutral-900",
                )}
              >
                {isIn ? "+" : "−"}
                {formatKina(txn.amount)}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
