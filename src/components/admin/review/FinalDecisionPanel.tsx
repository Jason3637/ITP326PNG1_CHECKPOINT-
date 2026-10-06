"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Undo2, XCircle } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { decideApplication } from "@/lib/actions/admin-decisions";
import {
  DECISION_COPY as COPY,
  REASON_MAX_LENGTH,
  textRequired,
  validateDecision,
  type AdminDecision,
} from "@/lib/admin-decisions";
import { cn } from "@/lib/utils";
import type { OfficerRecommendationType } from "@/lib/types";

interface FinalDecisionPanelProps {
  applicationId: number;
  // The backend's final_decision flags - which actions it will accept now.
  canApprove: boolean;
  canReject: boolean;
  canReturn: boolean;
  // The latest officer recommendation, if any - approving against a
  // rejection needs a note.
  latestRecommendation: OfficerRecommendationType | null;
}

const ICONS = { approve: CheckCircle2, reject: XCircle, return: Undo2 } as const;
const ICON_TONE = { approve: "text-success", reject: "text-danger", return: "text-amber-800" } as const;

// Approve / Reject / Return to Loan Officer - nothing else. Two steps
// (choose and explain, then confirm) because a decision can't be undone.
// A required reason is enforced before the confirm step can be reached.
export function FinalDecisionPanel({
  applicationId,
  canApprove,
  canReject,
  canReturn,
  latestRecommendation,
}: FinalDecisionPanelProps) {
  const router = useRouter();
  const [decision, setDecision] = useState<AdminDecision | "">("");
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = (["approve", "reject", "return"] as const).filter((d) =>
    d === "approve" ? canApprove : d === "reject" ? canReject : canReturn,
  );
  if (options.length === 0) return null;

  const needsText = decision !== "" && textRequired(decision, latestRecommendation);
  const canReview = decision !== "" && (!needsText || text.trim().length > 0);

  function review() {
    if (!decision) return;
    const invalid = validateDecision(decision, text, latestRecommendation);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function send() {
    if (!decision) return;
    setSending(true);
    setError(null);
    const result = await decideApplication(applicationId, decision, needsText ? text : "", latestRecommendation);
    if (result.ok) {
      router.replace(`/admin/applications/${applicationId}?decided=${result.outcome}`, { scroll: true });
      router.refresh();
    } else {
      setSending(false);
      setConfirming(false);
      setError(result.error);
    }
  }

  return (
    <Card variant="emphasis">
      <CardTitle>{COPY.title}</CardTitle>
      <p className="mt-1 text-sm text-neutral-600">{COPY.intro}</p>

      {confirming && decision ? (
        <div className="mt-4 rounded-lg border border-neutral-300 p-4">
          <p className="font-semibold text-neutral-900">{COPY.options[decision].confirmTitle}</p>
          <p className="mt-1 text-sm text-neutral-700">{COPY.options[decision].confirmBody}</p>
          {needsText && (
            <>
              <p className="mt-3 text-xs font-medium text-neutral-600">{COPY.textHeading}</p>
              <p className="mt-0.5 whitespace-pre-line text-sm text-neutral-900">{text.trim()}</p>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant={decision === "reject" ? "danger" : "primary"} onClick={send} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {COPY.options[decision].confirm}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={sending}>
              {COPY.back}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label="Decision" className="mt-4 grid gap-2">
            {options.map((d) => {
              const active = decision === d;
              const Icon = ICONS[d];
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setDecision(d);
                    setError(null);
                  }}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active ? "border-primary bg-primary-light" : "border-neutral-200 hover:bg-neutral-50",
                  )}
                >
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ICON_TONE[d])} aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900">{COPY.options[d].label}</span>
                    <span className="block text-xs text-neutral-600">{COPY.options[d].help}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {decision && needsText && (
            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="decision-text" className="text-sm font-medium text-neutral-700">
                {COPY.options[decision].textLabel} <span className="font-normal text-neutral-500">(required)</span>
              </label>
              <textarea
                id="decision-text"
                rows={4}
                maxLength={REASON_MAX_LENGTH}
                required
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
                placeholder={COPY.options[decision].placeholder}
                className="rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          )}

          <div className="mt-4">
            <Button onClick={review} disabled={!canReview}>
              {COPY.submit}
            </Button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </Card>
  );
}
