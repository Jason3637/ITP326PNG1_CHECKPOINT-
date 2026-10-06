"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, Loader2, Smartphone } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { recordDisbursement, uploadDisbursementEvidence } from "@/lib/actions/admin-disbursement";
import {
  DISBURSEMENT_COPY as COPY,
  NOTE_MAX_LENGTH,
  evidenceRequired,
  REFERENCE_MAX_LENGTH,
  validateDisbursement,
  type DisbursementInput,
} from "@/lib/disbursement";
import { cn, formatKina } from "@/lib/utils";
import type { DisbursementMethod } from "@/lib/types";

interface DisbursementFormProps {
  applicationId: number;
  amount: number; // the principal to pay out - the backend's figure
  totalRepayable: number | null;
  requestedMethod: DisbursementMethod | null; // the customer's preference
  maskedDestination: string | null; // the customer's BSP account, masked
}

const ICONS = { bsp_mobile_banking: Smartphone, cash_on_hand: Banknote } as const;

// Records the payout. Two steps (fill in, then confirm) because it can't be
// undone. The record button locks on the first click - state AND a ref, so
// a fast double-click can't start a second request before React re-renders
// - and stays locked until the backend answers. Nothing here ever says the
// loan is active: the page shows that from the backend's loan record after
// a successful save.
export function DisbursementForm({
  applicationId,
  amount,
  totalRepayable,
  requestedMethod,
  maskedDestination,
}: DisbursementFormProps) {
  const router = useRouter();
  const [method, setMethod] = useState<DisbursementMethod | "">(requestedMethod ?? "");
  const [reference, setReference] = useState("");
  const [disbursedAt, setDisbursedAt] = useState("");
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  // Kept across a failed save so a retry doesn't upload the file again.
  const [evidenceId, setEvidenceId] = useState<{ file: File; id: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const busy = phase !== "idle";
  const copy = method ? COPY.methods[method] : null;
  const input = (): DisbursementInput | null =>
    method ? { method, reference, disbursedAt, note } : null;

  function review() {
    const i = input();
    const invalid = i ? validateDisbursement(i, evidence !== null) : "Choose how the money was paid out.";
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function submit() {
    const i = input();
    if (!i || inFlight.current) return;
    inFlight.current = true;
    setError(null);

    let documentId: number | null = null;
    if (evidence) {
      if (evidenceId?.file === evidence) {
        documentId = evidenceId.id;
      } else {
        setPhase("uploading");
        const form = new FormData();
        form.set("application_id", String(applicationId));
        form.set("file", evidence);
        const uploaded = await uploadDisbursementEvidence(form);
        if (!uploaded.ok) {
          inFlight.current = false;
          setPhase("idle");
          setConfirming(false);
          setError(uploaded.error);
          return;
        }
        documentId = uploaded.documentId;
        setEvidenceId({ file: evidence, id: uploaded.documentId });
      }
    }

    setPhase("saving");
    const result = await recordDisbursement(applicationId, i, documentId);
    if (result.ok) {
      // Stays locked: the page reloads from the backend and shows the loan.
      router.replace(`/admin/applications/${applicationId}?disbursed=${result.loanId}`, { scroll: true });
      router.refresh();
    } else {
      inFlight.current = false;
      setPhase("idle");
      setConfirming(false);
      setError(result.error);
    }
  }

  return (
    <Card variant="emphasis">
      <CardTitle>{COPY.title}</CardTitle>
      <p className="mt-1 text-sm text-neutral-600">{COPY.intro}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-neutral-50 p-3 text-sm">
        <div>
          <dt className="text-xs text-neutral-600">Pay out</dt>
          <dd className="font-display text-xl font-bold text-neutral-900">{formatKina(amount)}</dd>
        </div>
        {totalRepayable !== null && (
          <div>
            <dt className="text-xs text-neutral-600">Customer repays</dt>
            <dd className="font-display text-xl font-bold text-neutral-900">{formatKina(totalRepayable)}</dd>
          </div>
        )}
      </dl>

      {confirming && method && copy ? (
        <div className="mt-4 rounded-lg border border-neutral-300 p-4">
          <p className="font-semibold text-neutral-900">{COPY.confirmTitle}</p>
          <p className="mt-1 text-sm text-neutral-700">{COPY.confirmBody}</p>
          <dl className="mt-3 flex flex-col gap-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-600">Method</dt>
              <dd className="text-right text-neutral-900">{copy.label}</dd>
            </div>
            {method === "bsp_mobile_banking" && maskedDestination && (
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-600">Paid to</dt>
                <dd className="text-right text-neutral-900">{maskedDestination}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-600">{copy.referenceLabel}</dt>
              <dd className="break-all text-right text-neutral-900">{reference.trim()}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-600">Money moved</dt>
              <dd className="text-right text-neutral-900">{disbursedAt ? disbursedAt.replace("T", " ") : "Just now"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-600">Evidence</dt>
              <dd className="truncate text-right text-neutral-900">{evidence ? evidence.name : "None"}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={submit} disabled={busy} aria-busy={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {phase === "uploading" ? COPY.uploading : phase === "saving" ? COPY.saving : COPY.confirm}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              {COPY.back}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div role="radiogroup" aria-label="Disbursement method" className="grid gap-2 sm:grid-cols-2">
            {(["bsp_mobile_banking", "cash_on_hand"] as const).map((m) => {
              const active = method === m;
              const Icon = ICONS[m];
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setMethod(m);
                    setError(null);
                  }}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active ? "border-primary bg-primary-light" : "border-neutral-200 hover:bg-neutral-50",
                  )}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900">{COPY.methods[m].label}</span>
                    <span className="block text-xs text-neutral-600">
                      {COPY.methods[m].help}
                      {requestedMethod === m ? " The customer asked for this." : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {method === "bsp_mobile_banking" && (
            <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
              {maskedDestination ? (
                <>
                  Paid to the account on the application: <span className="font-medium">{maskedDestination}</span>
                </>
              ) : (
                <span className="text-amber-800">The customer didn&apos;t give a BSP account on the application.</span>
              )}
            </p>
          )}

          {method && copy && (
            <>
              <Input
                label={`${copy.referenceLabel} (required)`}
                value={reference}
                maxLength={REFERENCE_MAX_LENGTH}
                placeholder={copy.referencePlaceholder}
                onChange={(e) => {
                  setReference(e.target.value);
                  setError(null);
                }}
              />
              <FileUploadField
                label={`${copy.evidenceLabel} (${method && evidenceRequired(method) ? "required" : "optional"})`}
                hint={COPY.evidenceHint}
                value={evidence}
                onChange={(f) => {
                  setEvidence(f);
                  setError(null);
                }}
              />
              <div className="flex flex-col gap-1">
                <Input
                  type="datetime-local"
                  label={`${COPY.disbursedAtLabel} (optional)`}
                  value={disbursedAt}
                  onChange={(e) => {
                    setDisbursedAt(e.target.value);
                    setError(null);
                  }}
                />
                <p className="text-xs text-neutral-600">{COPY.disbursedAtHint}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="disbursement-note" className="text-sm font-medium text-neutral-700">
                  {COPY.noteLabel} <span className="font-normal text-neutral-500">(optional)</span>
                </label>
                <textarea
                  id="disbursement-note"
                  rows={2}
                  maxLength={NOTE_MAX_LENGTH}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
            </>
          )}

          <div>
            <Button onClick={review} disabled={!method || !reference.trim() || (evidenceRequired(method) && !evidence)}>
              {COPY.review}
            </Button>
          </div>
        </div>
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
