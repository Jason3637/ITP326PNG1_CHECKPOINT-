import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { analytics } from "@/components/admin/admin-fixtures.test-utils";
import type { ChartSpec } from "@/components/admin/analytics/chart-spec";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
const serverApiFetch = vi.fn();
vi.mock("@/lib/server-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server-api")>();
  return { ...real, serverApiFetch: (...a: unknown[]) => serverApiFetch(...a) };
});
// jsdom has no canvas: stand in for the lazily loaded chart, exposing the
// spec it would draw.
vi.mock("@/components/admin/analytics/ChartFrame", () => ({
  ChartFrame: ({ spec }: { spec: ChartSpec }) => (
    <div data-testid="chart" data-kind={spec.kind} data-labels={spec.labels.join("|")} data-values={spec.values.join("|")} />
  ),
}));

import AdminAnalyticsPage from "./page";
import { ApiError } from "@/lib/server-api";

function backend(opts: { trendFails?: boolean } = {}) {
  serverApiFetch.mockImplementation(async (path: string) => {
    const m = /from=(\d{4}-\d{2}-\d{2})&to=(\d{4}-\d{2}-\d{2})/.exec(path);
    if (m && m[1] !== "2026-09-06") {
      if (opts.trendFails) throw new ApiError(500, "boom");
      // A distinct figure per week, so the test can see each one came from its own call.
      const day = Number(m[2].slice(8));
      const week = analytics({ received: day, principal_disbursed: day * 100 });
      return { ...week, window: { ...week.window, from: m[1], to: m[2] } };
    }
    return analytics();
  });
}

const renderPage = async (search: Record<string, string> = {}) =>
  render(await AdminAnalyticsPage({ searchParams: Promise.resolve(search) }));

const tile = (label: string) => screen.getByText(label, { selector: "li > p:first-child" }).closest("li") as HTMLElement;
const group = (title: string) => screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

describe("Administrator analytics", () => {
  beforeEach(() => {
    // Block body on purpose: a function returned from beforeEach is run by
    // Vitest as cleanup, and mockReset() returns the mock itself.
    serverApiFetch.mockReset();
  });

  it("keeps the money figures distinct: each its own label, value and definition", async () => {
    backend();
    await renderPage();
    const expectations: [string, string, string][] = [
      ["Principal disbursed", "K2,100", "Sum of principal paid out in the window."],
      ["Interest contracted", "K700", "Interest."],
      ["Expected repayment", "K2,800", "Expected."],
      ["Verified repayments", "K1,250", "Cash received: verified repayments."],
      ["Penalties charged", "K37.5", "Late-payment penalties added."],
      ["Outstanding", "K1,234.5", "What is still owed, from the ledger."],
      ["Active principal exposure", "K900", "Exposure."],
      ["Overdue value", "K310", "Outstanding balance on overdue loans."],
    ];
    for (const [label, value, definition] of expectations) {
      expect(tile(label)).toHaveTextContent(value);
      expect(tile(label)).toHaveTextContent(definition);
    }
  });

  it("separates period figures from the as-of-now portfolio", async () => {
    backend();
    await renderPage();
    expect(group("Money paid out")).toHaveTextContent("In the period");
    expect(group("Money received")).toHaveTextContent("In the period");
    expect(group("Portfolio")).toHaveTextContent("As of Oct 5, 2026");
    expect(within(group("Portfolio")).getByText("Outstanding")).toBeInTheDocument();
    expect(within(group("Money paid out")).queryByText("Outstanding")).not.toBeInTheDocument();
  });

  it("shows applications and processing times as plain figures", async () => {
    backend();
    await renderPage();
    expect(tile("Received")).toHaveTextContent("9");
    expect(tile("Approval rate")).toHaveTextContent("75%");
    expect(tile("Submission to decision")).toHaveTextContent("5.5 hours median");
    expect(tile("Approval to disbursement")).toHaveTextContent("2.5 days median");
    expect(tile("Submission to disbursement")).toHaveTextContent("None in the period.");
  });

  it("charts PRIME categories in tier order from the backend's breakdown", async () => {
    backend();
    await renderPage();
    const [apps, principal] = screen.getAllByTestId("chart").slice(0, 2);
    expect(apps).toHaveAttribute("data-kind", "bar");
    expect(apps).toHaveAttribute("data-labels", "PRIME 1|PRIME 2|PRIME 10|not PRIME");
    expect(apps).toHaveAttribute("data-values", "3|4|1|1");
    expect(principal).toHaveAttribute("data-values", "600|1500");
  });

  it("builds the weekly trend from one backend call per week", async () => {
    backend();
    await renderPage();
    const calls = serverApiFetch.mock.calls.map((c) => c[0] as string);
    expect(calls[0]).toBe("/admin/analytics");
    expect(calls.slice(1)).toHaveLength(8);
    expect(calls.at(-1)).toBe("/admin/analytics?from=2026-09-29&to=2026-10-05");
    const [appsTrend, principalTrend] = screen.getAllByTestId("chart").slice(2);
    expect(appsTrend).toHaveAttribute("data-kind", "line");
    expect(appsTrend.getAttribute("data-values")!.split("|").at(-1)).toBe("5"); // the last week's own figure
    expect(principalTrend.getAttribute("data-values")!.split("|").at(-1)).toBe("500");
  });

  it("offers every chart as a table too", async () => {
    backend();
    await renderPage();
    expect(screen.getAllByText("Show as a table")).toHaveLength(4);
    expect(screen.getByRole("cell", { name: "PRIME 10" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "K1,500 (2)" })).toBeInTheDocument();
  });

  it("keeps the figures when the trend can't be loaded", async () => {
    backend({ trendFails: true });
    await renderPage();
    expect(screen.getByText(/weekly trend couldn't be loaded/)).toBeInTheDocument();
    expect(tile("Principal disbursed")).toHaveTextContent("K2,100");
  });

  it("forwards a valid date range and ignores junk", async () => {
    backend();
    await renderPage({ from: "2026-09-06", to: "2026-10-05" });
    expect(serverApiFetch.mock.calls[0][0]).toBe("/admin/analytics?from=2026-09-06&to=2026-10-05");
    serverApiFetch.mockClear();
    await renderPage({ from: "yesterday", to: "2026-13-01" });
    expect(serverApiFetch.mock.calls[0][0]).toBe("/admin/analytics");
  });

  it("explains a backwards date range instead of crashing", async () => {
    serverApiFetch.mockImplementation(async () => {
      throw new ApiError(400, "from must be on or before to.");
    });
    await renderPage({ from: "2026-10-05", to: "2026-09-01" });
    expect(screen.getByText("The start date has to be on or before the end date.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show the last 30 days" })).toHaveAttribute("href", "/admin/analytics");
  });
});
