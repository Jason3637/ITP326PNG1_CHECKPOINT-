import "server-only";
import { cache } from "react";
import { serverApiFetch } from "./server-api";
import type { OfficerNavCounts } from "./nav";
import type { OfficerQueue, QueueCounts } from "./types";

// GET /officer/queues, read at most once per request. The staff layout
// (sidebar counts) and the dashboard (summary tiles) both need it; React's
// cache() lets them share one call, so the nav and the tiles always show
// the same numbers and a page load never fetches them twice.
export const getOfficerQueueCounts = cache(() => serverApiFetch<QueueCounts>("/officer/queues"));

// The sidebar's counts: each queue's total. Optional - if the read fails
// the nav shows no counts rather than taking the page down (the page's own
// reads report their own errors). Like the admin nav, a layout doesn't
// re-render on navigation, but does on router.refresh(), which every
// officer action calls after it saves - so counts follow the officer's own
// changes; others' show on the next full load.
export async function officerNavCounts(): Promise<OfficerNavCounts | null> {
  try {
    const { queues } = await getOfficerQueueCounts();
    return Object.fromEntries(
      (Object.entries(queues) as [OfficerQueue, { total: number }][]).map(([key, q]) => [key, q.total]),
    ) as OfficerNavCounts;
  } catch {
    return null;
  }
}
