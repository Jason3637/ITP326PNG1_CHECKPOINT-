"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, Lock, MinusCircle, XCircle } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { updateChecklistItem } from "@/lib/actions/checklist";
import {
  CHECKLIST_STATUSES,
  CHECKLIST_STATUS_ACTIONS,
  CHECKLIST_STATUS_LABELS,
  NOTE_MAX_LENGTH,
  noteRequired,
  validateChecklistDraft,
} from "@/lib/checklist";
import { formatReviewDateTime } from "@/lib/application-review";
import { cn } from "@/lib/utils";
import type { ChecklistItemStatus, ReviewChecklist, ReviewChecklistItem } from "@/lib/types";

const STATUS_STYLE: Record<
  ChecklistItemStatus,
  { variant: NonNullable<BadgeProps["variant"]>; icon: typeof Circle; iconClass: string }
> = {
  verified: { variant: "success", icon: CheckCircle2, iconClass: "text-success" },
  failed: { variant: "danger", icon: XCircle, iconClass: "text-danger" },
  not_applicable: { variant: "neutral", icon: MinusCircle, iconClass: "text-neutral-400" },
  pending: { variant: "neutral", icon: Circle, iconClass: "text-neutral-300" },
};

interface ChecklistItemRowProps {
  applicationId: number;
  item: ReviewChecklistItem;
  editable: boolean;
  onSaved: (checklist: ReviewChecklist) => void;
}

// One checklist item with its own draft, its own Save and its own error -
// saving (or failing to save) one item never touches another's unsaved
// draft.
function ChecklistItemRow({ applicationId, item, editable, onSaved }: ChecklistItemRowProps) {
  const noteId = useId();
  const [draftStatus, setDraftStatus] = useState<ChecklistItemStatus>(item.status);
  const [draftNote, setDraftNote] = useState(item.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  // A saved note reads as plain text; the box only appears while the status
  // is being changed, or after "Add note" / "Edit note".
  const [editingNote, setEditingNote] = useState(false);

  const dirty = draftStatus !== item.status || draftNote.trim() !== (item.note ?? "");
  const style = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending;
  const Icon = style.icon;
  const showNote = editable && (editingNote || draftStatus !== item.status);

  function choose(status: ChecklistItemStatus) {
    setDraftStatus(status);
    setError(null);
    setJustSaved(false);
  }

  function cancel() {
    setEditingNote(false);
    setDraftStatus(item.status);
    setDraftNote(item.note ?? "");
    setError(null);
  }

  async function save() {
    const invalid = validateChecklistDraft(draftStatus, draftNote);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateChecklistItem(applicationId, item.item_type, draftStatus, draftNote);
    setSaving(false);
    if (result.ok) {
      const saved = result.checklist.items.find((i) => i.item_type === item.item_type);
      setDraftStatus(saved?.status ?? draftStatus);
      setDraftNote(saved?.note ?? "");
      setJustSaved(true);
      setEditingNote(false);
      onSaved(result.checklist);
    } else {
      setError(result.error);
    }
  }

  return (
    <li className="py-4 first:pt-2">
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", style.iconClass)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-neutral-900">{item.label}</p>
            {item.required ? (
              <Badge variant="primary">Required</Badge>
            ) : (
              <Badge variant="neutral">Optional for this application</Badge>
            )}
            <Badge variant={style.variant}>{CHECKLIST_STATUS_LABELS[item.status]}</Badge>
            {justSaved && !dirty && (
              <span role="status" className="text-xs font-medium text-success">
                Saved
              </span>
            )}
          </div>

          {(item.checked_by_name || item.checked_at) && (
            <p className="mt-1 text-xs text-neutral-600">
              {CHECKLIST_STATUS_LABELS[item.status]}
              {item.checked_by_name ? ` by ${item.checked_by_name}` : ""}
              {item.checked_at ? `, ${formatReviewDateTime(item.checked_at)}` : ""}
            </p>
          )}
          {item.note && !showNote && (
            <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">&ldquo;{item.note}&rdquo;</p>
          )}
          {editable && !showNote && (
            <button
              type="button"
              onClick={() => {
                setEditingNote(true);
                setJustSaved(false);
              }}
              className="mt-1 rounded text-xs font-medium text-primary hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {item.note ? "Edit note" : "Add note"}
            </button>
          )}

          {editable && (
            <div className="mt-3">
              <div role="radiogroup" aria-label={`${item.label} status`} className="flex flex-wrap gap-2">
                {CHECKLIST_STATUSES.map((s) => {
                  const active = draftStatus === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={saving}
                      onClick={() => choose(s)}
                      className={cn(
                        "inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
                        active
                          ? "border-primary bg-primary-light text-primary-dark"
                          : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                      )}
                    >
                      {CHECKLIST_STATUS_ACTIONS[s]}
                    </button>
                  );
                })}
              </div>

              {showNote && (
                <div className="mt-3 flex flex-col gap-1">
                  <label htmlFor={noteId} className="text-xs font-medium text-neutral-700">
                    Note {noteRequired(draftStatus) ? "(required)" : "(optional)"}
                  </label>
                  <textarea
                    id={noteId}
                    rows={2}
                    maxLength={NOTE_MAX_LENGTH}
                    value={draftNote}
                    disabled={saving}
                    onChange={(e) => {
                      setDraftNote(e.target.value);
                      setError(null);
                      setJustSaved(false);
                    }}
                    placeholder={
                      draftStatus === "failed"
                        ? "What's wrong?"
                        : draftStatus === "not_applicable"
                          ? "Why doesn't this apply?"
                          : "e.g. what you checked it against"
                    }
                    className="rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-900 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              )}

              {error && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              {dirty && (
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" onClick={save} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
                    Cancel
                  </Button>
                  <span className="text-xs text-neutral-500">Unsaved</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

interface VerificationChecklistProps {
  applicationId: number;
  initial: ReviewChecklist;
  editable: boolean;
  lockedReason: string;
}

export function VerificationChecklist({ applicationId, initial, editable, lockedReason }: VerificationChecklistProps) {
  const router = useRouter();
  const [checklist, setChecklist] = useState(initial);
  const { summary } = checklist;
  const labelOf = (key: string) => checklist.items.find((i) => i.item_type === key)?.label ?? key;

  function handleSaved(next: ReviewChecklist) {
    setChecklist(next);
    // Re-render the server-rendered panels (document check badges) so
    // they agree with what was just saved. Client state here survives it.
    router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Verification checklist</CardTitle>
          {checklist.started && (
            <p className="mt-1 text-sm text-neutral-600">
              {summary.required_complete} of {summary.required} required checks done. Each check saves on its own.
            </p>
          )}
        </div>
        {checklist.started &&
          (summary.ready_for_approval_recommendation ? (
            <Badge variant="success">All required checks done</Badge>
          ) : (
            <Badge variant="warning">
              {summary.blocking_items.length} {summary.blocking_items.length === 1 ? "check" : "checks"} outstanding
            </Badge>
          ))}
      </div>

      {!editable && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
          {lockedReason}
        </p>
      )}

      {!checklist.started ? null : (
        <>
          {summary.blocking_items.length > 0 && (
            <p className="mt-3 text-xs text-neutral-600">
              Outstanding before an approval recommendation: {summary.blocking_items.map(labelOf).join(", ")}.
            </p>
          )}
          <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
            {checklist.items.map((item) => (
              <ChecklistItemRow
                key={item.item_type}
                applicationId={applicationId}
                item={item}
                editable={editable}
                onSaved={handleSaved}
              />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
