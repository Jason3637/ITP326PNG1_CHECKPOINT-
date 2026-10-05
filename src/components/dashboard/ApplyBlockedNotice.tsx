import Link from "next/link";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn, focusRing } from "@/lib/utils";
import type { ApplyBlock } from "@/lib/apply-eligibility";

// Why "Apply for a Loan" isn't offered right now - shown where the button
// would otherwise be.
export function ApplyBlockedNotice({ block, title = "You can't apply for a new loan yet" }: { block: ApplyBlock; title?: string }) {
  return (
    <Card role="note" className="flex items-start gap-3">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" aria-hidden="true" />
      <div className="text-sm">
        <p className="font-medium text-neutral-900">{title}</p>
        <p className="mt-0.5 text-neutral-700">{block.message}</p>
        <Link
          href={block.href}
          className={cn("mt-2 inline-block rounded font-medium text-primary hover:text-primary-dark", focusRing)}
        >
          {block.linkLabel}
        </Link>
      </div>
    </Card>
  );
}
