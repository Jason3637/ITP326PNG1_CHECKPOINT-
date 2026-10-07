import type { CustomerHistory } from "@/lib/types";

// GET /officer/applications/<id>/customer-history as the review page read
// it. "unavailable" is the backend's 403 - loan officers see a customer's
// history only while the application is under review - not an error.
export type HistoryResult =
  | { status: "ok"; history: CustomerHistory }
  | { status: "unavailable" }
  | { status: "error" };
