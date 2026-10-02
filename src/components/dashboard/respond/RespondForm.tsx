"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FileUploadField } from "@/components/ui/FileUploadField";
import { uploadLoanDocument } from "@/lib/actions/documents";
import { respondToActionRequired } from "@/app/(dashboard)/dashboard/applications/[applicationId]/respond/actions";
import { documentNoun, requestTypeLabel, requiredItems } from "@/lib/information-requests";
import type { CustomerInformationRequest, LoanApplication } from "@/lib/types";

interface RespondFormProps {
  application: LoanApplication;
}

interface AnswerState {
  note: string;
  file: File | null;
  // Set once this file is uploaded, so a retry after a failed submit
  // doesn't upload the same file twice.
  uploaded: { file: File; documentId: number } | null;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// The customer's side of Request More Information. Each open request is
// shown with its type, what's needed and the specific items asked for
// (a document to upload, information to provide), and gets its own answer
// - the backend requires every open request to be answered in one go,
// each linked to its own request. Everything updates the SAME application.
//
// Documents are uploaded unlinked and only attached to the application by
// the respond call itself, so the backend links them and retires the old
// version in the same step as recording the answers - a failed submit
// never half-replaces a document.
export function RespondForm({ application }: RespondFormProps) {
  const router = useRouter();
  const openRequests = application.information_requests.filter((r) => r.status === "open");
  const earlier = application.information_requests.filter((r) => r.status !== "open");

  const [answers, setAnswers] = useState<Record<number, AnswerState>>(() =>
    Object.fromEntries(openRequests.map((r) => [r.id, { note: "", file: null, uploaded: null }])),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<number, { note?: string; file?: string }>>({});
  const [stage, setStage] = useState<"idle" | "uploading" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const busy = stage !== "idle";

  function update(id: number, patch: Partial<AnswerState>) {
    setAnswers((a) => ({ ...a, [id]: { ...a[id], ...patch } }));
    setFieldErrors((e) => ({ ...e, [id]: {} }));
  }

  function validate() {
    const errors: Record<number, { note?: string; file?: string }> = {};
    for (const r of openRequests) {
      const a = answers[r.id];
      const e: { note?: string; file?: string } = {};
      if (!a.note.trim()) e.note = "Write a short answer to this request.";
      else if (a.note.trim().length > 1000) e.note = "Keep your answer under 1000 characters.";
      if (r.required_document_type && !a.file) e.file = `Upload your ${documentNoun(r.required_document_type)}.`;
      if (e.note || e.file) errors[r.id] = e;
    }
    return errors;
  }

  async function handleSubmit() {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Answer each request before sending.");
      return;
    }
    setError(null);

    try {
      const documentIds: number[] = [];
      for (const r of openRequests) {
        const a = answers[r.id];
        if (!r.required_document_type || !a.file) continue;
        if (a.uploaded && a.uploaded.file === a.file) {
          documentIds.push(a.uploaded.documentId);
          continue;
        }
        setStage("uploading");
        const form = new FormData();
        form.set("file", a.file);
        form.set("document_type", r.required_document_type);
        const upload = await uploadLoanDocument(form);
        if (!upload.ok) {
          setStage("idle");
          setFieldErrors((e) => ({ ...e, [r.id]: { file: `Upload failed: ${upload.error}` } }));
          setError("One of your documents didn't upload. Check it and try again.");
          return;
        }
        update(r.id, { uploaded: { file: a.file, documentId: upload.document.id } });
        documentIds.push(upload.document.id);
      }

      setStage("submitting");
      const res = await respondToActionRequired({
        applicationId: application.id,
        responses: openRequests.map((r) => ({ information_request_id: r.id, response_note: answers[r.id].note })),
        documentIds,
      });
      setStage("idle");
      if (res.ok) setDone(true);
      else setError(res.error);
    } catch {
      setStage("idle");
      setError("Something went wrong. Try again.");
    }
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center sm:p-8">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
        <div>
          <p className="font-display text-xl font-bold tracking-tight text-neutral-900">Response submitted</p>
          <p className="mt-1 max-w-sm text-sm text-neutral-600">
            Your loan officer will review what you provided. Application #{application.id} is back under review.
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/applications")}>Back to my applications</Button>
      </Card>
    );
  }

  return (
    <Card className="sm:p-8">
      <CardHeader>
        <CardTitle>Respond to your application</CardTitle>
      </CardHeader>

      {openRequests.length === 0 ? (
        <p className="text-sm text-neutral-700">
          Your loan officer needs more information, but the request couldn&apos;t be loaded. Refresh the page, or
          contact us if this keeps happening.
        </p>
      ) : (
        <>
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-warning-light bg-warning-light/40 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" aria-hidden="true" />
            <p className="text-sm text-neutral-800">
              Your loan officer needs {openRequests.length === 1 ? "one thing" : `${openRequests.length} things`} before
              they can continue reviewing application #{application.id}. Answer each one below, then send.
            </p>
          </div>

          <ol className="flex flex-col gap-4">
            {openRequests.map((r, i) => (
              <RequestAnswer
                key={r.id}
                index={i}
                total={openRequests.length}
                request={r}
                answer={answers[r.id]}
                errors={fieldErrors[r.id] ?? {}}
                disabled={busy}
                onChange={(patch) => update(r.id, patch)}
              />
            ))}
          </ol>

          {error && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {error}
            </p>
          )}

          <Button size="lg" onClick={handleSubmit} disabled={busy} className="mt-5 w-full sm:w-auto">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {stage === "uploading" ? "Uploading..." : "Submitting..."}
              </>
            ) : (
              "Send response"
            )}
          </Button>
        </>
      )}

      {earlier.length > 0 && (
        <details className="mt-6 border-t border-neutral-100 pt-4">
          <summary className="cursor-pointer text-sm font-medium text-neutral-700">
            Earlier requests on this application ({earlier.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {earlier.map((r) => (
              <li key={r.id} className="text-sm">
                <p className="font-medium text-neutral-900">{requestTypeLabel(r.request_type)}</p>
                <p className="text-neutral-700">{r.reason}</p>
                {r.response ? (
                  <p className="mt-0.5 text-xs text-neutral-600">
                    You answered {formatDate(r.response.responded_at) ?? ""}: &ldquo;{r.response.response_note}&rdquo;
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-neutral-600">No longer needed.</p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

interface RequestAnswerProps {
  index: number;
  total: number;
  request: CustomerInformationRequest;
  answer: AnswerState;
  errors: { note?: string; file?: string };
  disabled: boolean;
  onChange: (patch: Partial<AnswerState>) => void;
}

function RequestAnswer({ index, total, request: r, answer, errors, disabled, onChange }: RequestAnswerProps) {
  const noteId = `answer-${r.id}`;
  const items = requiredItems(r);

  return (
    <li className="rounded-lg border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {total > 1 && <span className="text-xs font-semibold text-neutral-500">{index + 1} of {total}</span>}
        <Badge variant="warning">{requestTypeLabel(r.request_type)}</Badge>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-neutral-900">{r.reason}</p>
      {items.length > 0 && (
        <div className="mt-2 rounded bg-neutral-50 p-2">
          <p className="text-xs font-medium text-neutral-700">What to send</p>
          <ul className="mt-0.5 list-disc pl-5 text-sm text-neutral-800">
            {items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={noteId} className="text-sm font-medium text-neutral-700">
          Your answer
        </label>
        <textarea
          id={noteId}
          rows={3}
          maxLength={1000}
          value={answer.note}
          disabled={disabled}
          aria-invalid={!!errors.note}
          aria-describedby={errors.note ? `${noteId}-err` : undefined}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder={r.required_information ? `e.g. ${r.required_information}` : "Explain what you're providing or what's changed"}
          className="rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {errors.note && (
          <p id={`${noteId}-err`} className="text-sm text-danger">
            {errors.note}
          </p>
        )}
      </div>

      {r.required_document_type && (
        <div className="mt-3">
          <FileUploadField
            label={`Upload your ${documentNoun(r.required_document_type)}`}
            hint="PDF, JPG, or PNG, up to 10 MB"
            value={answer.file}
            onChange={(file) => onChange({ file })}
            error={errors.file}
            disabled={disabled}
          />
        </div>
      )}
    </li>
  );
}
