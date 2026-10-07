"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { requestMoreInformation } from "@/lib/actions/information-requests";
import { documentTypeLabel } from "@/lib/application-review";
import {
  EMPTY_REQUEST_DRAFT,
  REQUEST_INFORMATION_OPEN_EVENT,
  REQUESTABLE_DOCUMENT_TYPES,
  REQUEST_LIMITS,
  REQUEST_TYPES,
  validateRequestDraft,
  type RequestDraft,
  type RequestDraftErrors,
} from "@/lib/information-requests";
import { cn } from "@/lib/utils";

const fieldClass = cn(
  "rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary disabled:opacity-50",
);

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-danger">
      {message}
    </p>
  ) : null;
}

interface ItemEditorProps {
  index: number;
  draft: RequestDraft;
  errors: RequestDraftErrors;
  disabled: boolean;
  removable: boolean;
  onChange: (patch: Partial<RequestDraft>) => void;
  onRemove: () => void;
}

function ItemEditor({ index, draft, errors, disabled, removable, onChange, onRemove }: ItemEditorProps) {
  const base = useId();
  const ids = {
    type: `${base}-type`,
    reason: `${base}-reason`,
    doc: `${base}-doc`,
    info: `${base}-info`,
    note: `${base}-note`,
  };

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-sm font-semibold text-neutral-900">Request {index + 1}</legend>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded text-sm text-neutral-600 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.type} className="text-sm font-medium text-neutral-700">
          Request type
        </label>
        <select
          id={ids.type}
          value={draft.request_type}
          disabled={disabled}
          aria-invalid={!!errors.request_type}
          aria-describedby={errors.request_type ? `${ids.type}-err` : undefined}
          onChange={(e) => onChange({ request_type: e.target.value as RequestDraft["request_type"] })}
          className={cn(fieldClass, "h-10", errors.request_type && "border-danger")}
        >
          <option value="" disabled>
            Choose one
          </option>
          {REQUEST_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <FieldError id={`${ids.type}-err`} message={errors.request_type} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.reason} className="text-sm font-medium text-neutral-700">
          What&apos;s needed and why <span className="font-normal text-neutral-500">(the customer sees this)</span>
        </label>
        <textarea
          id={ids.reason}
          rows={3}
          maxLength={REQUEST_LIMITS.reason}
          value={draft.reason}
          disabled={disabled}
          aria-invalid={!!errors.reason}
          aria-describedby={errors.reason ? `${ids.reason}-err` : undefined}
          onChange={(e) => onChange({ reason: e.target.value })}
          placeholder="e.g. The payslip you uploaded is from 2024. Please upload one from the last 3 months."
          className={cn(fieldClass, "p-3", errors.reason && "border-danger")}
        />
        <FieldError id={`${ids.reason}-err`} message={errors.reason} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.doc} className="text-sm font-medium text-neutral-700">
            Document to upload <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <select
            id={ids.doc}
            value={draft.required_document_type}
            disabled={disabled}
            onChange={(e) => onChange({ required_document_type: e.target.value as RequestDraft["required_document_type"] })}
            className={cn(fieldClass, "h-10")}
          >
            <option value="">No document</option>
            {REQUESTABLE_DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {documentTypeLabel(t)}
              </option>
            ))}
          </select>
          <FieldError id={`${ids.doc}-err`} message={errors.required_document_type} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.info} className="text-sm font-medium text-neutral-700">
            Information to provide <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input
            id={ids.info}
            maxLength={REQUEST_LIMITS.required_information}
            value={draft.required_information}
            disabled={disabled}
            aria-invalid={!!errors.required_information}
            onChange={(e) => onChange({ required_information: e.target.value })}
            placeholder="e.g. Employer's name and phone number"
            className={cn(fieldClass, "h-10", errors.required_information && "border-danger")}
          />
          <FieldError id={`${ids.info}-err`} message={errors.required_information} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.note} className="text-sm font-medium text-neutral-700">
          Internal note <span className="font-normal text-neutral-500">(optional, staff only - never shown to the customer)</span>
        </label>
        <textarea
          id={ids.note}
          rows={2}
          maxLength={REQUEST_LIMITS.internal_note}
          value={draft.internal_note}
          disabled={disabled}
          aria-invalid={!!errors.internal_note}
          onChange={(e) => onChange({ internal_note: e.target.value })}
          className={cn(fieldClass, "bg-neutral-50 p-3", errors.internal_note && "border-danger")}
        />
        <FieldError id={`${ids.note}-err`} message={errors.internal_note} />
      </div>
    </fieldset>
  );
}

// Request More Information - one round, 1-10 items, each its own request
// the customer must answer. On success the application moves to Customer
// Action Required; the page reloads with a confirmation (and this form
// disappears, since the backend no longer offers request_information).
//
// `id` makes the panel a jump target; REQUEST_INFORMATION_OPEN_EVENT (sent by
// the verification checklist's header) opens it and focuses the first field.
export function RequestInformationForm({ applicationId, id }: { applicationId: number; id?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Set when the open event arrives; the first field is focused once the
  // form has rendered.
  const focusFirst = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => {
      focusFirst.current = true;
      setOpen(true);
      // Already open: no re-render will follow, so focus now.
      formRef.current?.querySelector("select")?.focus();
    };
    window.addEventListener(REQUEST_INFORMATION_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(REQUEST_INFORMATION_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (open && focusFirst.current) {
      focusFirst.current = false;
      formRef.current?.querySelector("select")?.focus();
    }
  }, [open]);
  const [drafts, setDrafts] = useState<RequestDraft[]>([{ ...EMPTY_REQUEST_DRAFT }]);
  const [errors, setErrors] = useState<RequestDraftErrors[]>([{}]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<RequestDraft>) {
    setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    setErrors((e) => e.map((x, j) => (j === i ? { ...x, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) } : x)));
  }

  function add() {
    setDrafts((d) => [...d, { ...EMPTY_REQUEST_DRAFT }]);
    setErrors((e) => [...e, {}]);
  }

  function remove(i: number) {
    setDrafts((d) => d.filter((_, j) => j !== i));
    setErrors((e) => e.filter((_, j) => j !== i));
  }

  async function submit() {
    const nextErrors = drafts.map(validateRequestDraft);
    setErrors(nextErrors);
    if (nextErrors.some((e) => Object.keys(e).length > 0)) {
      setError("Fix the highlighted fields first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await requestMoreInformation(applicationId, drafts);
    if (result.ok) {
      router.replace(`/staff/applications/${applicationId}?requested=${result.requestCount}`, { scroll: true });
      router.refresh();
    } else {
      setSubmitting(false);
      setError(result.error);
    }
  }

  if (!open) {
    return (
      <Card id={id} className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Request more information</CardTitle>
          <p className="mt-1 text-sm text-neutral-600">
            Ask the customer for documents or details. The application waits on them until they respond.
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Start a request
        </Button>
      </Card>
    );
  }

  return (
    <Card id={id} className="scroll-mt-24">
      <CardTitle>Request more information</CardTitle>
      <p className="mt-1 text-sm text-neutral-600">
        Each request is answered separately by the customer. Sending moves the application to Customer Action Required.
      </p>

      <div ref={formRef} className="mt-4 flex flex-col gap-4">
        {drafts.map((d, i) => (
          <ItemEditor
            key={i}
            index={i}
            draft={d}
            errors={errors[i] ?? {}}
            disabled={submitting}
            removable={drafts.length > 1}
            onChange={(patch) => update(i, patch)}
            onRemove={() => remove(i)}
          />
        ))}
      </div>

      {drafts.length < REQUEST_LIMITS.perRound && (
        <button
          type="button"
          onClick={add}
          disabled={submitting}
          className="mt-3 inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add another request
        </button>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Send to customer
        </Button>
        <Button
          variant="ghost"
          disabled={submitting}
          onClick={() => {
            setOpen(false);
            setDrafts([{ ...EMPTY_REQUEST_DRAFT }]);
            setErrors([{}]);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </Card>
  );
}
