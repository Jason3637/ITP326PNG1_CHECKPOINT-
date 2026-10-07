import { Circle, type LucideIcon } from "lucide-react";
import { CHECKLIST_STATUS_LABELS } from "./checklist";
import { staffStatusLabel } from "./officer-queues";
import { recommendationLabel } from "./recommendations";
import { TONE_ICONS, statusTone, type StatusTone } from "./status-tone";
import type { ChecklistItemStatus, InformationRequestStatus, OfficerRecommendationType } from "./types";

// How every status on the staff review screens is shown - the words, the
// tone and the icon - in one place, so a status reads the same in a queue,
// a panel and a badge. The status values are the backend's own; labels come
// from the existing helpers (staffStatusLabel, CHECKLIST_STATUS_LABELS,
// recommendationLabel), never re-worded here.
//
// Why domains: the same word means different things in different records.
// A "pending" checklist item is simply not checked yet (grey), while a
// pending repayment is waiting on someone (amber, statusTone's reading).

export type StatusDomain = "application" | "checklist" | "informationRequest" | "recommendation";

export interface StatusPresentation {
  label: string;
  tone: StatusTone;
  icon: LucideIcon;
}

const CHECKLIST_TONES: Record<ChecklistItemStatus, StatusTone> = {
  verified: "success",
  failed: "danger",
  not_applicable: "neutral",
  pending: "neutral",
};

// Not yet checked reads as an empty circle rather than the "not applicable"
// dash, so the two greys are told apart by shape.
const CHECKLIST_ICONS: Partial<Record<ChecklistItemStatus, LucideIcon>> = { pending: Circle };

export const INFORMATION_REQUEST_STATUS: Record<InformationRequestStatus, { label: string; tone: StatusTone }> = {
  open: { label: "Waiting on customer", tone: "warning" },
  responded: { label: "Answered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const RECOMMENDATION_TONES: Record<OfficerRecommendationType, StatusTone> = {
  recommend_approval: "success",
  recommend_rejection: "danger",
};

// Own keys only, so a value like "constructor" can't match Object.prototype.
function lookup<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

export function statusPresentation(domain: StatusDomain, status: string): StatusPresentation {
  switch (domain) {
    case "application": {
      const tone = statusTone(status);
      return { label: staffStatusLabel(status), tone, icon: TONE_ICONS[tone] };
    }
    case "checklist": {
      const s = (lookup(CHECKLIST_TONES, status) ? status : "pending") as ChecklistItemStatus;
      const tone = CHECKLIST_TONES[s];
      return { label: CHECKLIST_STATUS_LABELS[s], tone, icon: CHECKLIST_ICONS[s] ?? TONE_ICONS[tone] };
    }
    case "informationRequest": {
      // An unknown status reads as still open: the safe assumption is that
      // the customer may still owe an answer.
      const p = lookup(INFORMATION_REQUEST_STATUS, status) ?? INFORMATION_REQUEST_STATUS.open;
      return { ...p, icon: TONE_ICONS[p.tone] };
    }
    case "recommendation": {
      const tone = lookup(RECOMMENDATION_TONES, status) ?? "neutral";
      return { label: recommendationLabel(status), tone, icon: TONE_ICONS[tone] };
    }
  }
}
