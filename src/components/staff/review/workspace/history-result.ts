import type { CustomerHistory } from "@/lib/types";

// GET /officer/applications/<id>/customer-history as the review page read
// it. "unavailable" is the backend's 403 - loan officers see a customer's
// history only while the application is under review - not an error.
// "deferred": not fetched, because the tab that shows it isn't open. The
// backend audits every read (customer_history_viewed), so the page reads it
// only when the officer opens the History or Credit tab - as the separate
// customer-history page always did - never on every view or refresh.
export type HistoryResult =
  | { status: "ok"; history: CustomerHistory }
  | { status: "deferred" }
  | { status: "unavailable" }
  | { status: "error" };
