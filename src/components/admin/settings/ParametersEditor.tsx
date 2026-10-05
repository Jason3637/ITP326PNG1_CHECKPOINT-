"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { saveParameters } from "@/lib/actions/admin-settings";
import { PARAMETER_SPECS, parameterDisplay, parameterInput, validateParameter } from "@/lib/admin-settings";
import type { SystemParameterKey } from "@/lib/types";

const UNIT_SUFFIX = { kina: "K", percent: "%", months: "months" } as const;

// The three live settings, edited together. Only changed values are sent.
// Edit, then confirm; the save button locks on the first click.
export function ParametersEditor({ initial }: { initial: Partial<Record<SystemParameterKey, number>> }) {
  const router = useRouter();
  const specs = PARAMETER_SPECS.filter((s) => initial[s.key] !== undefined);
  const start = Object.fromEntries(specs.map((s) => [s.key, parameterInput(s, initial[s.key]!)])) as Record<SystemParameterKey, string>;
  const [values, setValues] = useState(start);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const changed = specs.filter((s) => values[s.key].trim() !== start[s.key]);
  const problems = specs.map((s) => validateParameter(s, values[s.key])).filter(Boolean) as string[];

  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    const result = await saveParameters(Object.fromEntries(changed.map((s) => [s.key, values[s.key]])));
    if (result.ok) {
      router.replace("/admin/settings?saved=parameters", { scroll: true });
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
        Change these settings
      </Button>
    );
  }

  return (
    <Card className="border-primary/40">
      <CardTitle className="text-base">Change settings</CardTitle>
      <div className="mt-3 flex flex-col gap-3">
        {specs.map((s) => (
          <label key={s.key} className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
            {s.label}
            <span className="flex items-center gap-2">
              {s.unit === "kina" && <span className="text-neutral-600">K</span>}
              <input
                inputMode={s.unit === "months" ? "numeric" : "decimal"}
                value={values[s.key]}
                disabled={confirming}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [s.key]: e.target.value }));
                  setError(null);
                }}
                className="h-9 w-32 rounded-lg border border-neutral-300 bg-white px-2 text-sm text-neutral-900 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              {s.unit !== "kina" && <span className="text-neutral-600">{UNIT_SUFFIX[s.unit]}</span>}
            </span>
          </label>
        ))}
      </div>

      {problems.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 rounded-lg bg-warning-light/50 p-3 text-sm text-amber-800" aria-live="polite">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {confirming ? (
        <div className="mt-4 rounded-lg border border-neutral-300 p-4">
          <p className="font-semibold text-neutral-900">Save these changes?</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-neutral-700">
            {changed.map((s) => (
              <li key={s.key}>
                {s.label}: {parameterDisplay(s, initial[s.key]!)} → {values[s.key].trim()}
                {s.unit === "kina" ? "" : ` ${UNIT_SUFFIX[s.unit]}`}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-neutral-700">They apply from now on. Nothing already produced or verified changes.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving} aria-busy={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save changes
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={saving}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setConfirming(true)} disabled={problems.length > 0 || changed.length === 0}>
            Review change
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setValues(start);
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
