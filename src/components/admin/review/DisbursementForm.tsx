"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, Smartphone } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { RadioCardGroup } from "@/components/ui/RadioCardGroup";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { DetailList, DetailRow } from "@/components/staff/review/DetailList";
import { recordDisbursement, uploadDisbursementEvidence } from "@/lib/actions/admin-disbursement";
import {
  DISBURSEMENT_COPY as COPY,
  NOTE_MAX_LENGTH,
  evidenceRequired,
  REFERENCE_MAX_LENGTH,
  validateDisbursement,
  type DisbursementInput,
} from "@/lib/disbursement";
import { formatKina } from "@/lib/utils";
import type { DisbursementMethod } from "@/lib/types";

interface DisbursementFormProps {
  applicationId: number;
  customerName: string;
  amount: number; // the principal to pay out - the backend's figure
  totalRepayable: number | null;
  requestedMethod: DisbursementMethod | null; // the customer's preference
  maskedDestination: string | null; // the customer's BSP account, masked
}

const ICONS = { bsp_mobile_banking: Smartphone, cash_on_hand: Banknote } as const;

// Lets another part of the page (the status bar's "Record disbursement")
// open the dialog without sharing state through the server page.
const OPEN_EVENT = "primestone:open-disbursement";

export function RecordDisbursementButton({ label = COPY.title }: { label?: string }) {
  return <Button onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>{label}</Button>;
}

// A datetime-local value is Port Moresby wall-clock time with no offset;
// shown as written, never converted.
function formatMoneyMoved(value: string): string {
  if (!value) return "Just now";
  const d = new Date(`${value}:00Z`);
  return Number.isNaN(d.getTime())
    ? value.replace("T", " ")
    : `${d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}, Port Moresby time`;
}

// Records the payout, in a dialog of its own so the money step is
// separate from the information around it. Two steps - fill in, then
// review exactly what will be recorded and confirm - because it can't be
// undone. The confirm button locks on the first click - state AND a ref,
// so a fast double-click can't start a second request before React
// re-renders - and stays locked until the backend answers; the dialog
// can't be closed while it's in flight. Nothing here ever says the loan is
// active: the page shows that from the backend's loan record after a
// successful save.
export function DisbursementForm({
  applicationId,
  customerName,
  amount,
  totalRepayable,
  requestedMethod,
  maskedDestination,
}: DisbursementFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    const openDialog = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, openDialog);
    return () => window.removeEventListener(OPEN_EVENT, openDialog);
  }, []);

  // Closing keeps what was typed (reopening shows it) but always comes
  // back to the fill-in step, never straight to an armed Confirm.
  function close() {
    if (busy) return;
    setOpen(false);
    setConfirming(false);
  }

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

  const figures = (
    <dl className="grid grid-cols-2 gap-3 rounded-lg bg-neutral-50 p-3 text-sm">
      <div>
        <dt className="text-xs text-neutral-600">Pay out</dt>
        <dd className="font-display text-xl font-bold tabular-nums text-neutral-900">{formatKina(amount)}</dd>
      </div>
      {totalRepayable !== null && (
        <div>
          <dt className="text-xs text-neutral-600">Customer repays</dt>
          <dd className="font-display text-xl font-bold tabular-nums text-neutral-900">{formatKina(totalRepayable)}</dd>
        </div>
      )}
    </dl>
  );

  const errorLine = error && (
    <p role="alert" className="mt-4 flex items-start gap-1.5 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {error}
    </p>
  );

  const fillIn = (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-neutral-600">{COPY.intro}</p>
      {figures}

      <RadioCardGroup<DisbursementMethod>
        legend="Payment method"
        value={method}
        onChange={(m) => {
          setMethod(m);
          setError(null);
        }}
        columns={2}
        options={(["bsp_mobile_banking", "cash_on_hand"] as const).map((m) => ({
          value: m,
          label: COPY.methods[m].label,
          description: `${COPY.methods[m].help}${requestedMethod === m ? " The customer asked for this." : ""}`,
          icon: ICONS[m],
        }))}
      />

      {method === "bsp_mobile_banking" && (
        <p className="-mt-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
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
            className="w-full"
            onChange={(e) => {
              setReference(e.target.value);
              setError(null);
            }}
          />
          <Input
            type="datetime-local"
            label={`${COPY.disbursedAtLabel} (optional)`}
            hint={COPY.disbursedAtHint}
            value={disbursedAt}
            className="w-full"
            onChange={(e) => {
              setDisbursedAt(e.target.value);
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
          <Textarea
            id="disbursement-note"
            label={COPY.noteLabel}
            requirement="optional"
            rows={2}
            maxLength={NOTE_MAX_LENGTH}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </>
      )}
    </div>
  );

  const reviewStep = method && copy && (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-600">{COPY.reviewIntro}</p>
      <DetailList>
        <DetailRow label="Customer" value={customerName} />
        <DetailRow label="Amount paid out" value={formatKina(amount)} />
        {totalRepayable !== null && <DetailRow label="Customer repays" value={formatKina(totalRepayable)} />}
        <DetailRow label="Method" value={copy.label} />
        {method === "bsp_mobile_banking" && maskedDestination && <DetailRow label="Paid to" value={maskedDestination} />}
        <DetailRow label={copy.referenceLabel} value={<span className="break-all">{reference.trim()}</span>} />
        <DetailRow label="Money moved" value={formatMoneyMoved(disbursedAt)} />
        <DetailRow label="Evidence" value={evidence ? <span className="break-all">{evidence.name}</span> : "None"} />
        {note.trim() && <DetailRow label={COPY.noteLabel} value={<span className="whitespace-pre-line">{note.trim()}</span>} />}
      </DetailList>
      <div className="rounded-lg border border-warning/40 bg-warning-light p-3 text-sm">
        <p className="font-semibold text-neutral-900">{COPY.confirmTitle}</p>
        <p className="mt-0.5 text-neutral-800">{COPY.confirmBody}</p>
      </div>
    </div>
  );

  const reviewing = confirming && method && copy;

  return (
    <>
      <Card variant="emphasis">
        <CardTitle>Disbursement</CardTitle>
        <p className="mt-1 text-sm text-neutral-600">Approved and waiting to be paid out. Record it once the money has moved.</p>
        <div className="mt-4">{figures}</div>
        <Button className="mt-4 w-full" onClick={() => setOpen(true)}>
          {COPY.title}
        </Button>
      </Card>

      <Dialog
        open={open}
        onClose={close}
        dismissible={!busy}
        title={reviewing ? COPY.reviewTitle : COPY.title}
        footer={
          reviewing ? (
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                {COPY.back}
              </Button>
              <Button onClick={submit} loading={busy}>
                {phase === "uploading" ? COPY.uploading : phase === "saving" ? COPY.saving : COPY.confirm}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>
                {COPY.cancel}
              </Button>
              <Button onClick={review} disabled={!method || !reference.trim() || (evidenceRequired(method) && !evidence)}>
                {COPY.review}
              </Button>
            </>
          )
        }
      >
        {/* Both steps stay mounted; only one shows. The fill-in fields keep
            their values while reviewing, and Back returns to them as left. */}
        <div hidden={!!reviewing}>{fillIn}</div>
        {reviewing && reviewStep}
        {errorLine}
      </Dialog>
    </>
  );
}
