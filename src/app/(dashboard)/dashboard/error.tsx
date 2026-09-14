"use client";

import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-danger" aria-hidden="true" />
      <div>
        <p className="font-semibold text-neutral-900">Couldn&apos;t load your dashboard</p>
        <p className="mt-1 text-sm text-neutral-500">The server may be unreachable, or something went wrong.</p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </Card>
  );
}
