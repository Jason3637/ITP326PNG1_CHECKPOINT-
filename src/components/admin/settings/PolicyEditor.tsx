"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { savePenaltyPolicy, savePricing } from "@/lib/actions/admin-settings";
import {
  NOTE_MAX_LENGTH,
  validatePenalty,
  validatePricing,
  type PenaltyRow,
  type PricingRow,
} from "@/lib/admin-settings";
import { cn, focusRing } from "@/lib/utils";

const inputClass =
  "h-9 w-full rounded-lg border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

type Kind = "pricing" | "penalty";

interface PolicyEditorProps<R> {
  kind: Kind;
  title: string;
  description: string;
  currentLabel: string;
  initialRows: R[];
}

const COLUMNS = {
  pricing: [
    { key: "category", label: "Category", suffix: "", inputMode: "text" },
    { key: "min", label: "From (K)", suffix: "", inputMode: "numeric" },
    { key: "max", label: "To (K)", suffix: "", inputMode: "numeric" },
    { key: "ratePct", label: "Interest (flat, %)", suffix: "%", inputMode: "decimal" },
  ],
  penalty: [
    { key: "daysLate", label: "Days late", suffix: "", inputMode: "numeric" },
    { key: "pct", label: "Penalty (% of original interest)", suffix: "%", inputMode: "decimal" },
  ],
} as const;

const MAX_ROWS = { pricing: 10, penalty: 5 };
const BLANK = { pricing: { category: "", min: "", max: "", ratePct: "" }, penalty: { daysLate: "", pct: "" } };

// Edits one versioned policy table. Saving creates a new version on the
// backend - the current one is never edited in place. Two steps (edit,
// then confirm), and the save button locks on the first click.
export function PolicyEditor<R extends PricingRow | PenaltyRow>({
  kind,
  title,
  description,
  currentLabel,
  initialRows,
}: PolicyEditorProps<R>) {
  const router = useRouter();
  const [rows, setRows] = useState<R[]>(initialRows);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const columns = COLUMNS[kind];
  const problems = kind === "pricing" ? validatePricing(rows as PricingRow[]) : validatePenalty(rows as PenaltyRow[]);
  const changed = JSON.stringify(rows) !== JSON.stringify(initialRows);

  function update(i: number, key: string, value: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
    setError(null);
  }

  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    const result =
      kind === "pricing" ? await savePricing(rows as PricingRow[], note) : await savePenaltyPolicy(rows as PenaltyRow[], note);
    if (result.ok) {
      router.replace(`/admin/settings?saved=${kind}`, { scroll: true });
      router.refresh();
    } else {
      inFlight.current = false;
      setSaving(false);
      setConfirming(false);
      setError(result.error);
    }
  }

  if (!editing) {
    return (
      <Button variant="secondary" onClick={() => setEditing(true)} className="w-fit">
        Change {kind === "pricing" ? "PRIME pricing" : "late penalties"}
      </Button>
    );
  }

  return (
    <Card className="border-primary/40">
      <CardTitle className="text-base">{title}</CardTitle>
      <p className="mt-1 text-sm text-neutral-600">{description}</p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-600">
              {columns.map((c) => (
                <th key={c.key} className="pb-1 pr-2 font-medium">
                  {c.label}
                </th>
              ))}
              <th className="pb-1">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} className="py-1 pr-2">
                    <input
                      aria-label={`Tier ${i + 1} ${c.label}`}
                      inputMode={c.inputMode}
                      value={(row as unknown as Record<string, string>)[c.key]}
                      onChange={(e) => update(i, c.key, e.target.value)}
                      disabled={confirming}
                      className={inputClass}
                    />
                  </td>
                ))}
                <td className="py-1">
                  <button
                    type="button"
                    aria-label={`Remove tier ${i + 1}`}
                    disabled={rows.length <= 1 || confirming}
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    className={cn("rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-danger disabled:opacity-40", focusRing)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length < MAX_ROWS[kind] && !confirming && (
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, { ...BLANK[kind] } as R])}
          className={cn("mt-2 inline-flex items-center gap-1 rounded text-sm font-medium text-primary hover:text-primary-dark", focusRing)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add a tier
        </button>
      )}

      {problems.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 rounded-lg bg-warning-light/50 p-3 text-sm text-amber-800" aria-live="polite">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={`${kind}-note`} className="text-sm font-medium text-neutral-700">
          Why the change <span className="font-normal text-neutral-500">(optional, kept with the version)</span>
        </label>
        <textarea
          id={`${kind}-note`}
          rows={2}
          maxLength={NOTE_MAX_LENGTH}
          value={note}
          disabled={confirming}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white p-2 text-sm text-neutral-900 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {confirming ? (
        <div className="mt-4 rounded-lg border border-neutral-300 p-4">
          <p className="font-semibold text-neutral-900">Save as a new version?</p>
          <p className="mt-1 text-sm text-neutral-700">
            It replaces {currentLabel} for applications submitted from now on. Applications already submitted and every
            existing loan keep what they have.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving} aria-busy={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save new version
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={saving}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setConfirming(true)} disabled={problems.length > 0 || !changed}>
            Review change
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setRows(initialRows);
              setNote("");
              setEditing(false);
              setError(null);
            }}
          >
            Cancel
          </Button>
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
